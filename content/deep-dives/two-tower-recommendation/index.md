+++
title = "WTF is Two-Tower Recommendation?"
description = "The architecture behind every recommendation system that actually works at scale — why splitting the model in half is the key to serving billions of candidates in milliseconds."
date = 2026-03-11

[taxonomies]
tags = ["machine-learning", "recommendation-systems", "two-tower", "retrieval", "embeddings", "information-retrieval", "ranking"]
series = ["wtf-is"]

[extra]
paper_url = "https://arxiv.org/abs/1606.07792"
paper_date = "2016-09-15"
+++

## The One-Sentence Version

Two-tower (dual encoder) models split the recommendation problem in half — one neural network for users, one for items — so you can precompute item embeddings offline and serve recommendations from billions of candidates in under 10 milliseconds.

{% callout(type="tldr") %}
**What:** Two independent neural networks that encode users and items into the same embedding space. Relevance = dot product between the two vectors.

**Why it matters:** This is how YouTube, Spotify, Pinterest, and every other service with a "recommended for you" section actually works at scale. The trick isn't the model — it's that the architecture makes serving computationally tractable.

**The tradeoff:** The towers can't see each other's features. This means two-tower excels at retrieval (find 1,000 plausible candidates from millions) but needs a separate ranker for fine-grained ordering.
{% end %}

## The Scaling Problem

Imagine you run a meditation app with 200,000 sessions and 5 million users. When someone opens the search page, you need to score every session for that user and return the most relevant ones. That's 200,000 scores per request.

Now imagine you're YouTube with 800 million videos. Or Spotify with 100 million tracks. Scoring every item at query time is O(items) per request, and no amount of hardware makes that fast enough for real-time serving.

The two-tower architecture exists because someone asked: "What if we didn't have to score everything at query time?"

## The Architecture

```
    User Tower                    Item Tower
        │                             │
  [user features]              [item features]
  - watch history              - title embedding
  - demographics               - category
  - recent clicks              - popularity
  - time of day                - creator features
        │                             │
    MLP / Transformer          MLP / Transformer
    (4-8 layers)               (4-8 layers)
        │                             │
  user embedding (d)         item embedding (d)
        │                             │
        └──────── dot product ────────┘
                      │
              relevance score
```

Two separate neural networks — the "towers" — that **independently** encode their inputs into vectors of the same dimensionality (typically 64-256). The relevance score is just the {{ glossary(term="dot product", def="The sum of element-wise products of two vectors. Measures how aligned they are in the embedding space. Higher = more relevant.") }} (or cosine similarity) of the two vectors.

That's it. The entire architecture is designed around one constraint: the towers cannot talk to each other during inference.

## Why Splitting the Model Is the Whole Point

The independence of the towers isn't a limitation — it's the feature. Here's why:

**Item embeddings are precomputed.** You run the item tower offline — once per item, or whenever item features change. Store the resulting vectors in an {{ glossary(term="ANN index", def="Approximate Nearest Neighbour index — a data structure (FAISS, ScaNN, Qdrant, HNSW) that finds vectors close to a query vector without scanning every item. Sublinear time, typically O(log n).") }} (FAISS, ScaNN, Qdrant).

**At query time, you only run the user tower.** One forward pass through a small neural network — a few milliseconds — produces a user embedding. Then you do an ANN lookup against the precomputed item index. The lookup is O(log n), not O(n).

The math: for 100 million items, a brute-force dot product takes ~100ms on a GPU. An ANN lookup takes ~1-5ms on CPU. At 10,000 queries per second, that's the difference between "you need a data centre" and "you need a server."

{% callout(type="insight") %}
The two-tower architecture is fundamentally a *serving* innovation, not a *modelling* innovation. A single combined model that sees both user and item features together would be more accurate. The two-tower model sacrifices accuracy for the ability to actually run at scale. Every recommendation system at production scale makes this tradeoff.
{% end %}

## What Goes in Each Tower

### User Tower

The user tower encodes everything about the user's current context:

- **Interaction history** — recent clicks, watches, purchases. Often processed through a sequence model (transformer, GRU) before feeding into the tower's MLP.
- **Demographics** — age, location, device, subscription status.
- **Contextual signals** — time of day, day of week, session depth.
- **User embeddings** — if you have collaborative filtering embeddings or a user graph, they go here.

The user tower runs online (at query time), so it must be fast. Typically 4-8 MLP layers, sometimes with a lightweight attention mechanism over the interaction sequence.

### Item Tower

The item tower encodes everything about the item:

- **Content features** — title embeddings (from a pretrained language model), categories, tags, duration.
- **Engagement statistics** — global click rate, completion rate, popularity.
- **Creator/publisher features** — follower count, content quality scores.
- **Item embeddings** — collaborative filtering signals, content embeddings.

The item tower runs offline, so it can be more expensive. Some systems use BERT or larger transformers in the item tower because latency doesn't matter at indexing time.

## Training: The Hard Part

The model is trained end-to-end with a contrastive objective. Given a batch of (user, item) pairs:

1. The positive pair is the item the user actually interacted with.
2. {{ glossary(term="Negative samples", def="Items the user did not interact with, used as counterexamples during training. In-batch negatives use other users' positives as negatives. Hard negatives are items that are close but wrong — more informative for learning.") }} are items the user didn't interact with.
3. The loss pushes positive pairs' dot products up and negative pairs' dot products down.

The loss function is usually {{ glossary(term="sampled softmax", def="A softmax computed over a sample of negatives rather than all items. Approximates the full softmax at a fraction of the cost.") }} or a contrastive loss variant:

```
loss = -log(exp(sim(u, i+)) / (exp(sim(u, i+)) + Σ exp(sim(u, i-))))
```

Where you want the model to clearly prefer the positive item over the negatives.

### The Negative Sampling Problem

This is where most two-tower implementations succeed or fail. Random negatives are easy to beat — the model learns to distinguish cats from tractors but never learns to distinguish two similar meditation sessions.

**In-batch negatives**: use other users' positive items in the same training batch as negatives. Simple, free, surprisingly effective for large batch sizes.

**Hard negatives**: items that are similar to the positive but wrong. The model that thinks these are easy to distinguish hasn't learned anything useful yet. {{ cite(key="youtube2019", title="Sampling-Bias-Corrected Neural Modeling for Large Corpus Item Recommendations", authors="Yi et al.", year="2019", url="https://research.google/pubs/pub48840/") }} showed that correcting for popularity bias in negative sampling significantly improves retrieval quality.

{% callout(type="warning") %}
If you train with only random negatives, your model will learn to distinguish popular from unpopular items (trivial) instead of learning fine-grained relevance (useful). Hard negative mining or in-batch negatives with large batch sizes (4096+) are not optional.
{% end %}

## The Retrieve-Then-Rank Pipeline

Two-tower models are almost never used alone. They're the first stage of a multi-stage pipeline:

| Stage | Model | Input | Output | Latency |
|-------|-------|-------|--------|---------|
| **Retrieval** | Two-tower + ANN | User features | ~1,000 candidates from millions | 1-5ms |
| **Pre-ranking** | Lightweight model | User + item features | ~100 candidates | 5-10ms |
| **Ranking** | Full cross-encoder or GBDT | All features, cross-features | Ordered list | 10-50ms |
| **Re-ranking** | Business rules, diversity | Ranked list | Final display | <1ms |

The retrieval stage (two-tower) trades accuracy for coverage. It finds *plausible* candidates. The ranking stage trades coverage for accuracy — it scores fewer items but can use {{ glossary(term="cross-features", def="Features that depend on both the user and the item together, like 'has this user listened to this creator before?' or 'how similar is this item to the user's last 5 interactions?'. These are the most powerful signals for ranking but require seeing both sides.") }} that require seeing both user and item together.

This is why the two-tower's inability to model cross-features isn't fatal. It's not trying to produce the final ranking. It's trying to ensure the right items are *in the candidate set* for the ranker.

## What It Can't Do

Honesty section. The two-tower architecture has real limitations:

**No cross-feature interaction.** The user tower can't see which item it's scoring. "This user has listened to this creator 47 times" is a powerful signal. The two-tower model can't use it at retrieval time — that information lives in the intersection of both sides.

