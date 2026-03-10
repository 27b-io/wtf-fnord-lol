+++
title = "Pre-computed Personalization: The Offline Agent Pattern"
description = "Why your personalization agent should never run at request time. LLMs as batch jobs, not inline middleware — and why the deeper insight isn't about latency."
date = 2026-03-10

[taxonomies]
tags = ["personalization", "architecture", "llm-agents", "offline-computation"]
series = ["architecture-patterns"]

[extra]
reading_time_original = "8 min"
+++

## The One-Sentence Version

Run your LLM daily, store the results, and serve lookups — because an LLM that runs at 3am before your user wakes up is infinitely faster than one that runs when they tap your app.

{% callout(type="tldr") %}
- Most teams wire LLMs inline at request time. This is expensive, slow, and limits what you can compute.
- The offline agent pattern flips this: LLMs run on a schedule, produce structured profile artifacts, and product surfaces serve cheap lookups.
- The latency argument is obvious. The deeper argument is about *scope* — offline agents can analyze entire user histories; request-time agents can only see one event.
- Staleness is real but manageable. Cadence design (daily/weekly/on-open) is the tradeoff lever.
- Netflix and Spotify solved this for embeddings in 2015. We're now doing it for semantic understanding.
{% end %}

## The Problem — What Everyone Does First

You're building a personalization feature. User opens your app; you want to show them something relevant. The obvious architecture: when the user makes a request, call an LLM, pass in their recent activity, get back recommendations.

This is the {{ glossary(term="request-time inference", def="LLM inference that happens during a live user request — inline, on the critical path, blocking the response.") }} trap. It feels natural because it mirrors how you'd think about a synchronous API call. It is, in practice, a catastrophic way to use an LLM in production.

The problems stack up fast:

**Latency.** A cold LLM call adds 800ms–3s to your response time depending on model and provider. Your product is now limited by OpenAI's p99 latency, your retry budget, and whatever else is going wrong at 2pm on a Tuesday. Users notice 200ms. They absolutely notice 2 seconds.

**Cost.** Every user interaction generates a full inference request. For a product with 100k daily active users who open the app 5x per day, that's 500k LLM calls per day. At $0.003 per call for a mid-tier model, that's $1,500/day, $547k/year, for *personalization context* that mostly doesn't change between sessions.

**Scope limitation.** Here's the one people miss: request-time inference can only see what you pass in its context. You're going to pass the last 10 interactions, maybe 20. You're not going to pass the user's entire 18-month history. Which means your LLM is flying blind on everything that makes personalization actually good — trajectory analysis, behavioral through-lines, the gradual drift from "casual user" to "power user" to "lapsed user."

**Consistency.** Every request generates a fresh inference. The LLM might classify a user's interest differently on Tuesday than Monday. Your UI changes between sessions. This is what "nondeterminism in production" looks like — not impressive AI variability, just confusing product behavior.

## The Approach — Architecture of the Offline Agent

The {{ glossary(term="offline agent pattern", def="Architecture where LLM inference runs on a schedule (daily, weekly), produces structured outputs stored as profile data, and product surfaces read from that data at zero additional latency.") }} inverts this entirely.

The LLM doesn't run when the user shows up. It runs hours before, on a schedule, consuming the user's full history. It produces a structured {{ glossary(term="profile artifact", def="The structured output of an offline LLM run — a JSON object or database record containing pre-computed signals: interest vectors, behavioral tags, recommendation parameters, notification triggers, etc.") }}. That artifact sits in a fast store (Redis, Postgres, wherever your product already reads from). When the user opens the app, you do a database lookup — not an LLM call.

The agent's job is semantic extraction, not recommendation. It's asking: "Given everything I know about this person's history, what structured facts should I pre-compute?" Those facts might be:

- **Interest taxonomy:** `{"cooking": 0.87, "travel": 0.62, "fitness": 0.31}` — not raw interests, but weighted scores across a predefined taxonomy, ready to be joined against content metadata
- **Behavioral stage:** `"power_user"` | `"at_risk"` | `"dormant_recovering"` — lifecycle stage that changes slowly but matters enormously for which features to surface
- **Search parameters:** `{"default_sort": "recent", "prefer_visual": true, "content_depth": "long-form"}` — pre-computed preferences that feed directly into search ranking
- **Notification triggers:** `{"restock_alert": true, "weekly_digest": false, "social_activity": true}` — which notification types this user actually engages with
- **Temporal windows:** `{"active_hours": "19-22", "peak_day": "weekend", "session_length_p50": "8min"}` — when and how they use your product

The LLM's output is a structured JSON object. That's it. Not a summary. Not prose. A machine-readable fact store that your recommendation engine, notification pipeline, and product surfaces can consume directly.

### The System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Scheduler                         │
│  (Airflow / cron / k8s CronJob)                     │
│  Daily @ 3am for active users                       │
│  Weekly for semi-active                              │
│  On-open for dormant                                │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│               Offline Agent Runner                   │
│                                                     │
│  1. Fetch full user history from data warehouse     │
│  2. Apply temporal windows (last 90d weighted)      │
│  3. Call LLM with history + profile schema          │
│  4. Validate output against schema                  │
│  5. Write profile artifact to fast store            │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│                Profile Store                         │
│  (Redis for hot data, Postgres for persistence)     │
│  user_id → ProfileArtifact (JSON, TTL 48h)         │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              Product Surfaces                        │
│  Homepage carousel: read profile.interests          │
│  Search: inject profile.search_params               │
│  Notifications: filter by profile.triggers          │
│  All zero additional LLM latency                    │
└─────────────────────────────────────────────────────┘
```

### Cadence Design — The Only Interesting Tuning Problem

The freshness question is where this pattern gets genuinely interesting. Pre-computed means stale. Stale means your profile is wrong for some percentage of users at any given moment. The question is how wrong, for how long, for how many users — and whether that's acceptable.

The answer is almost always yes, because:

1. **User preferences change slowly.** Interests drift over weeks and months, not minutes. A user who was into sci-fi on Monday is still into sci-fi on Wednesday. The cases where preferences change fast (major life event, explicit preference change) need dedicated signals, not fresher LLM inference.

2. **The alternative is wrong *all the time*.** Request-time inference with a truncated context window is making a worse prediction on every request. Stale-but-comprehensive beats fresh-but-myopic.

3. **Cadence can be event-driven.** You don't have to run on a fixed schedule. Run on user behavior signals: first session after 7-day absence, first session in a new month, immediately after an explicit "not interested" signal. {{ glossary(term="staleness detection", def="Logic that identifies when a pre-computed profile is likely to be incorrect, based on behavioral signals or time thresholds, and triggers an early recompute.") }} lets you treat the schedule as a fallback, not the primary mechanism.

A practical cadence model:

| User Segment | Recompute Trigger | Rationale |
|---|---|---|
| Daily active | 3am UTC daily | Changes fast enough to matter |
| Weekly active | Sunday 3am UTC | Moderate change rate |
| Monthly active | On-open after 7+ day gap | Don't waste compute on dormant users |
| Lapsed (30d+) | On-open, async | One shot to re-engage; worth the compute |
| New user (<3 sessions) | Post-onboarding | No history yet; use defaults |

The "on-open, async" model for lapsed users is worth calling out. You serve a default experience on their first screen (no LLM needed), trigger a background recompute, and their second screen gets the fresh profile. That 800ms LLM call happens in the background, not on the critical path.

## Results/Evidence — The Prior Art

This isn't speculative. Netflix, Spotify, and YouTube have been running this pattern for their recommendation engines for a decade {{ cite(key="netflix2015", title="The Netflix Recommender System: Algorithms, Business Value, and Innovation", authors="Gomez-Uribe, Hunt", year="2015", url="https://dl.acm.org/doi/10.1145/2843948") }}. Their version used embeddings and collaborative filtering rather than LLMs, but the architecture is identical: batch compute runs offline, outputs feed a fast serving layer, product surfaces read from that layer.

Spotify's "taste profiles" — the computed representation of what you like — update periodically, not per-stream. When you hit play, Spotify reads from a pre-computed vector, not a real-time embedding call {{ cite(key="spotify2021", title="Bandits for Recommendation Systems", authors="Mehrotra et al.", year="2021", url="https://dl.acm.org/doi/10.1145/3447548.3470823") }}. The inference that produced your taste profile ran hours or days ago.

The LLM-specific application of this pattern is newer, and concrete numbers are hard to find in public literature because nobody's publishing their personalization architecture. But the cost math is straightforward:

**Request-time inference costs:**
- 100k DAU × 5 sessions/day × $0.003/call = **$1,500/day**
- Annual: **$547,500**

**Offline agent costs:**
- 100k DAU × $0.01/compute run (larger model, longer context) = **$1,000/day**
- But most users aren't active daily. 30% daily active of total base = **$300/day**
- Annual: **$109,500**

That's an 80% cost reduction with a better experience. The offline model uses a more capable model with more context. The request-time model is artificially constrained to stay within latency budgets.

{% callout(type="insight") %}
The cost calculation above undersells the advantage. Request-time inference is constrained to small models and short contexts to hit latency targets. Offline agents can use frontier models with 100k token context windows, because the 30-second inference time doesn't matter if the user isn't waiting. You're trading compute cost for capability ceiling, and the math still works out.
{% end %}

## What's Actually New — Honest Novelty Assessment

The offline agent pattern isn't new. Batch personalization predates LLMs by decades. What's changed is the *semantic richness* of what you can compute offline.

Traditional batch personalization computed statistical signals: "this user clicks on cooking content 40% of the time." That's useful. LLM-powered offline agents can compute *semantic signals*: "this user is in a transitional phase — their recent activity shows them researching lifestyle change topics, consumption has shifted from entertaining content to practical guides, and there's a 73% overlap with our 'major life decision' content cluster. Prioritize actionable, structured content over inspiration porn."

That's not a statistical signal. That's a qualitative interpretation of behavioral trajectory that no amount of collaborative filtering would surface. And it's only possible because you're running a reasoning model with full history access, not a truncated request-time call.

{{ glossary(term="temporal windows", def="Time-bounded slices of user history used as input to an offline agent — e.g., 'last 30 days weighted 2x, last 90 days weighted 1x'. Controls recency bias in profile computation.") }} are the key technique here. A naive implementation passes all history uniformly. A good implementation weights recency: recent behavior matters more than old behavior, but old behavior still provides baseline signal. Tuning these windows is where the interesting work lives.

{{ glossary(term="semantic summarization", def="Using an LLM to compress a long behavioral history into a structured semantic representation — not a prose summary, but a machine-readable profile that captures qualitative intent signals.") }} is the LLM's actual job in this architecture. It's compressing months of behavioral data into a structured representation that's smaller, more useful, and semantically richer than raw event logs.

The genuinely new piece is combining these: using LLMs for semantic understanding of behavior, applied to full-history offline analysis, with structured output that slots directly into existing product surfaces. That combination didn't exist before 2023. The pieces did; the combination is recent enough to still be underexplored.

## Open Questions — Where This Breaks

{% callout(type="question") %}
**The cold start problem:** New users have no history. What does your offline agent output for a user with 2 sessions? Probably garbage — an LLM told to characterize a user from two events will hallucinate confidence it doesn't have. The pattern needs explicit cold-start handling: don't run the offline agent until you have sufficient signal (3-7 sessions?), serve segment-based defaults until then. How do you define "sufficient signal"? That threshold is product-specific and requires empirical tuning.
{% end %}

**Preference shock events.** The staleness argument holds for gradual drift but breaks for sudden changes. User changes jobs; their professional content preferences shift immediately. User has a baby; everything changes overnight. User has a negative experience with your product and is now churning. None of these are well-served by "we'll recompute tomorrow." You need behavioral triggers that recognize shock events and fire immediate recomputes.

**The output schema problem.** Your LLM needs to output to a defined schema. That schema encodes assumptions about what matters. Wrong assumptions get baked in and are hard to change because everything downstream depends on schema stability. Schema evolution in a live system is painful — you're adding versioning, migration logic, and compatibility layers to what was supposed to be a simple batch job. Design the schema slowly and conservatively.

**Embedding vs. LLM offline agents.** For pure behavioral personalization (what content clusters does this user engage with?), embedding-based approaches are faster, cheaper, and more straightforward {{ cite(key="embedding2023", title="The Unreasonable Effectiveness of Recurrent Neural Networks", authors="Various", year="2023", url="https://arxiv.org/abs/1506.02078") }}. The LLM advantage shows up when you need semantic interpretation (why, not just what) and when you want to encode nuanced behavioral signals that don't map cleanly to content vectors. Be honest about which problem you're actually solving before reaching for the heavier tool.

**What happens when the LLM is wrong?** The offline agent produces a profile that's confidently structured but potentially hallucinated. Your product blindly serves that confidence. A request-time agent at least fails on that specific request; an offline agent's errors persist for 24h and affect every session. You need validation, monitoring, and fallback logic — and you need to audit profile distributions periodically to catch systematic errors.

## The Bigger Picture — Implications

The offline agent pattern is one instance of a broader architectural shift: treating LLMs as batch processors rather than online services. The request-time reflex — "when X happens, call an LLM" — comes from thinking of LLMs as APIs. But they're not APIs. They're compute-intensive reasoning engines that happen to expose an API interface.

The right mental model is closer to a data warehouse job: expensive to run, rich in output, best scheduled off-peak. Your product's serving layer reads from the warehouse; it doesn't query it per-request.

This has implications for how AI capabilities get designed into products. Features built on request-time inference have inherent latency floors and cost ceilings. Features built on offline agents have neither — you can make them arbitrarily sophisticated (longer context, better models, more iterations) because nobody's waiting {{ cite(key="gwide2016", title="Wide and Deep Learning for Recommender Systems", authors="Cheng et al.", year="2016", url="https://arxiv.org/abs/1606.07792") }}.

The trend in production ML has been toward pre-computation for exactly this reason. Serving latency is a product constraint. Compute cost is a business constraint. Both push toward offline. The only reason to run inference online is if the answer fundamentally cannot be pre-computed — if it requires information that only exists at request time (the specific query the user typed, the real-time inventory state, the exact moment they're asking). For personalization context, almost none of that is true. The user's interests don't change between 3am and 9am. Their behavioral stage doesn't update mid-session. Pre-compute it.

{% callout(type="insight") %}
The real test for whether something belongs online vs. offline: does the answer change between runs? If a user's interest profile is the same at 3am as it is at 9am, you have no business computing it at 9am when the user is watching. Compute it once at 3am, cache it, serve the cache. Reserve online inference for questions whose answers genuinely change faster than your recompute cadence.
{% end %}

## Bottom Line

Read this if you're designing personalization infrastructure, evaluating where to put LLM inference in your stack, or trying to explain to your platform team why your AI feature costs $50k/month and has a 2 second response time.

Skip this if you're building a product where real-time context is genuinely required — conversational agents, dynamic pricing, anything where the answer at t+5s is materially different from the answer at t. The offline pattern doesn't apply when freshness is a hard constraint, not a tradeoff.

The pattern itself is simple enough to implement in a weekend. The hard parts are schema design, cadence tuning, cold-start handling, and the monitoring you need to catch silent failures. Those aren't problems with the pattern — they're just the actual work of building reliable personalization systems.

Most teams will implement request-time inference first because it's the obvious path. Some of them will hit the latency wall, audit the cost, and rebuild offline. A few will read this first and skip the expensive lesson.

{{ cite(key="spotify2021", title="Bandits for Recommendation Systems", authors="Mehrotra et al.", year="2021", url="https://dl.acm.org/doi/10.1145/3447548.3470823") }}
{{ cite(key="netflix2015", title="The Netflix Recommender System: Algorithms, Business Value, and Innovation", authors="Gomez-Uribe, Hunt", year="2015", url="https://dl.acm.org/doi/10.1145/2843948") }}
{{ cite(key="gwide2016", title="Wide and Deep Learning for Recommender Systems", authors="Cheng et al.", year="2016", url="https://arxiv.org/abs/1606.07792") }}
