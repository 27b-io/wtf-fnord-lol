+++
title = "Query-Theme-Keyed Search Expansion"
description = "Two users search 'sleep' and get different results — with no LLM at query time. How pre-computed, theme-keyed expansion terms turn a flat search into something that actually knows you."
date = 2026-03-10T15:00:00+11:00

[taxonomies]
tags = ["personalization", "search", "query-expansion", "architecture"]
series = ["tier-2"]

[extra]
reading_time = "8 min"
+++

## The One-Sentence Version

Store the LLM's work on the profile, not in the query pipeline — and suddenly your search engine has opinions about what people mean, not just what they typed.

{% callout(type="tldr") %}
**What:** A personalization pattern where query expansion terms are pre-computed by an LLM and stored on the user profile, keyed by query theme. At search time, zero LLM calls. Just string matching.

**Why it matters:** Latency budget for personalized search is brutal. LLM-at-query-time doesn't fit. Pre-computation moves the cost to profile-update time, which nobody is timing.

**The catch:** Theme detection is unsolved and will humble you. Enjoy.
{% end %}

## The Problem

You're building a health app. Two users search for "sleep."

User A is a 42-year-old with a sleep tracker obsessively logging REM cycles. User B is a shift worker trying not to fall asleep on the drive home.

Your search index has both "sleep hygiene for athletes" and "managing fatigue on rotating shifts." To serve them well, "sleep" needs to expand into different terms for each person.

The naive solution: call an LLM at query time, pass it the user's profile context, get personalized {{ glossary(term="query expansion", def="The process of adding related terms to a user's search query to improve recall. 'sleep' might expand to 'sleep hygiene, circadian rhythm, REM' — or to 'shift work fatigue, microsleeps, alertness' depending on context.") }}, fire the search. Done.

Except you're not done. You've just added a 400-1200ms LLM call to your search path. Your p99 just caught fire. Your infrastructure team is looking at you like you suggested deploying Kubernetes to a toaster.

{% callout(type="warning") %}
LLM-at-query-time is the right *idea* applied at the wrong *moment*. The LLM's insight is valuable. The LLM's latency is not.
{% end %}

## The Approach: Theme-Keyed Pre-Computation

Here's the shift: instead of calling the LLM when the user searches, call it when you know something new about the user.

The {{ glossary(term="profile-to-API mapping", def="The translation layer that converts structured user profile data into API call parameters. In search, this means turning profile attributes into query modifiers, filters, expansion terms, and ranking signals.") }} looks like this:

```json
{
  "user_id": "u-8821",
  "expansion_terms": {
    "sleep": ["shift work fatigue", "alertness", "microsleeps", "rotating roster"],
    "diet": ["high-energy foods", "meal timing for shift workers", "caffeine management"],
    "exercise": ["fatigue recovery", "post-shift workout", "energy management"]
  }
}
```

The `expansion_terms` field is keyed by {{ glossary(term="theme-keyed expansion", def="A query expansion structure where terms are organised by topic theme rather than stored as a flat list. The key is a canonical query theme; the value is the list of expansion terms personalised for that user.") }}. Not a flat list of things the user cares about. Not a bag of tags. A map from query theme → what *this user* means by that theme.

When the user types "sleep," you don't call the LLM. You do this:

```python
def expand_query(query: str, profile: UserProfile) -> list[str]:
    theme = detect_theme(query)  # <-- the interesting part
    return profile.expansion_terms.get(theme, [])
```

Total added latency: microseconds. You're doing a dict lookup.

### The {{ glossary(term="pre-computed search params", def="Search parameters — filters, expansion terms, ranking weights, boost signals — calculated ahead of query time and stored on the user profile. Moved from the query path to the profile update path.") }} Pattern

This is the broader pattern: move expensive computation from query time to profile-update time.

Profile updates happen on signals: workout completed, sleep log saved, article read, preference changed. These are asynchronous, bursty, and nobody is watching the clock. A 2-second LLM call at profile update time is fine. The same call at search time is a user experience catastrophe.

At profile-update time, you run something like:

```python
async def update_expansion_terms(user_id: str, profile: UserProfile):
    # Called when profile changes significantly
    themes = infer_relevant_themes(profile)  # ["sleep", "diet", "exercise"]

    for theme in themes:
        terms = await llm.expand(
            theme=theme,
            user_context=profile.summary(),
            max_terms=6
        )
        profile.expansion_terms[theme] = terms

    await profile_store.save(user_id, profile)
```

The LLM runs once per profile-change event, not once per search. If your user searches for "sleep" forty times today, you pay for exactly one LLM call (when their sleep data was last updated). The other thirty-nine searches are dict lookups.

{% callout(type="insight") %}
This is the same insight behind materialized views in databases — expensive computations don't have to happen at read time if you can afford to do them at write time. The LLM is your expensive computation. The profile store is your materialized view.
{% end %}

