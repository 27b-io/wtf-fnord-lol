+++
title = "Signal Fusion: How Semantic, Relational, and Direct Signals Combine to Make Recommendations That Don't Suck"
description = "Every recommendation system that works well is fusing multiple signal types. The ones that don't understand this ship vibes-based retrieval and wonder why users leave. A taxonomy of signals, how they combine, and what the SOTA ecosystem gets right and wrong."
date = 2026-03-12T10:00:00+11:00

[taxonomies]
tags = ["recommendation-systems", "retrieval", "memory", "signals", "architecture"]
series = ["tier-1-opinions"]

[extra]
reading_time = "16 min"
+++

## The One-Sentence Version

A recommendation system that relies on a single signal type — semantic similarity, user history, or popularity — will always be mediocre; the systems that actually work are fusing three or more signal types with learned or tuned weights, and the interesting question is *how*.

{% callout(type="tldr") %}
**The taxonomy:** Recommendation signals fall into three fundamental categories: {{ glossary(term="semantic signals", def="Signals derived from the meaning of content — embeddings, topic models, entity extraction. 'This document is about X.' Strength: handles cold start. Weakness: doesn't know what the user actually wants.") }} (what things *mean*), {{ glossary(term="relational signals", def="Signals derived from connections between entities — co-access patterns, knowledge graphs, social links, Hebbian associations. 'People who liked X also liked Y.' Strength: captures latent preferences. Weakness: popularity bias, cold start.") }} (how things *connect*), and {{ glossary(term="direct signals", def="Signals explicitly provided by the user or system — ratings, bookmarks, importance scores, metadata filters. 'The user said this matters.' Strength: unambiguous intent. Weakness: sparse, requires user effort.") }} (what users *told you*).

**The insight:** No single signal type is sufficient. Semantic signals handle cold start but miss preferences. Relational signals capture behaviour but amplify popularity. Direct signals are precise but sparse. The art is in the fusion.

**The state of play:** The SOTA ecosystem has converged on multi-signal architectures (two-tower models, graph neural networks, hybrid retrieval) but the fusion layer — how you weight and combine signals — remains undertested and undertheorised.
{% end %}

---

## The Problem: Single-Signal Systems Are Everywhere and They're All Bad

Let me paint you a picture. You build a semantic search system. You embed your documents with a good model — say, Snowflake Arctic or BGE-large — and retrieve the top-k most similar results to a query. It works great in demos.

Then you ship it, and a month later your users are drowning in *semantically similar but personally irrelevant* results. The system knows what things mean. It has no idea what the user cares about.

This is the single-signal trap. Each signal type has a fundamental failure mode:

| Signal Type | Strength | Fundamental Weakness |
|---|---|---|
| Semantic (embeddings, topic models) | Understands content meaning | No personalisation, no temporal awareness |
| Relational (collaborative filtering, graphs) | Captures latent preferences | Cold start, popularity bias, filter bubbles |
| Direct (ratings, bookmarks, metadata) | High precision, clear intent | Sparse — most users don't annotate anything |
| Temporal (recency, access patterns) | Captures what's current | Yesterday's important thing ≠ today's |
| Emotional (sentiment, valence) | Captures salience | Highly noisy, culturally variable |

Every system that *works* — Spotify's Discover Weekly, YouTube's recommendation engine, Amazon's "customers who bought" — fuses multiple signal types. The ones that *don't* work are the ones where someone decided that cosine similarity was enough.

## A Taxonomy of Signals

### Semantic Signals: What Things Mean

{{ glossary(term="embedding-based retrieval", def="Using dense vector representations of content (from models like BERT, Arctic, or OpenAI's ada) to find items that are similar in meaning. The backbone of modern search and retrieval systems.") }} is the default starting point. You embed content into a high-dimensional space and use cosine similarity or dot product to find related items.

The magic: it handles synonyms, paraphrases, and conceptual similarity. "How do I fix a leaking tap?" and "plumbing repair for dripping faucet" end up near each other in embedding space even though they share almost no words.

The failure mode: semantic similarity is symmetric and context-free. "Python programming" and "Python snake" are close in some embedding spaces. More critically, two documents about the same topic can have high similarity even when only one is relevant to *this user's* current need.

{{ glossary(term="BM25", def="Best Matching 25 — a classic keyword-based scoring algorithm that considers term frequency, inverse document frequency, and document length. Often outperforms embeddings for exact-match queries and entity lookups.") }} keyword search still matters here. For queries like "error code 0x80070057" or "recipe for dhal with coconut milk," exact keyword matching crushes semantic search. The SOTA approach is hybrid retrieval: semantic + BM25 with {{ glossary(term="Reciprocal Rank Fusion", def="A technique for combining ranked result lists from multiple retrieval methods. For each item, scores = Σ 1/(k + rank_i) across all retrieval methods. Simple, effective, and widely used in hybrid search.") }} (RRF) to merge results.

