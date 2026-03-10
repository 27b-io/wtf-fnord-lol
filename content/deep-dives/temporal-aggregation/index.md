+++
title = "Multi-Window Temporal Aggregation for Behavioral Trajectory"
description = "The same metric across 7, 30, and 90 days tells you where someone is heading, not just where they are. Here's why that distinction is the whole game."
date = 2026-03-10

[taxonomies]
tags = ["personalization", "data-architecture", "behavioral-analytics", "temporal-analysis"]
series = ["systems-deep-dives"]
+++

## The One-Sentence Version

Compute every behavioral metric over three overlapping time windows — 7, 30, and 90 days — and you've built a data structure that describes not just what a user does, but the direction they're heading, for free.

{% callout(type="tldr") %}
**What:** Store behavioral aggregates across three time windows (7d/30d/90d) for every metric. Compare same metric across windows to read trajectory without computing it explicitly.
**Why it matters:** An LLM (or any downstream consumer) can reason about velocity and direction directly from the data shape. The trend is already there — you just have to look sideways.
**The trick:** 11.4 → 11.9 → 24.1 (90d to 30d to 7d) means sessions are accelerating. The data says it. You don't have to compute it.
{% end %}

## The Problem With Snapshots

Every analytics system eventually confronts the same uncomfortable truth: a snapshot is a photograph, and photographs lie.

User opens your app 14 times this week. Is that a lot? Is it engagement? Is it anxiety? Is it a bug in your push notification system? You have absolutely no idea from a single number. You need {{ glossary(term="behavioral trajectory", def="The directional change in a user's behavior over time — not just what they do, but whether they're doing it more or less, and how fast that's changing.") }}, not just state.

This is the dirty secret of most personalization systems: they're built on snapshots. They know what you did, not whether you're accelerating or decelerating. Netflix knows you watched 3 hours yesterday. It doesn't know (or at least, doesn't cleanly surface) that you've been watching progressively less each week for a month, which is a leading indicator that you're about to churn. A snapshot says "active user." A trajectory says "departing user with three weeks left."

The industry has spent considerable energy on this problem. Spotify's recommendation research has consistently pointed toward the gap between {{ glossary(term="snapshot vs trajectory", def="Snapshot: a single-point-in-time measure of user behavior. Trajectory: the direction and rate of change of that behavior across time. Snapshots describe state; trajectories describe momentum.") }} as a core modeling challenge {{ cite(key="spotify2021", title="Recommendations in the Real World: Temporal Modeling for Sequential User Behavior", authors="Hansen et al.", year="2021", url="https://research.atspotify.com/2022/02/modeling-users-according-to-their-slowest-sequences/") }}. YouTube's landmark DNN paper acknowledged that freshness and recency signals dramatically outperform static engagement features {{ cite(key="covington2016", title="Deep Neural Networks for YouTube Recommendations", authors="Covington, Adams, Sargin", year="2016", url="https://dl.acm.org/doi/10.1145/2959100.2959190") }}. The finding is consistent: behavioral state is far less predictive than behavioral momentum.

And yet — most teams implement snapshots, because they're easy. One query, one number, one column in a feature table. Done.

Multi-window temporal aggregation is the minimum viable answer to this problem that doesn't require a PhD.

## The Approach: Make the Trend Visible in the Schema

The core idea is embarrassingly simple. Instead of storing one aggregate per metric, store three:

```
session_duration_avg_7d  = 24.1
session_duration_avg_30d = 11.9
session_duration_avg_90d = 11.4
```

That's it. That's the whole trick. You've just encoded a trend in your schema.

The {{ glossary(term="multi-window aggregation", def="Computing the same statistical aggregate (mean, sum, count, etc.) over multiple distinct time windows simultaneously, allowing trajectory to be inferred by comparing values across windows.") }} pattern means any consumer of this data — a rules engine, a ranking model, or an LLM generating a personalized recommendation — can read trajectory by comparing columns. No slope calculation required. No regression fitting. No time-series library. You just look left.

In the example above: 90d average session is 11.4 minutes, 30d is 11.9, 7d is 24.1. The user's sessions are getting dramatically longer in the recent past. That's a signal. Maybe they found something they love. Maybe they're procrastinating a project deadline. Either way, "this person's behavior is changing fast" is enormously useful information that a plain 7-day average completely buries.

