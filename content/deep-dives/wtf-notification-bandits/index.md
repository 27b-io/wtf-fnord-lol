+++
title = "WTF is the Recovering Difference Softmax Algorithm?"
description = "Duolingo's notification algorithm isn't just A/B testing with extra steps. It's a bandit that knows when to shut up — and that's the hard part."
date = 2026-03-12T15:00:00+11:00

[taxonomies]
tags = ["bandits", "recommendation-systems", "notifications", "duolingo", "paper-review"]
series = ["wtf-explainers"]

[extra]
paper_url = "https://research.duolingo.com/papers/yancey.kdd20.pdf"
paper_date = "2020-08-23"
reading_time = "~8 min"
+++

## The One-Sentence Version

Duolingo built a {{ glossary(term="multi-armed bandit", def="An exploration-exploitation framework where an agent repeatedly chooses among options ('arms') to maximise cumulative reward, balancing trying new options against exploiting known good ones.") }} that picks which push notification to send you — but the interesting part isn't the bandit. It's the two problems they had to solve that most bandit tutorials pretend don't exist.

{{ cite(key="yancey2020", title="A Sleeping, Recovering Bandit Algorithm for Optimizing Recurring Notifications", authors="Yancey, K. & Settles, B.", year="2020", url="https://research.duolingo.com/papers/yancey.kdd20.pdf") }}

## The Setup

Duolingo sends daily practice reminders to 300M+ users. Each reminder uses a hand-written template: "You're on fire! Continue your 109-day streak" or "Your French is getting rusty" or something guilt-adjacent. The question is which template to send each user, each day, to maximise the chance they actually open the app and do a lesson within two hours.

This is a textbook bandit problem. You have arms (templates), you pull one per round (send a notification), you observe a reward (did they do a lesson or not). Textbook bandits converge on the best arm and exploit it.

The textbook is wrong here. Two reasons.

## Problem 1: Sleeping Arms

Not every template is available for every user. "Continue your 109-day streak" requires a 3+ day streak. "Your travel motivation awaits" requires the user to have set a travel goal. Templates have {{ glossary(term="eligibility criteria", def="Conditions that must be true for a notification template to be available to a specific user in a given round — streak length, learning goals, time of day, etc.") }} that change daily.

This breaks the standard bandit assumption that all arms are always available. Worse, it creates a confounding problem that will silently corrupt your results if you ignore it.

Consider: Template A is only eligible for users with active streaks. Template G is eligible for everyone. Template A's raw average reward is 0.267. Template G's is 0.137. Template A looks twice as good.

It isn't. Active-streak users complete lessons at higher rates *regardless of which notification you send them*. Template A's high reward is almost entirely explained by its eligibility filter selecting for engaged users, not by the template itself being effective.

The fix is beautifully simple. For each template, compute two numbers:

- **μ⁺**: average reward when this template *is* the one sent
- **μ⁻**: average reward when this template *is eligible but not sent*

The template's score is the {{ glossary(term="relative difference", def="(μ⁺ - μ⁻) / μ⁻ — measures how much better a template performs compared to the baseline reward of its own eligible population. Controls for confounding eligibility criteria without needing to know what those criteria are.") }}: (μ⁺ - μ⁻) / μ⁻.

This is the key insight. You're not asking "do users complete lessons after seeing Template A?" You're asking "do users complete lessons *more often* when they see Template A versus whatever else they'd have seen?" The eligible population *is its own control group*.

Template A's relative difference? **-0.37%**. It actually performs *below* its eligible population's baseline. Template G? **+1.48%**. The raw rewards were lying.

## Problem 2: Recovering Arms

Here's where it gets interesting. Say you find the best template. You send it every day. What happens?

It stops working.

Humans {{ glossary(term="habituate", def="The psychological process by which repeated exposure to the same stimulus reduces response. In notification systems, sending the same message repeatedly causes users to ignore it — even if it was initially the most effective option.") }} to repeated stimuli. The first time you see "Duo is sad without you," it's mildly guilt-inducing. The fifteenth time, it's wallpaper. A standard bandit that converges on one arm will *destroy its own best option through overuse*.

The paper calls these "recovering arms" — templates that perform worse immediately after use but recover their effectiveness over time, following an exponential decay that mirrors {{ glossary(term="Ebbinghaus forgetting curve", def="Hermann Ebbinghaus's 1885 finding that memory retention decays exponentially over time. Duolingo applies this to notification fatigue: the 'memory' of having seen a template fades with a ~15-day half-life.") }}.

The recency penalty:

> s* = s − γ · 0.5^(d/h)

