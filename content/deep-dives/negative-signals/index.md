+++
title = "Negative Signals as First-Class Citizens in Recommendation"
description = "What users don't do matters more than what they do. Most recommendation systems are built entirely on applause. Here's why the silence is louder."
date = 2026-03-10T13:00:00+11:00

[taxonomies]
tags = ["recommendation-systems", "behavioral-analytics", "negative-signals", "personalization"]
series = ["tier-2"]

[extra]
reading_time = "10 min"
+++

## The One-Sentence Version

Your recommendation engine is listening to everything the user says and ignoring everything they don't — which is most of the signal.

{% callout(type="tldr") %}
**What:** A framework for treating non-engagement with *exposed* content as explicit signal — abandonment, one-and-done creators, exposed-but-not-clicked tags, duration caps, and pre-computed avoid lists.

**Why it matters:** Positive-only systems over-recommend the same buckets. Every piece of content a user was shown but didn't touch is an observation. Ignoring it is a statistical crime.

**The catch:** Non-engagement and non-exposure look identical in a naive log. Solving that distinction is most of the work.
{% end %}

## The Problem

Here's the scenario. Your recommendation system has been running for six months. Engagement metrics look fine. Average session length is up. CTR is healthy. Everyone's pleased.

Meanwhile, half your users have developed a hair-trigger skip reflex on crime documentaries because your engine recommended three in a row, they abandoned all three, and you interpreted the absence of a dislike button press as "no strong opinion." So you recommended a fourth. Then a fifth. Your system learned precisely nothing from the escalating pattern of someone closing the app.

This is not a pathological edge case. This is the default state of recommendation systems that treat {{ glossary(term="negative signals", def="Behavioral signals derived from non-engagement, abandonment, or repeated avoidance of exposed content. Distinct from explicit dislikes — these are inferred from what users demonstrably did *not* do after being given the opportunity.") }} as second-class citizens — or, more commonly, don't treat them at all.

The architecture of most rec systems looks like this: user does thing → record event → increase weight of similar things. The feedback loop is entirely reward-shaped. You are training a Labrador with treats only, then acting surprised when it knocks over every bin in the house looking for more treats.

{% callout(type="warning") %}
A recommendation system with no negative signal is a system that can only learn to give you more of what you've tolerated. It cannot learn what you hate. Those are not the same thing.
{% end %}

## The Signal Types You're Missing

Let's be specific. The vague gesture toward "negative feedback" in most system designs is the problem — it ends up meaning "the dislike button," which approximately 3% of users ever press. We need to talk about the implicit signals that are already in your logs, right now, being ignored.

### Abandonment Signals

{{ glossary(term="abandonment signals", def="Events generated when a user starts consuming content (play, open, begin reading) but stops within a threshold window — typically 60 seconds for video, or before reaching a meaningful completion percentage for articles.") }}

The canonical definition: content started, stopped within 60 seconds. For video, you have a play event and an exit event with a timestamp delta. For articles, scroll depth. For podcasts, seek position at stop.

The 60-second threshold isn't arbitrary — it's approximately the window where a user transitions from "I'm evaluating this" to "I'm watching this." Pre-60s exits are overwhelmingly "this isn't what I wanted." Post-60s exits are more ambiguous — life intervened, they got a phone call, the content got boring at minute 4. The signal degrades rapidly after the threshold. Use it hard before it; use it cautiously after.

One immediate implementation: track the ratio of `play_events` to `complete_events` per content type per user. A user with a 0.8 completion rate is telling you something entirely different from a user with a 0.2 completion rate. Neither number shows up in your CTR metric. Both are screaming.

### One-and-Done Creators

{{ glossary(term="one-and-done", def="A creator or channel that a user sampled exactly once and never returned to, despite being repeatedly exposed to subsequent content from that source. Distinct from creators the user has never been exposed to.") }}

This one is subtle and often missed because it looks, in aggregate statistics, like "moderate interest." User watched one video from Creator X. Never watched another. Your system sees: one positive event. It does not see: seventeen subsequent recommendations of Creator X that the user scrolled past.