{% callout(type="insight") %}
The insight is that you're not just storing data — you're pre-computing a derivative. The difference between adjacent windows is an approximation of the rate of change, handed to your downstream consumers without them having to ask for it. The slope is in the schema.
{% end %}

The {{ glossary(term="rate of change", def="In behavioral analytics: how quickly a user's metric is changing between time windows. A large difference between 7d and 90d windows indicates rapid behavioral change; a small difference indicates stability.") }} this surface is rough — it's a finite difference between overlapping windows, not a proper derivative — but it's directionally correct and computationally free. You already computed the windows. The comparison cost is nothing.

### What Gets Three Windows?

Everything. That's the discipline of this approach. It's_tempting to apply multi-window aggregation only to "interesting" metrics, but the value comes from doing it uniformly:

- **Activity counts:** sessions started, content items consumed, searches performed
- **Duration metrics:** session length, time on content type, days since last event
- **Engagement signals:** completion rates, explicit ratings, share/save actions
- **Content preferences:** category affinities, creator preferences, format preferences

When you apply the same window structure uniformly, you create a {{ glossary(term="temporal windows", def="Discrete time periods used to compute behavioral aggregates. Common choices: 7d (recent), 30d (medium-term), 90d (long-term baseline). Comparing the same metric across windows reveals behavioral trajectory.") }} vocabulary that makes behavioral comparison tractable across very different user histories. A user with 2 years of data and a user with 45 days of data are both described by the same feature schema — the windows just capture different proportions of their history.

## The LLM as Trajectory Interpreter

Here's where this gets interesting for modern systems. When you feed a user profile to an LLM for a personalization task, you're not asking it to compute statistics. You're asking it to interpret behavioral signals and generate a coherent response.

Multi-window aggregation does something clever: it pre-interprets the trajectory, leaving only the semantic interpretation for the LLM.

Consider two prompts:

**Prompt A (snapshot only):**
> "User average session duration: 12.1 minutes. Recommend content."

**Prompt B (multi-window):**
> "User session duration: 7d avg 24.1 min, 30d avg 11.9 min, 90d avg 11.4 min. Recommend content."

Prompt A requires the LLM to decide whether 12.1 is high or low, short or long, changing or stable. It has no context for any of that judgment. Prompt B hands the LLM a complete picture: this person's sessions have roughly doubled in the last week relative to their baseline. The LLM can reason about *what that means* rather than *whether it's notable*.

The data structure does the quantitative work. The LLM does the qualitative work. That's the right division of labour.

{% callout(type="insight") %}
Multi-window aggregation is a form of prompt engineering at the data layer. You're designing your feature schema to make the LLM's job easier — which means thinking about what signals the model can reason about, not just what signals you can compute.
{% end %}

## How Platforms Actually Do This

Spotify, YouTube, and TikTok all converge on temporal windowing as a core feature engineering strategy, though with different implementations.

YouTube's recommendation system uses "impression age" features and explicit recency weighting to distinguish between historically and recently engaged users {{ cite(key="covington2016", title="Deep Neural Networks for YouTube Recommendations", authors="Covington, Adams, Sargin", year="2016", url="https://dl.acm.org/doi/10.1145/2959100.2959190") }}. Their DNN architecture treats recent interactions as substantially higher-signal than older ones — not through windowing per se, but through learned temporal attention. The insight is the same: recency matters, and your features need to express it.

TikTok's For You page relies heavily on what they call "momentum signals" — not just whether a user engaged with a content type, but whether engagement is accelerating {{ cite(key="zhang2022", title="Modeling User Behavior Dynamics with Personalized Temporal Preference in Recommender Systems", authors="Zhang et al.", year="2022", url="https://arxiv.org/abs/2209.02069") }}. A user whose horror content engagement went from 5% to 40% of sessions in the past two weeks is very different from a user stable at 40% — and TikTok's system treats them differently. The accelerating user is in the grip of a new interest; the stable user has a settled preference. Calibrating recommendations to that difference requires trajectory, not state.