**Popularity bias.** Items that are generally popular produce high-magnitude embeddings that are close to many user embeddings. Without explicit debiasing, two-tower models amplify popularity feedback loops.

**Long-tail blindness.** Items with few interactions have poorly-trained embeddings. The model defaults to content features, which are weaker than interaction signals. Cold-start items effectively get generic recommendations.

**Sequence modelling limitations.** Encoding a user's full interaction history into a single fixed-length vector is lossy. The user who loves jazz *and* true crime podcasts gets averaged into a vector that represents neither well.

## The Alternatives and Extensions

The two-tower model isn't the only game in town. The retrieval landscape has evolved:

**{{ glossary(term="ColBERT", def="A late-interaction retrieval model that stores per-token embeddings for documents and computes query-document similarity via MaxSim over all token pairs. More expressive than dual encoders, more efficient than cross-encoders.") }}** — a "late interaction" model that stores per-token embeddings instead of a single vector per document. Query-document similarity is computed via MaxSim over token pairs. It's a middle ground between two-tower (fast, lossy) and cross-encoder (slow, precise). Originally designed for text retrieval, the pattern applies to recommendations too.

**{{ glossary(term="SPLADE", def="Sparse Lexical and Dense retrieval — learns sparse, high-dimensional token-level representations that combine the efficiency of inverted indexes with the semantic power of neural models.") }}** — learned sparse retrieval. Instead of dense vectors, SPLADE produces sparse, high-dimensional representations that work with traditional inverted indexes. Useful when you need explainability or want to combine neural retrieval with keyword matching.

**Multi-tower / mixture-of-experts** — some systems use more than two towers, with specialised towers for different interaction types (click tower, purchase tower, engagement tower). DoorDash and Meta have published variants.

**Attention-based interaction layers** — recent work (IntTower, RankTower) adds lightweight cross-attention between the towers at the output layer. This partially breaks the independence constraint but keeps most of the serving efficiency by limiting interaction to the final layers.

## The Lineage

| Year | Model | Contribution |
|------|-------|-------------|
| 2013 | {{ cite(key="dssm2013", title="Learning Deep Structured Semantic Models for Web Search", authors="Huang et al.", year="2013", url="https://www.microsoft.com/en-us/research/publication/learning-deep-structured-semantic-models-for-web-search-using-clickthrough-data/") }} (DSSM) | The original dual encoder for web search. Word hashing + MLP towers. |
| 2016 | {{ cite(key="youtube2016", title="Deep Neural Networks for YouTube Recommendations", authors="Covington et al.", year="2016", url="https://arxiv.org/abs/1606.07792") }} | Two-stage retrieve+rank at YouTube scale. Established the production pattern. |
| 2019 | {{ cite(key="yi2019", title="Sampling-Bias-Corrected Neural Modeling", authors="Yi et al.", year="2019", url="https://research.google/pubs/pub48840/") }} | Showed that negative sampling bias correction matters more than architecture changes. |
| 2020 | {{ cite(key="colbert2020", title="ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction", authors="Khattab & Zaharia", year="2020", url="https://arxiv.org/abs/2004.12832") }} | Late interaction as a middle ground between bi-encoder and cross-encoder. |
| 2025 | MICE, IntTower, RankTower | Hybrid architectures that add selective cross-attention to two-tower models without destroying serving efficiency. |

## Bottom Line

**Use two-tower if:** you need to retrieve relevant items from a corpus of millions+ in real time. It's the architecture, not an option — there is currently no practical alternative for large-scale first-stage retrieval that can run at production latency.

**Pair it with a ranker:** a GBDT (like [LightGBM](/deep-dives/wtf-lightgbm/)) or cross-encoder on the shortlist. The two-tower gets you from "everything" to "plausible." The ranker gets you from "plausible" to "right."

**Watch the negatives:** your model is only as good as its negative sampling strategy. In-batch negatives with large batches are the minimum. Hard negative mining is where the real quality gains live.

The honest summary: two-tower is a compromise — it sacrifices the ability to see both sides at once for the ability to serve at scale. Every recommendation system you use makes this tradeoff. The ones that feel magical just hide the pipeline better.
