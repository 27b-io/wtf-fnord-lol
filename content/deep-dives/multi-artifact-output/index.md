+++
title = "The Multi-Artifact Output Pattern"
description = "One LLM call, multiple output shapes for multiple consumers. Design your schema like a protocol, not an afterthought."
date = 2026-03-10T12:00:00+11:00

[taxonomies]
tags = ["architecture", "structured-output", "llm-integration", "api-design"]
series = ["engineering-deep-dives"]

[extra]
reading_time = "12 min"
+++

## The One-Sentence Version

Stop treating LLM output as a single string to be parsed by one consumer and start treating it as a protocol envelope serving every downstream system simultaneously.

{% callout(type="tldr") %}
**The pattern:** One inference call returns a structured document with multiple typed artifacts — each shaped for a different downstream consumer.
**Why it matters:** Amortises inference cost across your entire system. Eliminates redundant LLM calls. Makes your AI layer auditable by design.
**The gotcha:** Your schema is now a shared interface contract. Change it carelessly and you break multiple consumers at once.
**The payoff:** A `signal` field on every recommendation seed means you can explain, debug, and audit AI decisions without adding a separate explainability layer.
{% end %}

---

## The Problem: One Output, One Consumer, Infinite Calls

Here's the standard LLM integration pattern, circa approximately always:

1. User event fires.
2. Call LLM with user context.
3. Parse the string response.
4. Hand parsed result to one consumer.
5. Three minutes later, a different subsystem needs something from that same context.
6. Call LLM again.
7. Repeat until your inference bill requires a sit-down conversation with finance.

This is not engineering. This is Stockholm syndrome with API tokens.

The underlying assumption — that one LLM call serves one consumer — is baked into every "chat completions" tutorial ever written. It's reasonable for a chatbot. It's a disaster for a system that needs to simultaneously update search state, populate a recommendation carousel, pre-compute notification triggers, and maintain a prose context for debugging.

Consider what actually has to happen when a user interacts with a personalisation-heavy product:

- **Search layer** needs filter parameters: categories, date ranges, quality thresholds, freshness signals.
- **Recommendation engine** needs content seeds: themes, query hints, relevance signals with explanations.
- **Notification system** needs timing and copy context: when to send, what angle to use, what triggered the nudge.
- **Chat/debug layer** needs narrative prose: what the model understood, what it decided, why.

Four consumers. Four formats. One moment of user intent that contains the signal for all of them.

The naive approach: four calls. The correct approach: one call that outputs all four.

---

## The Approach: Schema as Protocol

A {{ glossary(term="multi-artifact output", def="An LLM response structured as multiple typed sub-documents, each shaped for a distinct downstream consumer. The single inference call amortises across all consumers.") }} looks like this in practice:

```json
{
  "schema_version": "2.1",
  "narrative": "The user is in a late-evening reading session, has been engaging deeply with long-form technical content, and shows signals of approaching a decision point on infrastructure tooling. Recommend consolidating their saved items before introducing new topics.",
  "search_personalisation": {
    "boost_categories": ["architecture", "devops"],
    "suppress_categories": ["news", "short-form"],
    "freshness_weight": 0.3,
    "quality_floor": 0.75,
    "time_budget_signal": "deep"
  },
  "recommendation_seeds": [
    {
      "theme": "kubernetes-operator-patterns",
      "query_hint": "kubernetes operator reconciliation loop patterns",
      "filter_hints": {"min_read_time": 8, "content_type": "tutorial"},
      "signal": "User saved 3 K8s operator articles this week, none finished. Consolidation moment.",
      "confidence": 0.82
    },
    {
      "theme": "gitops-flux-vs-argocd",
      "query_hint": "flux vs argocd production comparison 2024",
      "filter_hints": {"content_type": "comparison"},
      "signal": "Infrastructure tooling research pattern detected across last 14 days.",
      "confidence": 0.71
    }
  ],
  "notification_context": {
    "send_window": "next-morning",
    "copy_angle": "consolidation",
    "triggers": ["unfinished-series", "decision-proximity"],
    "suppression_reason": null
  }
}
```