Spotify's research into sequential behavior modeling found that the gap between session-level and long-horizon preferences is a primary driver of recommendation errors {{ cite(key="spotify2021", title="Recommendations in the Real World: Temporal Modeling for Sequential User Behavior", authors="Hansen et al.", year="2021", url="https://research.atspotify.com/2022/02/modeling-users-according-to-their-slowest-sequences/") }}. Their framework explicitly models users at multiple timescales — something multi-window aggregation approximates with considerably less machinery.

The common thread: all three treat behavioral trajectory as a first-class signal. The implementation differs (learned temporal attention vs explicit windowing vs multi-timescale models), but the underlying observation is the same. State is insufficient. You need momentum.

## The Arbitrariness Problem (And Why It Doesn't Actually Matter That Much)

Let's be direct about the uncomfortable part: 7/30/90 is an arbitrary choice.

A user who binge-watches 40 hours of true crime over three days looks "intensifying" in the 7-day window and essentially invisible in the 90-day baseline. Is that trend real? Is it noise? Should you recommend more true crime, or wait to see if it persists? The multi-window structure gives you the data to ask the question, but it doesn't answer it.

{{ glossary(term="trend detection", def="The problem of distinguishing genuine directional change in user behavior from statistical noise, short-term anomalies, or one-off events. Not every upward trend is real; not every downward trend is a churn signal.") }} is harder than it looks. The naive reading of "7d significantly above 90d baseline = intensifying interest" breaks down in several cases:

- **Vacation / anomalous events:** Someone with three free days and a Netflix subscription will spike every metric for those days.
- **Binge-then-abandon:** Many users cycle through intense new-interest phases that resolve completely within two weeks. Your 7d window catches the binge; your 30d window catches the hangover.
- **Weekend warriors:** Users with strong day-of-week patterns will have noisy 7d windows depending on when you compute them.
- **External events:** A show finale, a product launch, a news event — any of these can spike engagement that looks like genuine behavioral change until it isn't.

The honest answer is that 7/30/90 is reasonable for most consumer applications and completely wrong for edge cases. The 7-day window is long enough to smooth daily noise and short enough to catch genuine emerging interests. The 90-day window is long enough to capture stable preferences. The 30-day window gives you the middle ground. But these choices are tunable, and for high-stakes decisions (churn intervention, heavy discounting, major UI changes), you'd want to validate that a trend is persistent across multiple observation windows before acting on it.

The alternative approaches — exponential decay weighting and adaptive windows — address this, but with significant added complexity.

**Exponential decay** weights every event by its age (recent events count more, old events fade), producing a continuously-updating estimate that has no hard cutoffs and naturally handles the "binge then abandon" case. The math is elegant; the implementation is more complex; and you lose the clean "7d vs 90d" readability that makes multi-window aggregation so interpretable.

**Adaptive windows** try to fit window boundaries to user-specific behavioral rhythms — shorter windows for high-frequency users, longer windows for occasional users. The theory is sound; the engineering is painful; and the resulting features are impossible to reason about without per-user metadata.

Multi-window aggregation survives because the arbitrariness is a known, bounded error, and the simplicity it buys is worth it. You know the 7-day window is noisy for edge cases. You can document it. You can add robustness checks. You cannot easily reason about a continuous decay model.

{% callout(type="warning") %}
**The binge-detection trap:** If your system acts on 7d vs 90d comparison alone, you will occasionally serve intense recommendations to users who had three unusual days and have since returned to their normal patterns. Build in some friction — require the trend to persist for at least two consecutive weeks before treating it as a genuine behavioral shift.
{% end %}

## What's Actually New Here

Multi-window aggregation is not a new idea. Time-series featurization at multiple granularities appears throughout the forecasting and signal processing literature. What's changed is the context: applying it specifically as a {{ glossary(term="behavioral trajectory", def="The directional change in a user's behavior over time — not just what they do, but whether they're doing it more or less, and how fast that's changing.") }} primitive for LLM-driven personalization.

In the traditional ML personalization pipeline, trajectory features fed directly into model inputs. The model learned to weight them appropriately through training. That pipeline required training data, labels, and a reasonably stable target metric — none of which you have when you're using an LLM for zero-shot or few-shot personalization.

When the LLM *is* the reasoning engine, you need your data to be interpretable without training. Multi-window aggregation achieves this: it creates features whose trajectory-meaning is legible to a language model without requiring it to have been trained on your specific domain.