The signal is in the combination: *initial engagement + subsequent non-engagement despite exposure*. A single play event with no follow-up, against a backdrop of ongoing exposure, is a strong negative signal. The user tried it. They have an opinion. The opinion is "no."

Building a one-and-done detector requires joining your recommendation log with your engagement log, which most systems don't do — they're stored separately, owned by different teams, and nobody's job description includes bridging them. This is why the signal stays invisible. It's an organisational failure dressed up as a data gap.

### Exposed-Not-Engaged

{{ glossary(term="exposed-not-engaged", def="Content, tags, or creators that were rendered in a user's recommendation surface (impressions logged) but received zero interaction across multiple sessions. The user saw it. They chose not to interact. That's a signal.") }}

This is the biggest one and the most systematically ignored.

Every impression you serve is an experiment. The user saw that thumbnail, that title, that tag cluster. They made a decision. They kept scrolling. You logged the impression for ad-billing purposes and then threw away the behavioral data like a receipt you'll definitely need later.

Exposed-not-engaged is how you build negative affinity for tags and categories without requiring explicit feedback. If a user has seen forty pieces of content tagged `true-crime` and clicked zero of them, that's not ambiguity. That's a preference expressed forty times in silence.

The implementation challenge is impression logging at the tag level, not just the content level. Most systems log impressions per content item. You need: "user was exposed to content with tags [X, Y, Z] and did not interact." Aggregate that over a rolling window (30-90 days) and you have a {{ glossary(term="disengagement signals", def="Aggregated behavioral patterns indicating persistent non-preference across a category, tag, or content type. Built from multiple exposure-without-engagement observations rather than any single event.") }} map for the user.

### Duration Caps

Not every signal is about what content. Sometimes it's about how long.

Track per-user completion percentages as a function of content duration. You will find — reliably — that users have implicit duration thresholds beyond which completion rate collapses. A user who consistently completes 10-minute videos at 90% but abandons 45-minute videos at 30% is giving you a hard preference signal. Stop recommending 45-minute videos to that user.

The naive fix is to add duration as a ranking feature. The correct fix is to model it as a soft constraint and apply it upstream of ranking — don't even retrieve content above the user's tolerance threshold unless you have strong other signals compensating. Compute it. Store it on the profile. Respect it.

### Avoid Signals

{{ glossary(term="avoid signals", def="Pre-computed per-user lists of content, creators, tags, or categories that should be excluded from or heavily down-ranked in recommendation candidates. Built from aggregated negative signals rather than applied ad-hoc at serving time.") }}

The synthesis of all the above. Instead of applying negative signals at serving time (expensive, latency-sensitive), compute them offline into a structured avoid list per user and cache it on the profile.

```json
{
  "avoid": {
    "creators": ["creator-id-882", "creator-id-1204"],
    "tags": ["true-crime", "extreme-sports"],
    "duration_max_seconds": 1800,
    "content_ids": ["content-4421", "content-9983"]
  }
}
```

At retrieval time, this becomes a filter — either hard exclusion or a very large negative weight in your scoring function. The avoid list is a first-class profile attribute, maintained by the same pipeline that maintains positive preferences.

The payoff: your retrieval stage stops wasting candidate budget on content the user demonstrably doesn't want. Your ranker isn't doing corrective work that should have been done upstream. The whole pipeline gets cleaner.

{% callout(type="insight") %}
Pre-computed avoid lists move the intelligence to profile-update time, where you have compute budget, rather than serving time, where you don't. This is the same pattern as query-theme-keyed expansion — do the expensive reasoning offline, serve the result cheaply.
{% end %}

## The Key Tension: Non-Engagement vs. Non-Exposure

Here is where the architecture gets genuinely hard and where most implementations go wrong.

Non-engagement and non-exposure are observationally identical in a naive log. Both produce the same record: `{user_id, content_id, no_interaction}`. The difference is whether the user *saw* the content.