Where *d* is days since the template was last sent to this user, *γ* = 0.017 is the penalty magnitude, and *h* = 15 days is the half-life. If you showed the user this template yesterday, it gets penalised. If you showed it two weeks ago, the penalty has mostly decayed. If they've never seen it, no penalty at all.

The effect size is tiny — about 0.0006 in absolute terms. But at Duolingo's scale (202 million rounds in the evaluation dataset), tiny effects compound into real retention numbers.

## Why Not Just A/B Test?

A reasonable question. Run an A/B test, find the best template, deploy it. Done.

Three reasons this fails:

1. **The best template changes per user.** Eligibility criteria create different template pools per user per day. There is no single "best."
2. **The best template decays.** Even if you found it, deploying it kills it through habituation.
3. **New templates arrive constantly.** Content teams write new notifications. An A/B test is a snapshot; a bandit continuously adapts.

The bandit framework handles all three simultaneously. Templates are selected via {{ glossary(term="softmax", def="A probability distribution where each option's selection probability is proportional to exp(score/τ), with temperature τ controlling how aggressively the algorithm exploits high-scoring options vs. exploring alternatives.") }} with temperature τ = 0.0025, providing ongoing exploration. New templates start at score 0 and get explored naturally — no special onboarding needed.

## The Engineering That Makes It Work

The algorithm runs at scale through a clean separation:

A **daily batch scorer** computes template scores from decision logs joined with lesson-completion events. This is where the importance-weighted relative difference calculation happens — computationally expensive but only runs once per day.

A **real-time arm selector** takes the precomputed scores, applies the per-user recency penalty (which only needs the last-shown timestamp per template per user), and runs softmax to select a template. This is fast enough for the notification-send path.

A **5% holdout set** receives uniformly random template selection. This serves two purposes: ongoing performance monitoring (the bandit consistently achieves 2.5% higher reward than random after five months), and generating unbiased training data for rarely-used templates whose importance weights would otherwise create high variance.

{{ cite(key="mazurkiewicz2026", title="How I Re-Created Duolingo's Famous Notification Algorithm", authors="Mazurkiewicz, J.", year="2026", url="https://medium.com/@jakemazurkiewicz6/how-i-re-created-duolingos-famous-notification-algorithm-00fce580b84e") }}

## The Results

| Metric | Gain |
|---|---|
| Daily Active Users | +0.5% |
| New User D1 Retention | +2.2% |
| New User D7 Retention | +2.0% |
| Total Lessons Completed | +0.4% |
| 5-month sustained reward lift | +2.5% |

The new user retention numbers are the headline. A 2% retention lift from *notification template selection alone* is remarkable. New users' habits are more malleable — they haven't habituated to any template yet, so the algorithm's template diversity has maximum impact.

The 0.5% DAU lift is smaller than the 1.9% reward lift because organic activity (users who would have opened the app anyway) dilutes the measurable effect. The notification only matters for users who wouldn't have come back without it.

## What's Actually Clever Here

It's not the bandit. Bandits are well-understood. It's the two modifications that make the textbook algorithm survive contact with reality:

1. **Relative difference scoring** solves the confounding problem without needing to model eligibility criteria. The algorithm doesn't know *why* Template A is only available to streak users. It doesn't need to. The μ⁺/μ⁻ comparison controls for it automatically.

2. **The recovery model** acknowledges that the standard bandit assumption — that arm rewards are stationary or at least independent of selection history — is wrong for recurring notifications. Humans remember what you showed them yesterday.

Most "we used a bandit" blog posts skip both problems. Most production notification systems either ignore them (and wonder why their "optimal" template's performance degrades over time) or handle them with ad-hoc rules ("don't send the same template twice in a row") that leave value on the table.

Duolingo's contribution is showing that both problems can be handled within the bandit framework itself, with clean mathematics, at production scale. The algorithm has been running for years. The owl's passive-aggression is *optimised*.

## The Bottom Line

If you're building a notification system and reaching for a standard {{ glossary(term="contextual bandit", def="A bandit algorithm that conditions arm selection on contextual features (user attributes, time of day, etc.) rather than treating all rounds identically. Duolingo's approach is simpler — it uses eligibility-based scoring rather than full contextual features.") }}, stop and ask two questions:

1. **Are all your options always available?** If not, raw reward comparisons are lying to you. You need relative difference scoring or equivalent.
2. **Do your options degrade with repeated use?** If you're sending recurring messages to the same humans, yes. You need a recovery model.

The Recovering Difference Softmax Algorithm isn't the only way to solve these problems. But it's a clean, production-proven one, and the paper is unusually honest about the engineering trade-offs involved.