This is a {{ glossary(term="structured output", def="LLM response constrained to a predefined schema, typically JSON. Enables programmatic consumption without fragile string parsing.") }} envelope. Every field has a defined consumer. Every consumer gets exactly the shape it needs. Nothing is parsed from prose by downstream systems that shouldn't be doing NLP.

The critical field is `signal` on each {{ glossary(term="recommendation seed", def="A structured hint to a recommendation engine: a theme, query suggestion, filter parameters, and crucially a human-readable explanation of why this recommendation was generated.") }}. That's not there for the recommendation engine — it doesn't need it. It's there for humans debugging why the system recommended what it did. It's there for audit logs. It's there for the product manager who wants to understand why 40% of users are getting infrastructure content on Tuesday evenings.

The `signal` field is your system explaining itself. You get explainability for free, at the point of generation, without a second model call.

---

## The Artifacts in Detail

### `narrative` — The Prose Layer

{{ glossary(term="narrative", def="The prose artifact in a multi-artifact output. A human-readable summary of the model's reasoning and understanding, serving debugging, logging, and chat interfaces.") }}

This is the artifact most developers instinctively reach for: a plain text string explaining what the model understood. In a single-artifact world, this *is* the output. In a multi-artifact world, it's one lane among several.

The narrative serves:

- **Chat interfaces** that surface reasoning to the user
- **Debug logs** where you need readable summaries without deserialising JSON
- **Error triage** — when something downstream breaks, the narrative tells you what the model thought it was doing

Tempting mistake: using the narrative as the source of truth for downstream parsing. Don't. If your search layer is regex-matching the narrative for category names, you've built technical debt into the most unstable part of the output. That's what `search_personalisation` is for.

### `search_personalisation` — Pre-Computed API Parameters

These are ready-to-use parameters for your search API. Not themes. Not vibes. Actual filter values, boost weights, and quality floors that your search layer can apply without interpretation.

The key design principle: the LLM does the semantic reasoning *once*. The search layer does zero semantic reasoning — it receives computed parameters and executes. This is the separation of concerns you actually want. The LLM is not fast at query time. Your search API should be.

```python
# What you want at query time:
results = search_client.query(
    q=user_query,
    **response.search_personalisation  # just apply it
)

# What you don't want:
narrative = response.narrative
categories = extract_categories_somehow(narrative)  # cursed
```

### `recommendation_seeds` — Typed Hints with Explanations

Each seed is a structured suggestion to your recommendation engine: here's a theme worth surfacing, here's a query that'll find relevant content, here's a filter set, and here is *why this exists*.

The {{ glossary(term="signal field", def="A human-readable explanation attached to a recommendation seed, explaining why that recommendation was generated. Enables auditing and debugging of AI decisions without a separate explainability layer.") }} is the part that makes this pattern worth writing about. It encodes the reasoning at the moment of generation, when the model has full context and can produce an accurate explanation. By the time a human is debugging a recommendation three days later, that context is gone. The signal preserves it.

Auditing becomes: `SELECT signal FROM recommendation_events WHERE user_id = ? AND content_id = ?`. No secondary inference call. No "reconstruct the reasoning" engineering sprint. Just a string that was written when the decision was made.

### `notification_context` — Trigger Logic, Not Copy

This is the one that catches people out. The temptation is to put notification *copy* in here — the actual text of the push notification. Don't. That's a different system's responsibility, and it changes too fast (A/B tests, localisation, copy resets) to bake into an inference output.

What this artifact carries: *when* to notify, *what angle* to take, *what triggered the nudge*, and crucially, *why to suppress if applicable*. The notification system receives a brief with enough context to generate or select copy — it does not receive a draft it has to commit to.

---

## What's New Here