If you treat non-exposure as negative signal — content the user was never shown but didn't click — you've poisoned your signal completely. You're now penalising content for being unpopular, which is correlated with but not identical to "this user doesn't want it."

The fix is impression logging, full stop. You cannot build a sound negative signal system without knowing what was *shown*, not just what was interacted with. If your system doesn't emit impression events today, that's the first thing to build. Everything else depends on it.

Once you have impressions, the false negative problem becomes tractable. Non-engagement is only valid signal when:

1. The content was rendered with sufficient visibility (above the fold, not below a scroll threshold the user never reached)
2. The user had a reasonable opportunity to interact (session length sufficient, content type matches browsing mode)
3. The exposure is repeated — one non-click is noise, five non-clicks across different sessions is signal

That third criterion is doing a lot of work. A single impression without engagement tells you almost nothing. Ten impressions without engagement across a month tells you the user has seen this and actively doesn't want it.

{% callout(type="warning") %}
The single biggest mistake in negative signal implementation is applying it too aggressively too early. One abandonment event isn't a preference. Fifteen abandonment events in the same category, over three weeks, with no exceptions, is a preference. Weight accordingly.
{% end %}

## Weighting: Not Over-Correcting

The second architectural failure mode is symmetric and opposite: implementing negative signals and then weighting them so heavily that the system becomes pathologically conservative.

Negative signals are inherently sparser than positive ones. A user might have 500 positive interaction events and 40 cleanly-attributable negative ones. If you weight them naively by count, negative signals disappear. If you weight them by "importance," it's easy to over-correct until the system refuses to recommend anything adjacent to a category the user once abandoned.

Some practical calibration heuristics:

**Recency decay.** Negative preferences have a shorter half-life than positive ones. The user who avoided true crime documentaries eighteen months ago may be curious now. Apply aggressive recency decay to negative signals — 90-day half-life is a reasonable starting point, tune from there.

**Signal confidence tiers.** Not all negative signals are equal. Explicit dislike (button press) > repeated abandonment > single abandonment > non-click after impression. Weight accordingly. A single non-click should barely register. Twelve non-clicks with high impression quality (above-fold, good thumbnails, multiple sessions) should matter significantly.

**Category vs. item level.** Negative signals at the content-item level are less durable than at the category/tag level. A specific video that the user abandoned might just be a bad video. A pattern of abandonment across a tag is a preference signal. Aggregate before applying.

**Don't negative-signal your way out of discovery.** If avoid signals are applied as hard filters, new content in adjacent categories never gets a shot. Apply them as strong soft constraints rather than exclusions for anything except explicit dislikes. The system should be able to override a weak avoid signal with a strong positive relevance signal.

{% callout(type="question") %}
How do you distinguish "user doesn't like crime documentaries" from "user doesn't like crime documentaries at 7am on a Tuesday"? Context-conditioned negative signals are an open problem. Time-of-day and device-type conditioning on negative signals is underexplored.
{% end %}

## What's Actually New Here

This isn't a novel idea in the research literature. The concept of implicit negative feedback has been in the academic record for twenty years.

{{ cite(key="jawaheer2010", title="Comparison of Implicit and Explicit Feedback from an Online Music Recommendation Service", authors="Jawaheer et al.", year="2010", url="https://dl.acm.org/doi/10.1145/1869652.1869658") }}

{{ cite(key="pan2008", title="One-Class Collaborative Filtering", authors="Pan et al.", year="2008", url="https://ieeexplore.ieee.org/document/4781145") }}

{{ cite(key="hu2008", title="Collaborative Filtering for Implicit Feedback Datasets", authors="Hu, Koren & Volinsky", year="2008", url="https://ieeexplore.ieee.org/document/4781121") }}

The Hu/Koren/Volinsky paper from 2008 is the canonical reference — it formalises the confidence-weighted approach to implicit feedback and explicitly addresses the non-exposure problem. It's nearly two decades old. It is still not implemented correctly in most production systems I've seen.

{{ cite(key="liang2016", title="Modeling User Exposure in Recommendation", authors="Liang et al.", year="2016", url="https://dl.acm.org/doi/10.1145/2872427.2883090") }}