### Relational Signals: How Things Connect

This is where recommendation systems depart from pure information retrieval. Relational signals capture the *structure* between entities — users, items, memories, concepts.

**Collaborative filtering** is the classic: "users who liked X also liked Y." Matrix factorisation, SVD, and neural collaborative filtering all operate on the user-item interaction matrix. The signal isn't what things *mean* — it's what things are *consumed together*.

**Knowledge graphs** add explicit relationships: "this movie was directed by the same person," "this memory contradicts that memory," "these two topics are related via concept Z." Graph neural networks (GNNs) like {{ glossary(term="LightGCN", def="Light Graph Convolutional Network — a simplified GNN for collaborative filtering that removes feature transformation and nonlinear activation, keeping only the core neighbourhood aggregation. Performs surprisingly well given its simplicity.") }} propagate embeddings through these graphs, letting the structure itself inform recommendations.

**Hebbian associations** are the neuroscience-inspired version: memories that fire together wire together. If two items are consistently retrieved in the same context, their association strengthens. This is implicit — no one creates the relationship explicitly, it emerges from co-access patterns.

In our own work on {{ glossary(term="mcp-memory-service", def="An open-source MCP server providing persistent, semantically searchable memory with knowledge graph relationships, emotional analysis, salience scoring, and Hebbian learning. Used by AI agents for long-term memory.") }}, we model four relationship types:

- **HEBBIAN** — co-access associations (implicit, high-frequency). Weight increases on co-retrieval, decays over time.
- **RELATES_TO** — semantic connections (explicit, user-created)
- **PRECEDES** — temporal/causal ordering
- **CONTRADICTS** — conflicting information between memories

Each relationship type carries different signal weight. A Hebbian association tells you "these memories are contextually linked." A CONTRADICTS edge tells you "one of these is wrong — figure out which." Treating all edges identically is a category error that most graph-based systems commit.

### Direct Signals: What Users Told You

These are unambiguous: ratings, bookmarks, importance scores, explicit tags, metadata filters ("show me only tasks due this week"). Direct signals have the highest precision and the lowest coverage.

The challenge is sparsity. In most systems, fewer than 1% of items have explicit user signals. This creates a vicious cycle: the items with the most signals get recommended most, accumulating more signals, while the long tail stays invisible.

Direct signals are also the only ones that can express *negative* preferences cleanly. Semantic similarity can't tell you "I know what this is and I don't want it." Collaborative filtering can infer disinterest from absence, but absence is ambiguous (maybe they just haven't seen it). An explicit "not interested" or a CONTRADICTS edge is unambiguous.

## Composite Scoring: Where Fusion Happens

{{ glossary(term="Park et al.", def="Reference to 'Generative Agents: Interactive Simulacra of Human Behavior' (Park et al., 2023), which introduced a memory scoring formula for AI agents: score = α_recency × recency + α_importance × importance + α_relevance × relevance. The foundational work that most agent memory systems extend.") }} introduced the canonical memory scoring formula for AI agents:

```
score = α_recency × recency + α_importance × importance + α_relevance × relevance
```

Three signals, linearly combined. Simple, influential, and — in our experience building Prajñā — insufficient for production use.

Here's what we actually ship:

```rust
// Prajna's composite scoring (Park et al. extended)
pub fn composite_score(memory: &MemoryCandidate, weights: &ScoringWeights) -> f32 {
    let relevance = memory.cosine_similarity;         // Semantic
    let recency = recency_score(memory.days_since_access); // Temporal
    let importance = memory.importance_score / 10.0;  // Direct
    let hebbian = memory.hebbian_strength;            // Relational
    let tag_match = if memory.tags_match_query { 1.0 } else { 0.0 }; // Direct
    let contradiction = if memory.is_contradicted { 1.0 } else { 0.0 }; // Relational

    weights.relevance * relevance       // 0.55
        + weights.recency * recency     // 0.20
        + weights.importance * importance // 0.10
        + weights.hebbian * hebbian     // 0.10
        + weights.tag_match * tag_match // 0.05
        - weights.contradiction_penalty * contradiction // 0.05
}
```

Six signals across three categories. The weights are currently hand-tuned (we set relevance at 0.55 because semantic similarity is the strongest single signal, recency at 0.20 because temporal context matters enormously for agent memory, and the rest distributed across importance, Hebbian strength, tag matching, and contradiction penalties).

This is **not** a recommendation system in the traditional sense. It's a *memory retrieval system* for cognitive agents. But the signal taxonomy is identical. The only difference is the item space (memories vs products vs content) and the user model (a single agent vs millions of users).

### What We Extended Beyond Park et al.

Park's original formula has three signals with equal weights (all α = 1). We added:

1. **Hebbian strength** — relational signal that Park didn't have. Co-accessed memories reinforce each other. This creates emergent "topic clusters" that improve retrieval for multi-turn conversations.

2. **Contradiction penalty** — negative relational signal. If memory A contradicts memory B, and B has been superseded, A should be demoted. Park's formula can't express "this memory is *wrong*."

3. **Tag matching** — direct signal that bridges semantic and explicit categories. Tags are metadata, but matching them to query terms is a form of retrieval that doesn't depend on embedding quality.

4. **Non-uniform weights** — Park used equal weighting (α = 1 for all). We found that relevance dominates (0.55) while importance and Hebbian contribute valuable but smaller corrections. Uniform weighting over-emphasises recency relative to relevance for agent memory (agents query about old topics frequently).

5. **Adaptive tuning** — Prajñā Phase 5 includes a self-tuning mechanism that adjusts weights based on retrieval outcome distributions. If the system consistently retrieves memories that get used (measured by response signal extraction), it reinforces the weights that led to those retrievals. If retrieved memories go unused, it dampens those signals.

## The SOTA Ecosystem: Who's Doing What

### Two-Tower Models (Industry Standard)

The dominant production architecture: one tower encodes the user (or query), one tower encodes the item (or candidate). The dot product of their embeddings is the match score. YouTube, Google, Pinterest, and most scaled recommendation systems use variants of this.

The "two towers" naturally fuse signals — user features (history, demographics, context) are compressed into the query tower, item features (content, metadata, popularity) into the item tower. The model learns which signals matter through training on implicit feedback (clicks, dwell time, shares).

**Limitation:** Two-tower models are great at candidate generation (narrowing millions of items to hundreds) but weak at fine-grained ranking where subtle signal interactions matter. Most production systems add a cross-network or reranking stage on top.

### Graph Neural Networks (Academic Darling)

LightGCN, GraphSAGE, KGAT — the GNN family excels at capturing relational signals by propagating embeddings through interaction graphs. A user's embedding isn't just their features; it's their features aggregated with their neighbours' features, and their neighbours' neighbours.

**What they get right:** Relational signal propagation. A new user with two friends who love jazz gets a jazz-biased embedding before they've ever listened to anything. Cold start partially solved.

**What they get wrong:** Most GNN architectures treat all edges identically. A "purchased" edge, a "viewed" edge, and a "returned" edge carry different signals. Systems like {{ glossary(term="RGCN", def="Relational Graph Convolutional Network — a GNN variant that learns separate weight matrices for different edge types, allowing the model to treat 'purchased' and 'viewed' relationships differently.") }} (Relational GCN) address this with typed edges, but the computational cost scales linearly with the number of relation types.

### LLM-Based Retrieval (Emerging)

The newest entrant: use an LLM to score relevance directly. The LLM receives the query and candidate items and outputs a relevance score. This implicitly fuses semantic understanding with world knowledge.

**What it gets right:** Nuanced understanding. An LLM can grasp that "I need something to cheer me up" and a comedy recommendation are related, even when the semantic embedding distance is large.

**What it gets wrong:** Cost. Scoring every candidate with an LLM is prohibitively expensive at scale. The practical pattern is semantic retrieval → LLM reranking of top-k, but this means the LLM only sees what the embedding model already surfaced.

### Hybrid Retrieval (What Actually Works)

The convergence point: use multiple retrieval methods in parallel (semantic search, keyword search, metadata filtering, collaborative filtering), merge the result lists with RRF or learned weights, then rerank.

This is what New Computer does with Dot (semantic + BM25 + metadata filtering). This is what mcp-memory-service does (vector search + tag matching + semantic tag search, merged and deduplicated). This is what Prajñā does (embedding-based retrieval from Qdrant, scored with composite weights).

The common pattern:
1. **Candidate generation** — multiple retrieval paths, each contributing candidates
2. **Scoring** — composite function over multiple signal types
3. **Selection** — knee detection or budget-aware cutoff
4. **Injection** — the selected items enter the context

The fusion happens at step 2, and that's where most systems are weakest. Hand-tuned weights (like ours) work but don't adapt. Learned weights require feedback loops that are hard to build in production. Most teams punt on this and use uniform weighting, which is equivalent to hoping all signals are equally important. They aren't.

## What's Actually New

**Not new:** Multi-signal recommendation. The Netflix Prize (2006) was won by an ensemble method. This is nearly twenty years old.

**Not new:** Knowledge graph-enhanced recommendation. Papers like KGAT and RippleNet are 5+ years old.

**Not new:** The Park et al. formula. Published in 2023, already the default starting point for agent memory systems.

**Genuinely novel:** The convergence of recommendation system techniques with agent memory. The insight that an AI agent's memory retrieval problem *is* a recommendation problem — "given this context, which memories are most relevant?" — is still underappreciated. Most agent memory systems are built by NLP people who haven't read the recsys literature, and most recsys people aren't thinking about agent memory.