None of the individual techniques are new. Structured output has existed since JSON mode arrived in the major APIs. Pre-computing parameters at inference time is obvious in retrospect. Attaching explanations to recommendations is a basic explainability technique.

What's new is treating them as a unified pattern with a name and an explicit design philosophy:

**The LLM output is a protocol, not a value.**

When you call an LLM and get a string back, you have a value. One thing. When you call an LLM and get a versioned, typed, multi-consumer document back, you have a protocol. Multiple things, explicitly contracted, with a schema version that all consumers can check.

{% callout(type="insight") %}
The mental model shift: stop thinking about LLM calls as function calls that return one answer. Start thinking about them as event publishers that emit a structured event consumed by multiple subscribers. Your AI layer is a message bus, not a calculator.
{% end %}

This shift has real engineering consequences. Protocol design practices apply:

- **Schema versioning** becomes mandatory, not nice-to-have
- **Backward compatibility** is a constraint when adding fields
- **Consumer contracts** should be documented, not inferred
- **Validation** happens at the protocol boundary, not scattered through consumers

---

## The Key Tension: Token Efficiency vs. Redundancy

Here's the thing nobody wants to admit about multi-artifact output: some information appears in multiple artifacts, and that costs tokens.

The `narrative` might mention "user is researching infrastructure tooling." The `recommendation_seeds` signal fields will say the same thing with more specificity. The `notification_context` copy angle encodes it implicitly. You're paying for three representations of one insight.

{% callout(type="warning") %}
**The redundancy trap:** In production, multi-artifact schemas tend to grow. Teams add fields. Signal explanations get longer. Narratives get more detailed. If you're not actively managing token budget against output quality, you will drift toward paying 3x for marginal gains in one artifact.
{% end %}

The honest answer is: some redundancy is load-bearing. The narrative exists because humans read it and it needs to be coherent on its own. The signal field exists because it needs to be self-contained for audit purposes. They overlap by design.

The practical heuristic: **redundancy between machine-consumed artifacts is waste; redundancy between human-consumed and machine-consumed artifacts is documentation.** Your search layer doesn't need the narrative. Your debugging engineer does.

Where you can eliminate waste: don't repeat structured data as prose. If `search_personalisation.boost_categories` is `["architecture", "devops"]`, the narrative doesn't need to list them. Reference the concept; don't re-enumerate the values.

---

## Schema Versioning: The Shared Contract Problem

{{ glossary(term="downstream consumer", def="Any system that reads and acts on part of an LLM's output. In the multi-artifact pattern, multiple downstream consumers each depend on different artifacts of the same response.") }}

When one output feeds multiple downstream consumers, a schema change breaks multiple systems simultaneously. This is the distributed systems versioning problem, now applied to LLM output.

Concretely:

- Search layer expects `search_personalisation.boost_categories` as an array of strings.
- You rename it to `search_personalisation.category_boosts` for clarity.
- Search layer silently ignores the new field. Personalisation degrades. Nobody notices for three days.

The mitigation is boring and necessary: `schema_version` as a top-level field, validation in every consumer, alerts on version mismatch, explicit migration windows.

{% callout(type="question") %}
**Open question:** Do you version the whole envelope or individual artifacts? If the notification schema changes but search doesn't, should the search consumer care? The answer depends on whether your consumers are deployed independently — if they are, per-artifact versioning is worth the complexity overhead.
{% end %}

What you should not do: use the LLM itself to detect schema changes. "Ask the model if the output looks like the old format" is a strategy that will betray you in production, at 3am, during a deployment. Schema validation is a serialisation problem. Solve it with a serialisation library.

Pydantic for Python. Zod for TypeScript. Pick one. Use it. The schema is a contract; enforce it at the boundary.

---

## Open Questions

A few things I don't have clean answers to:

**How much signal is too much?** The `signal` field on recommendation seeds is invaluable for debugging, but it can become a liability. A very detailed signal is a very detailed explanation of your personalisation logic, sitting in a database, accessible to anyone with a query. Data minimisation is a GDPR concern. What's the minimum signal that's still useful for audit?