Liang et al.'s exposure model from 2016 is the more rigorous treatment — they propose explicitly modelling whether a user was exposed to an item as a latent variable, rather than treating all non-interactions as equivalent. This is the right framing. It's also genuinely hard to implement at scale, which is why teams reach for the heuristic approximations instead.

What *is* relatively new is the operational emphasis on avoid signals as a first-class profile attribute, stored alongside positive preferences, maintained by the same pipelines, respected upstream of retrieval. Most architectures bolt negative signal handling onto ranking as an afterthought. Moving it to retrieval-time filtering on a pre-computed avoid list is the engineering shift that makes it practical.

## Open Questions

The literature and production experience leave several things genuinely unsolved:

**Context-conditioned negative signals.** The same user may want different content types on mobile at 8pm versus desktop on a Sunday afternoon. Negative signals are context-sensitive but most implementations store them as global preferences. Is "avoid true crime" a preference, or "avoid true crime at breakfast"? The data to answer this requires cross-dimensional impression logging that's expensive to build.

**Cold-start symmetry.** New users have no negative signal history. The cold-start problem is usually framed around lack of positive history — but new users also have no behavioural data to build avoid lists from. Over-recommending dominant categories in the absence of negative signal means new users get whatever the most popular content is, which is often not what they want. The cold start problem has a negative signal dimension that's underappreciated.

**Creator response dynamics.** If avoid signals cause a creator's content to be systematically surfaced less, the creator optimises for higher engagement early — shorter hooks, more clickbait. The measurement changes the measured behaviour. Long-term, avoid signals may incentivise content that passes the 60-second threshold without being inherently valuable. You're optimising against a signal that the ecosystem will adapt to.

**Negative signal forgetting.** When should a strong negative signal expire? Users change. Content evolves. The horror film genre a user avoided at twenty may be what they're actively seeking at thirty. Negative signals need principled expiry, not just recency decay — but principled expiry requires knowing *why* the negative signal was generated, which we usually don't.

## The Bigger Picture

Recommendation systems are measurement systems before they're ranking systems. The ranking is only as good as what you measure.

For fifteen years, the industry has been measuring applause — clicks, plays, watches, listens, purchases. The metrics are clean. The events are easy to log. The attribution is clear. And so we built systems that optimise for applause, which means we built systems that can only learn to give you more of what you clapped for, never less of what you silently endured.

The silence is information. The user who scrolled past forty thumbnails without clicking is expressing a preference with every scroll. The user who opened an app, saw the first screen of recommendations, and closed it again has told you something. You just didn't log it in a way that you could learn from.

The infrastructure cost of fixing this is real — impression logging at scale is not free, joining recommendation logs with engagement logs requires deliberate data engineering, and computing avoid lists for hundreds of millions of users requires a proper batch pipeline. But the alternative is a system that is constitutionally incapable of learning what people *don't* want, which means it will keep recommending it, which means people will keep leaving.

{% callout(type="insight") %}
The best recommendation systems are not the ones with the most sophisticated ranking models. They're the ones that have the most complete picture of what users actually want — and the architectures that enable that completeness treat silence as data, not as the absence of data.
{% end %}

## Bottom Line

Your recommendations are a selection function. Right now, you're selecting from the full content space with a positive-signal-only preference model. That's like choosing a restaurant for someone by learning their favourite cuisines but never learning their allergies.

Add the signal types: abandonment (60s threshold, per category), one-and-done (join your recommendation log to your engagement log, it's the most important join you're not doing), exposed-not-engaged (which requires actual impression logging, so start there), duration caps (per-user, model it, store it), and avoid signals (pre-compute them, cache them, filter on them upstream of ranking).

Weight them with recency decay, confidence tiers, and a soft-constraint approach that preserves discovery. Start conservative — one abandonment is noise, fifteen is signal. Tune from observation.

And for the love of everything, log your impressions. Without that, you're not building a negative signal system. You're building a guess.