**Genuinely novel:** Adaptive weight tuning based on downstream usage. Prajñā's Phase 5 adjusts scoring weights based on whether retrieved memories actually get used in responses. This closes the feedback loop that most composite scoring systems leave open.

**Underexplored:** Negative signals. Most systems optimise for what to show. Very few systems have first-class support for what *not* to show. Contradiction edges, explicit "not interested" signals, and supersession relationships (memory B replaces memory A) are crucial for long-lived systems where information becomes stale or wrong.

## Open Questions

**Weight initialisation.** Our weights (relevance 0.55, recency 0.20, importance 0.10, Hebbian 0.10, tags 0.05, contradiction -0.05) are hand-tuned based on qualitative evaluation. There's no principled method for initialising these weights for a new domain. Grid search works but is expensive.

**Signal correlation.** Semantic similarity and tag matching are correlated — high tag match usually implies high semantic similarity. This means the effective contribution of tag matching is less than its weight suggests. Should we decorrelate signals before fusion? PCA on the signal vector? Or just accept the redundancy?

**Temporal dynamics.** The right weight for recency depends on the domain. Agent memory has a different temporal profile than music recommendation, which has a different profile than news. A memory from last week might be crucial; a song from last week is probably stale. Adaptive tuning helps, but cold-start for the weights themselves is unsolved.

**Evaluation.** How do you measure whether your fusion is working? Precision and recall measure retrieval quality, but they don't tell you whether the *weight allocation* is optimal. You can have perfect recall with terrible weights if your candidate set is small enough. We need fusion-specific metrics.

## The Bigger Picture

The recommendation system field and the agent memory field are solving the same problem with different vocabularies. Recsys talks about "user-item interaction matrices" and "candidate generation pipelines." Agent memory talks about "memory retrieval" and "context injection." The underlying maths is identical: score a set of candidates against a query using multiple signals, select the top-k, and present them.

The convergence is already happening:
- **mcp-memory-service** has knowledge graph relationships (HEBBIAN, RELATES_TO, CONTRADICTS) — that's a recommendation system with typed edges
- **Prajñā** has composite scoring with six weighted signals — that's a learned ranking function
- **Dot** (New Computer) has hybrid retrieval with metadata filtering — that's a multi-stage recommendation pipeline

The teams building these systems just don't call them "recommendation systems" because the items are memories, not products. But the architecture is the same. The signal taxonomy is the same. The failure modes are the same.

The next breakthrough won't come from a better embedding model or a cleverer prompt. It'll come from someone who reads both the recsys literature and the agent memory literature and realises they're the same field.

## Bottom Line

**Read this if:** You're building any system that retrieves items for a user (search, RAG, agent memory, recommendations) and you're using a single signal type. You're leaving performance on the table.

**Skip this if:** You already have a multi-signal scoring pipeline with learned or tuned weights. The taxonomy here won't surprise you, though the agent memory angle might.

**The uncomfortable truth:** If your retrieval system doesn't have at least three signal types — one semantic, one relational, one direct — it's not a recommendation system. It's a search engine with aspirations.

---

{% callout(type="insight") %}
The Park et al. formula (α × recency + β × importance + γ × relevance) is the `SELECT * FROM table` of agent memory — technically correct, a reasonable starting point, and completely inadequate for production. Every production system that works well has extended it with additional signal types, non-uniform weights, and negative signals. The question isn't whether to extend it, but how to evaluate whether your extensions are actually helping.
{% end %}

---

**References:**

{{ cite(key="park2023", authors="Park et al.", year="2023", title="Generative Agents: Interactive Simulacra of Human Behavior", url="https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606763") }}

{{ cite(key="kim2024", authors="Kim et al.", year="2024", title="My agent understands me better: Integrating Dynamic Human-like Memory Recall and Consolidation in LLM-Based Agents", url="https://arxiv.org/html/2404.00573") }}

{{ cite(key="wu2025", authors="Wu et al.", year="2025", title="A Survey on the Memory Mechanism of Large Language Model-based Agents", url="https://dl.acm.org/doi/10.1145/3748302") }}

{{ cite(key="zhu2025", authors="Zhu et al.", year="2025", title="Enhancing memory retrieval in generative agents through LLM-trained cross attention networks", url="https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1591618/full") }}

{{ cite(key="recsys-survey", authors="Steck et al.", year="2025", title="A Comprehensive Review of Recommender Systems: Transitioning from Theory to Practice", url="https://arxiv.org/html/2407.13699v4") }}

{{ cite(key="newcomputer2024", authors="New Computer / LangChain", year="2024", title="Improving Memory Retrieval: How New Computer achieved 50% higher recall with LangSmith", url="https://blog.langchain.dev/customers-new-computer/") }}