## What's New Here

{{ cite(key="manning2008ir", title="Introduction to Information Retrieval", authors="Manning, Raghavan, Schütze", year="2008", url="https://nlp.stanford.edu/IR-book/") }}

Classic query expansion — Rocchio, pseudo-relevance feedback, WordNet synonym expansion — operates globally. Everyone searching "sleep" gets the same expanded terms. The expansion is about the query, not the querent.

{{ cite(key="teevan2005personalizing", title="Personalizing Search via Automated Analysis of Interests and Activities", authors="Teevan, Dumais, Horvitz", year="2005", url="https://dl.acm.org/doi/10.1145/1076034.1076111") }}

Teevan et al. showed in 2005 that personalizing re-ranking improved web search measurably. But re-ranking still requires a candidate set retrieved without personalization. If the shift worker's "sleep" never surface the "rotating roster fatigue" document in the first candidate set, no re-ranking saves you.

Theme-keyed pre-computation attacks the retrieval stage, not the ranking stage. You're expanding at query construction, not at result ordering. This is earlier in the pipeline and more powerful — you're changing what documents get retrieved, not just how they're ordered.

{{ cite(key="chatgpt-rec", title="Is ChatGPT a Good Recommender?", authors="Zhang et al.", year="2023", url="https://arxiv.org/abs/2304.10149") }}

The "LLM as recommender" literature loves putting LLMs on the critical path. Latency be damned, apparently. Theme-keyed expansion is the pragmatist's answer: use LLMs where they're good (semantic understanding, context synthesis), not where they're bad (sub-100ms response time requirements).

## The Unsolved Part: Theme Detection

Here's where I have to stop being smug about the elegant pre-computation trick and confront the thing that will actually kill this in production.

**How do you match an incoming query to a theme key?**

The profile has `expansion_terms["sleep"]`. The user types "I keep waking up at 3am." Is that `sleep`? What about "tired all the time"? "Can't switch off"? "Restless legs"?

Your theme keys are the canonical forms you chose when the LLM generated them. Your queries are whatever your users type, which is a glorious chaos of natural language, typos, colloquialisms, and half-formed thoughts.

{% callout(type="question") %}
**The theme detection problem:** You have a map from theme strings to expansion term lists. You have an incoming query string. How do you find the right key without calling an LLM?
{% end %}

### Option 1: Exact and fuzzy string matching

Dead simple. Normalize the query, check if any theme key appears as a substring. "Can't sleep" hits `sleep`. "Sleeping problems" hits `sleep` after stemming.

Works until it doesn't. "Tired" doesn't hit `sleep` even though it might for your sleep-tracked user. "3am" definitely doesn't.

Recall is terrible. Precision is fine but irrelevant if you're missing most queries.

### Option 2: Embedding similarity

Pre-compute embeddings for each theme key. At query time, embed the query and find the nearest theme key by cosine similarity.

This is better. "Tired all the time" lands near `sleep` and `fatigue`. "Can't switch off" lands near `sleep` and `stress`.

Now you have sub-10ms embedding inference cost, which is acceptable. The issue is threshold calibration — at what similarity score do you trust the match? Too low and you're injecting irrelevant expansion terms (the worst possible personalization: confident and wrong). Too high and you match nothing.

{{ cite(key="karpukhin2020dpr", title="Dense Passage Retrieval for Open-Domain Question Answering", authors="Karpukhin et al.", year="2020", url="https://arxiv.org/abs/2004.12832") }}

DPR showed dense retrieval beating sparse retrieval for QA. Same logic applies here — embedding matching beats keyword matching for theme detection. But you still need the threshold, and the threshold is empirical, meaning you need labeled data, meaning you need... evaluation infrastructure. Fun.

### Option 3: A tiny classifier

If you have query logs, you can build a lightweight classifier (logistic regression, small neural net) that maps queries to theme buckets. Training cost is offline. Inference is microseconds.

The catch: your theme buckets are app-specific and will drift as you add new themes. You're now maintaining a classifier. Infrastructure debt accumulates silently until it explodes on a Thursday.

### Option 4: Cache the LLM call

Detect theme with an LLM on first query, cache the result. Second time the same (or similar) query comes in, use the cached theme.

This is pragmatic and slightly embarrassing, which means it will probably work in production better than any of the elegant alternatives. The LLM handles the hard cases. The cache handles the common cases. Hybrid systems that don't make a strong architectural statement tend to survive.

{% callout(type="insight") %}
The theme detection problem is a microcosm of the whole field: elegant theoretical solutions exist, but the thing that works in production is usually a cache in front of the expensive call you were trying to avoid.
{% end %}

