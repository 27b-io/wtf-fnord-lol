+++
title = "Pre-computed Personalization: The Offline Agent Pattern"
description = "Why your personalization agent should never run at request time. The LLM does its heavy lifting on a schedule; your product serves the artifacts. Zero latency, infinite scale."
date = 2026-03-10

[taxonomies]
tags = ["personalization", "architecture", "llm-agents", "offline-computation"]
series = ["foundational-patterns"]

[extra]
reading_time_original = "~15 min"
+++

## The One-Sentence Version

Stop running your personalization LLM at query time — run it on a schedule, cache the artifacts, and serve lookups.

{% callout(type="tldr") %}
**What:** Pre-compute personalization artifacts (search params, ranked themes, notification triggers) with an LLM agent running on a cadence. Store the results as profile data. At request time, read the profile. No LLM involved.
**Why it matters:** Latency drops to microseconds. Costs drop by orders of magnitude. Reliability climbs dramatically. The LLM is no longer on the critical path.
**The trick:** Separate the *reasoning* step (slow, expensive, offline) from the *serving* step (fast, cheap, online). Netflix and Spotify have done this for a decade with collaborative filtering. You can do it with language models.
**The cost:** Staleness. Pre-computed = potentially stale. The entire design challenge is cadence.
{% end %}

## The Problem: You Built a Personalization Agent, and It's Your Bottleneck

You have a recommendation surface. Maybe it's a content feed. Maybe it's a search interface that wants to pre-populate filters based on the user's interests. Maybe it's a notification system that wants to know which topics to alert about and which to silently discard.

You reached for an LLM because the semantic understanding is genuinely hard. Collaborative filtering gives you "users like you also liked" — it doesn't give you "this user spent twelve minutes reading about hexagonal architecture last Tuesday, which means they're probably building something non-trivial in the next sprint and would benefit from practical infrastructure content." That kind of inference requires language.

So you built a {{ glossary(term="request-time inference", def="Any LLM call that sits on the critical path between a user action (button press, page load, search query) and the system's response. If the LLM is slow or unavailable, the user waits.") }} agent. The user opens your app. You call the LLM. The LLM thinks about their history. The LLM returns personalized context. The product renders.

And now you have:

- **300–2000ms of LLM latency** on every meaningful page load
- **A hard dependency** on an external API your uptime SLA doesn't control
- **Costs that scale linearly** with your DAU (which is exactly what you don't want)
- **A rate-limiting cliff** you'll hit at growth that'll take three weeks to negotiate around
- **Debugging nightmares** because the personalization is non-deterministic and stateless

The patient is presenting with fever, elevated costs, and a retrospective full of "the LLM was slow again." The diagnosis is architectural. You put your inference engine on the critical path and now you're surprised it's blocking traffic.

{% callout(type="warning") %}
If your personalization LLM is in the request-response loop, you've made a decision that will cost you eventually. It's not if. It's when — usually around the first traffic spike, the first API outage, or the first time your CFO looks at the inference bill.
{% end %}

## The Pattern: Offline Agent + Profile Artifacts

The fix isn't to make your LLM faster. The fix is to move it off the critical path entirely.

Here's the architecture:

```
OFFLINE LAYER (runs on schedule)
┌─────────────────────────────────────────────────────┐
│  User Activity Stream                               │
│        ↓                                           │
│  Offline Agent (LLM)                               │
│    - reads recent activity window                  │
│    - semantic summarization                        │
│    - generates profile artifact                    │
│        ↓                                           │
│  Profile Store (Redis / DynamoDB / Postgres)       │
└─────────────────────────────────────────────────────┘
              ↕ periodic write (daily/weekly)

ONLINE LAYER (runs at request time)
┌─────────────────────────────────────────────────────┐
│  User Request (page load / search / notification)  │
│        ↓                                           │
│  Profile Lookup (< 5ms)                            │
│        ↓                                           │
│  Serving Logic (deterministic, no LLM)             │
│        ↓                                           │
│  Response                                          │
└─────────────────────────────────────────────────────┘
```

The {{ glossary(term="offline agent", def="An LLM agent that runs on a schedule (cron, event-driven, or periodic batch) rather than in response to user requests. Its outputs are stored as artifacts that the online serving layer reads without invoking the LLM.") }} does the hard work: reads the user's activity history, applies semantic understanding, and produces a structured {{ glossary(term="profile artifact", def="A structured data object (JSON, msgpack, protobuf) generated by an offline agent that encodes personalization state. Think: {preferred_content_types: [...], search_params: {...}, notification_triggers: [...], computed_at: <timestamp>}.") }}. That artifact gets stored. When the user does anything, the serving layer reads the artifact from cache and acts on it immediately.

No LLM in the loop. No waiting. No rate limits. No bill that surprises anyone.

### What Goes in a Profile Artifact?

Whatever your product needs to serve without thinking. For a content platform:

```json
{
  "user_id": "u_abc123",
  "computed_at": "2026-03-10T02:00:00Z",
  "cadence": "daily",
  "content_preferences": {
    "high_affinity_topics": ["distributed-systems", "rust", "observability"],
    "low_affinity_topics": ["blockchain", "no-code"],
    "preferred_depth": "technical",
    "preferred_length_percentile": 75
  },
  "search_defaults": {
    "implicit_filters": ["exclude_paywalled", "published_last_6mo"],
    "boost_signals": ["has_code_examples", "has_benchmarks"]
  },
  "notification_config": {
    "trigger_topics": ["rust-async", "k8s-operators"],
    "suppress_topics": ["job-listings", "conference-cfps"],
    "quiet_hours_utc": [22, 8]
  },
  "semantic_summary": "Senior engineer actively exploring Rust for systems work, currently running k8s in production, interested in observability tooling"
}
```

That semantic summary at the bottom? That's the LLM's contribution. Everything else is derived from it or from simple aggregates. The LLM looked at a week of reading history and produced a coherent, useful description. The serving layer can use that summary for downstream tasks — including, ironically, prompting a smaller/faster LLM for edge cases without the full history attached.

{% callout(type="insight") %}
The semantic summary is the secret weapon. It collapses weeks of behavioural history into a handful of tokens that any downstream model can consume cheaply. You're paying the full LLM cost once, then amortizing it across every request until the next refresh. That's the leverage.
{% end %}

## Cadence Design: The Freshness Tradeoff

This is where you actually earn your architectural salary.

{{ glossary(term="pre-computed personalization", def="A personalization approach where user models are built in advance (offline) rather than at request time. Trades freshness for speed, cost, and reliability.") }} has exactly one meaningful downside: staleness. The profile you serve today reflects what the LLM knew about the user yesterday (or last week, or last month). If a user's interests shift overnight — maybe they got a new job, started a new project, went down a completely different rabbit hole — your offline artifact won't know until the next compute cycle.

The pragmatic answer is segmented cadence:

| Segment | Cadence | Rationale |
|---|---|---|
| **Active users** (opens app daily) | Daily (overnight) | High activity = frequent signal; daily refresh keeps pace |
| **Semi-active users** (3–5x/week) | Every 3 days | Lower signal density; reduced compute cost |
| **Dormant users** (< 1x/week) | On-open trigger | Don't burn compute on users who aren't there; compute on return |
| **New users** (< 7 days old) | After each session | High novelty; early signals are disproportionately informative |

"On-open trigger" for dormant users deserves attention. When a dormant user opens the app, you trigger an async compute job. You serve them either a stale artifact (acceptable; they've been away) or a default experience (also acceptable; they won't notice) while the job runs. By their second interaction — often within the same session — you've got fresh context. The user experience is fine. The compute cost is controlled.

{% callout(type="question") %}
What if a user's interests change between compute cycles? They do, and that's fine. The error mode you're protecting against isn't "slightly stale recommendations." It's "LLM outage takes down your recommendation surface" or "latency spike during peak traffic makes your app feel broken." Slightly stale is a much better failure mode than none.
{% end %}

### Temporal Windows

{{ glossary(term="temporal windows", def="The time range of user activity fed to the offline agent for computation. Choosing the right window balances recency (short window) against signal richness (long window).") }} are the other design variable. How much history does the agent see?

- **Too short (last 24h):** Noisy. A user who rage-read three articles about a bad framework isn't interested in that framework; they're interested in avoiding it. Single sessions are unreliable.
- **Too long (last 6 months):** Diluted by stale preferences. What a user cared about in September may not predict what they want in March.
- **Sweet spot (2–4 weeks):** Captures genuine interest trends while remaining responsive to shifts. Adjust based on your content freshness and user activity patterns.

A common refinement: weight recent activity more heavily. Give the last 7 days 60% of the signal weight, days 8–21 the remaining 40%. Simple, but it meaningfully improves artifact quality for users in transition.

## What's New: LLMs Make This Qualitatively Different

Collaborative filtering has been doing something like this for twenty years. Netflix pre-computes user embeddings nightly. Spotify's Discover Weekly runs on Sunday. Nothing new there.

What's new is the *semantic* layer.

Traditional offline systems generate numeric vectors. They're powerful but opaque — the model knows "users who watched A tend to like B" but it can't explain the thematic or conceptual relationship. More importantly, it can't bridge vocabulary gaps. A user who reads "k8s observability" articles and a user who reads "monitoring distributed systems" articles might have identical interests, but keyword-based collaborative filtering won't connect them.

The {{ glossary(term="semantic summarization", def="Using an LLM to produce a natural-language or structured summary of a user's behavioural history that captures intent, interest, and context — not just surface-level keywords or item IDs.") }} step is where LLMs change the game. The model reads the user's content history as *text* — with full comprehension of meaning, context, and implication — and produces a structured summary that captures intent rather than just pattern. That summary can then be used as a retrieval key, a prompt fragment, or a first-class feature in downstream models.

This is the capability transfer that matters: you get the semantic understanding of a frontier LLM without paying frontier-LLM prices on every request. You pay once, per user, per compute cycle. The rest is lookups.

{% callout(type="insight") %}
Think of the offline agent as doing {{ glossary(term="semantic summarization", def="Using an LLM to produce a natural-language or structured summary of a user's behavioural history that captures intent, interest, and context — not just surface-level keywords or item IDs.") }} at the user level rather than the document level. Document summarization is solved. User interest summarization — converting raw behavioural streams into comprehensible, actionable intent models — is the next thing to actually be useful.
{% end %}

## Open Questions

**How do you handle profile cold-start?**
New users have no history. You serve default artifacts until you have enough signal for a meaningful compute. The threshold is probably 3–5 meaningful interactions. Before that, you're in editorial/trending territory anyway. After that, you schedule the first compute.

**What's the right artifact schema?**
This is product-specific, but the principle is: make it as concrete as your serving layer needs and no more abstract. If your search surface needs boost signals, put boost signals in the artifact — not abstract "interest vectors" that require downstream interpretation. Reduce inference at serve time to zero.

**How do you handle multi-device / multi-session state?**
Profile artifacts are keyed by user, not session. The offline agent aggregates across all sessions in the window. This is almost always what you want — you're building a user model, not a session model.

**What happens when the offline job fails?**
You serve the stale artifact. Or you serve defaults. Either is better than returning an error or burning latency on a degraded LLM call. Build the failure mode explicitly. Test it. Add a `computed_at` field to every artifact and alert when it ages past your SLA.

**Can you use a smaller model for the offline compute?**
Yes, and you should experiment with it. The offline job isn't latency-sensitive, so you can afford a slower model. But don't blindly downgrade — the semantic quality of the summary matters for downstream serving. Benchmark on real examples before committing to a smaller model. The compute savings from a 4x cheaper model are real, but not if it halves the quality of your search recommendations.

## The Bigger Picture

This pattern is a specific instance of a general principle: **put expensive computation where it doesn't block user experience**.

It's the same principle behind async job queues, pre-warming caches, and edge CDNs. The innovation — if you can call it that — is applying it to LLM-powered semantic reasoning, which is new enough that people haven't developed the instinct yet. Engineers who would never dream of running a complex ML model in a synchronous request handler are happily firing off GPT calls in their FastAPI routes.

The underlying intuition is that LLMs are *magic*, and magic shouldn't be subject to normal engineering constraints. But they are subject to normal engineering constraints. They're slow, they're expensive, they fail, and they don't scale linearly without cost. Treat them like the computational resources they are, and the offline pattern becomes obvious.

{{ cite(key="netflix-recs", title="System Architectures for Personalization and Recommendation", authors="Xavier Amatriain, Justin Basilico", year="2013", url="https://netflixtechblog.com/system-architectures-for-personalization-and-recommendation-e081aa94b5d8") }}

{{ cite(key="spotify-discover", title="How Spotify's Discover Weekly Works", authors="Sophie Warnes", year="2017", url="https://medium.com/s/story/spotifys-discover-weekly-how-machine-learning-finds-your-new-music-19a41ab76efe") }}

{{ cite(key="lambda-arch", title="How to beat the CAP theorem", authors="Nathan Marz", year="2011", url="https://nathanmarz.com/blog/how-to-beat-the-cap-theorem.html") }}

{{ cite(key="two-tower", title="Sampling-Bias-Corrected Neural Modeling for Large Corpus Item Recommendations", authors="Xinyang Yi et al.", year="2019", url="https://research.google/pubs/pub48840/") }}

There's also a reliability argument that doesn't get made enough. Systems with LLMs on the critical path have a new failure mode that engineers aren't used to: **semantic degradation under load**. When your LLM rate-limits or degrades, your product doesn't fail fast with a 500 — it returns subtly worse results. Users notice this as "the app feeling weird." It's harder to detect, harder to attribute, and harder to explain in a post-mortem than a hard error. Pushing the LLM offline eliminates this failure mode entirely.

## Bottom Line

The offline agent pattern is not clever. It's not novel. It's boring infrastructure thinking applied to a new kind of compute.

The LLM runs on a schedule. It reads the user's history. It produces a structured artifact. The artifact gets stored. The serving layer reads the artifact. Nobody waits for the LLM. Nobody pays for the LLM on every request. Nobody wakes up at 3am because OpenAI had a bad night and now your recommendation surface is returning the same five articles to every user.

Your personalization agent should run at 2am, not at page load. If it's running at page load, you've got the right instinct in the wrong place. Move it.

{% callout(type="tldr") %}
**TL;DR (again, for the skimmers):** Pre-compute your personalization artifacts offline. Store them. Serve lookups at request time. Design cadence based on user activity segments. The LLM's semantic understanding is the value — but it doesn't need to be live to deliver that value.
{% end %}