The pairing with the Offline Agent Pattern is not accidental. An offline agent that constructs a behavioral profile and stores it for later retrieval needs that profile to be durable, interpretable, and rich enough to drive coherent downstream reasoning. Multi-window aggregation ensures the profile captures trajectory, not just state — which means the profile is still useful when retrieved days after it was constructed, because the trend information is baked in.

{% callout(type="question") %}
**Open question:** As LLMs improve at numerical reasoning, does the value of pre-computing trajectory diminish? Could a sufficiently capable model reconstruct trajectory from raw event logs just as effectively as from pre-aggregated windows? Or does the pre-aggregation serve a structural role — organizing the signal — that isn't about the model's compute capability?
{% end %}

## Statistical Significance: When Is the Trend Real?

Nobody asks this question enough, which is why most personalization systems confidently serve wrong recommendations to their most behaviorally volatile users.

A 7d window of 20 sessions vs a 90d baseline of 6 sessions/week looks like an intensifying trend. It's also statistically indistinguishable from noise if your user has high variance. You'd need to know the week-to-week standard deviation to say anything meaningful {{ cite(key="kohavi2020", title="Trustworthy Online Controlled Experiments: A Practical Guide to A/B Testing", authors="Kohavi, Tang, Xu", year="2020", url="https://www.cambridge.org/core/books/trustworthy-online-controlled-experiments/D97549C9D4E7A3E80A7B1EB8F3C15C70") }}.

The rough heuristic that works in practice:

- If the 7d value is more than 1.5 standard deviations above the 90d baseline, treat it as a genuine signal
- If you don't have variance data, require the elevation to persist across two consecutive 7d windows before acting on it
- If the user has fewer than 30 total events in 90 days, the windows are too thin to be reliable — fall back to content-type defaults

These aren't statistically rigorous. They're operationally sane. The goal isn't to be right about every user's trajectory; it's to be directionally correct across most users while avoiding spectacular errors on the edge cases.

## The Bigger Picture

The deeper argument here is about data architecture as a form of communication.

When you design a feature schema, you're making choices about what's expressible and what isn't. A schema with only snapshot features is a schema where trend is inexpressible — not because it's technically impossible to compute, but because the infrastructure never materialized to make it cheap and routine. The bottleneck isn't capability; it's convention.

Multi-window aggregation is a convention. It's a choice to say: trajectory matters enough to bake into the schema. Every metric gets three windows. The trend is always visible. Nobody has to ask for it specially, write a bespoke query, or wait for a data request to be processed. It's just there.

That convention has downstream effects. It changes what questions get asked, because the questions that are easy to ask change what's obvious to investigate. If every metric has a trajectory signal, your data analysts start noticing trajectory patterns. Your product managers start asking about acceleration, not just state. Your recommendation engineers start treating trend as a first-class feature rather than a nice-to-have. The convention shapes the culture.

This is the unsexy part of data architecture that nobody writes conference talks about: the schema is a communication medium. What you put in the schema is what your organization can easily talk about. Put in snapshots only, and you'll talk about state. Put in trajectories, and you'll talk about momentum.

Systems that can reason about where a user is going — not just where they are — will consistently outperform systems that can only describe the present. Multi-window aggregation is the minimum viable version of that capability. It's not elegant. It's not theoretically rigorous. It's three extra columns in your feature table.

Three columns, and suddenly you know whether someone is arriving or leaving.

## Bottom Line

Multi-window temporal aggregation is a data architecture pattern, not an algorithm. You compute the same behavioral aggregates over three time windows (7d, 30d, 90d), store them adjacently in your feature schema, and let consumers — models, rules engines, LLMs — compare across windows to infer trajectory.

The approach is robust because it's simple. It has no moving parts, no per-user calibration, no distributional assumptions beyond "behavior changes over time." Its limitations are known and bounded: noisy for low-frequency users, misleading for binge-then-abandon patterns, arbitrary in its window choices.

Apply it when you need behavioral context that captures direction, not just state. Apply it uniformly across all metrics — the value comes from the convention, not from cherry-picking which features get trajectory treatment. Pair it with the Offline Agent Pattern for profiles that stay useful after the user has stopped interacting.

Don't wait until you have a sophisticated temporal model. Three columns now is better than a perfect time-series architecture in eight months.

**The trend is in the schema. You just have to look sideways.**