## The {{ glossary(term="search suggestion chips", def="UI elements that appear below the search bar showing related or suggested queries. In a personalized system, these can be pre-generated from the same expansion_terms structure — surfacing the expansion before the user even completes their query.") }} Angle

There's a bonus capability hiding in this data structure: personalized search chips.

If you're showing query suggestions below the search bar, you're already generating them somehow. Usually: static popular queries, trending terms, recent user history.

With `expansion_terms` on the profile, you have per-user, semantically rich query suggestions ready to go. User A sees "sleep hygiene", "REM tracking", "recovery score." User B sees "shift work fatigue", "alertness tips", "microsleep prevention."

Same UI component. Same API contract. Completely different suggestions because the data is pre-computed per user.

This is the "for free" part of getting the architecture right. When you've done the pre-computation work, the surface area of what you can build on top expands significantly with no additional inference cost.

## Results

What does "better search" actually look like here? Depends on what you're measuring.

**Retrieval recall** on long-tail personalized queries should improve — you're surfacing documents that keyword search would miss because the user's phrasing doesn't overlap with document vocabulary.

**Click-through rate** on search results is the closest proxy metric to "did we give you what you wanted." A/B testing theme-keyed expansion against baseline should show improvement for users with rich profiles and degrade to baseline for new users with empty `expansion_terms`.

The degradation-to-baseline property is important: this is a graceful system. If there are no expansion terms for a theme (new user, uncovered theme), the query goes out unexpanded. You're not failing, you're being appropriately humble.

**Latency** should be flat — you added microseconds of dict lookup overhead and removed 400-1200ms of LLM inference. This is one of those rare cases where the more sophisticated solution is also the faster one.

## Bigger Picture

This pattern generalizes beyond search. Any time you're tempted to call an LLM on the hot path — recommendation ranking, content filtering, UI personalization — ask: can this computation be moved to write time?

The LLM's insights are durable. A user's relationship to "sleep" as a concept doesn't change minute to minute. It changes when they log a terrible sleep week, when their life circumstances shift, when they complete a course on sleep hygiene. Those are profile-update events.

The query pipeline needs to be fast because users are watching. The profile-update pipeline can be thoughtful because nobody is watching. Route expensive cognition accordingly.

{% callout(type="insight") %}
LLMs are not databases and should not be queried like databases. They are batch-friendly computation engines that happen to speak natural language. Design your systems accordingly: let them batch, let them be async, let them be slow — just not at query time.
{% end %}

The broader personalization architecture implied here looks like:

```
User signal (sleep log, article read, preference set)
  → Profile update event
  → LLM enrichment (async, bursty, fine to be slow)
  → Structured profile fields (expansion_terms, filters, weights)
  → Stored on profile

User query
  → Profile fetch (fast, cached)
  → Theme detection (fast, embedded or cached)
  → Expansion terms applied (dict lookup)
  → Search API call (with pre-computed params)
  → Results
```

The LLM is in the left branch. The query is in the right branch. They never meet.

## Open Questions

**How do you handle theme drift?** If a user's sleep patterns change significantly, when do you re-compute their sleep expansion terms? Every profile update is expensive if profiles update frequently. Some form of change detection — "did the user's sleep data change enough to warrant re-expansion?" — is needed but non-trivial.

**What's the right granularity for theme keys?** `sleep` is a theme. `sleep > sleep onset` vs `sleep > sleep duration` vs `sleep > sleep quality` might be more precise but multiplies your theme space. Too coarse and expansion is generic. Too fine and nothing matches.

**Can expansion terms conflict with each other?** If a user has themes `sleep` and `stress` and queries "exhausted," both might match. If both inject expansion terms, do they compose helpfully or fight each other? You need a merge strategy, and "concatenate everything" probably isn't it.

**How do you evaluate the pre-computed expansions themselves?** You can A/B test the system, but that tells you whether the architecture helps. It doesn't tell you whether the LLM generated *good* expansion terms. You need a way to audit: are these the right expansions for this user and this theme? This is a labeling problem and nobody wants to hear that.

## Bottom Line

Theme-keyed query expansion is a practical pattern for teams who want personalized search but can't afford LLM latency on the critical path. The core trade is straightforward: move expensive semantic computation to profile-update time, store the results in a queryable structure, apply them at search time with trivial overhead.

The theme detection problem is real and will require iteration. Embedding similarity is the pragmatist's starting point. A cache-with-LLM-fallback is probably your production solution.

The bigger principle is more important than the specific implementation: **LLMs belong in your async pipelines, not your synchronous request handlers.** Every time you put an LLM on a hot path because it's the easiest way to get intelligence into a response, you're trading user experience for architectural convenience. Pre-computation is the discipline of refusing that trade.

It's more work upfront. It's a better system.

---

*This article is part of the Tier 2 series — practical patterns for production AI systems, with opinions about why most implementations get it wrong.*