**When does multi-artifact output become a caching problem?** If the same user context generates the same artifacts twice, you've paid for inference twice. There's an argument that heavy multi-artifact calls should be cached by context hash, with a TTL calibrated to how fast user state changes. This is upstream of the pattern but shapes how you'd deploy it.

**How do you test multi-artifact outputs?** Unit testing LLM outputs is famously underdefined. With a single string, you can check for keywords. With a multi-artifact document, you have structural assertions (does this field exist, is it the right type) and semantic assertions (does the signal make sense given this user context). The structural assertions are trivially automatable. The semantic ones are still a human job or require a second model call as judge — which somewhat ironically is a single-artifact call.

**Schema drift in long-running systems.** Models change. The same prompt against GPT-4o today versus GPT-4o-mini tomorrow versus whatever comes next produces structurally similar but semantically drifting output. If your `recommendation_seeds.confidence` values have quietly shifted range — 0.7 used to mean "fairly confident" and now means "just above random" — your downstream systems are wrong and you won't know it. Confidence calibration and output distribution monitoring are not optional in production.

---

## The Bigger Picture

The multi-artifact output pattern is a specific instance of a broader shift: LLMs as infrastructure components, not user-facing features.

When LLMs were chat interfaces, one-output-per-call made sense. The output *was* the product. When LLMs become the reasoning layer in a larger system — personalisation, search, recommendations, notifications — the output is an internal message. And internal messages in distributed systems are typed, versioned, and explicitly contracted.

{% callout(type="insight") %}
The companies that will build durable AI systems are the ones that treat LLM output with the same engineering rigour they'd apply to a Kafka message schema or a gRPC proto definition. The ones that treat it as a string to be parsed with ad hoc logic are building systems that will become unmaintainable the moment the model version increments.
{% end %}

This also has implications for how you think about context. Every token of input context is an investment that should generate a return. A multi-artifact output maximises that return: the same user context generates structured parameters for search, seeds for recommendations, triggers for notifications, and prose for debugging. Single-artifact output leaves that context value on the table, then reinvests the same context on the next call.

{{ cite(key="openai-structured-outputs", title="Structured Outputs", authors="OpenAI", year="2024", url="https://platform.openai.com/docs/guides/structured-outputs") }}

{{ cite(key="anthropic-tool-use", title="Tool Use (Function Calling)", authors="Anthropic", year="2024", url="https://docs.anthropic.com/en/docs/build-with-claude/tool-use") }}

{{ cite(key="shap-2017", title="A Unified Approach to Interpreting Model Predictions", authors="Lundberg, S. M. & Lee, S.", year="2017", url="https://arxiv.org/abs/1705.07874") }}

{{ cite(key="kleppmann2017designing", title="Designing Data-Intensive Applications", authors="Kleppmann, M.", year="2017", url="https://dataintensive.net/") }}

{{ cite(key="martin2018clean", title="Clean Architecture: A Craftsman's Guide to Software Structure and Design", authors="Martin, R. C.", year="2018", url="https://www.oreilly.com/library/view/clean-architecture-a/9780134494272/") }}

---

## Bottom Line

Design your LLM output schema before you write your prompt. Not after. Not as an afterthought when the second consumer appears and you realise you need to parse the narrative for data that should have been in a structured field all along.

The multi-artifact output pattern is a forcing function for that discipline. When you commit to serving multiple consumers from one call, you have to decide upfront what each consumer needs, what the contract is, how it will be versioned. That's not extra work. That's the work you were going to do eventually, done before the technical debt compounds.

The `signal` field is the part you should steal immediately, even if you adopt nothing else here. Attach a human-readable explanation to every AI decision at the moment it's made. Your future self, debugging a production incident at 2am, will be unable to express adequate gratitude.

One call. Multiple consumers. Schema version in the envelope. Signal on every recommendation. That's the pattern. Everything else is implementation detail.
