+++
title = "WTF is Two-Tower Recommendation?"
description = "The architecture behind every recommendation system that actually works at scale — why splitting the model in half is the key to serving billions of candidates in milliseconds."
date = 2026-03-11T09:00:00+11:00

[taxonomies]
tags = ["machine-learning", "recommendation-systems", "two-tower", "retrieval", "embeddings", "information-retrieval", "ranking"]
series = ["wtf-is"]

[extra]
paper_url = "https://arxiv.org/abs/1606.07792"
paper_date = "2016-09-15"
+++

## The One-Sentence Version

Two-tower (dual encoder) models split the recommendation problem in half — one neural network for users, one for items — so you can precompute item embeddings offline and serve recommendations from billions of candidates in milliseconds.

{% callout(type="tldr") %}
**What:** Two independent neural networks that encode users and items into the same embedding space. Relevance = dot product between the two vectors.

**Why it matters:** YouTube, Spotify, Pinterest — every service with a "recommended for you" section that actually works at scale uses some variant of this. The trick isn't the model. It's that the architecture makes serving computationally tractable.

**The tradeoff:** The towers can't see each other's features. Great for retrieval (find 1,000 candidates from millions). Needs a separate ranker for precise ordering.
{% end %}

## The Pipeline First

Most explanations of two-tower start with the architecture and arrive at the pipeline. That's backwards. The pipeline is the point. The architecture is the thing that makes it possible:

| Stage | What It Does | Speed | Accuracy |
|-------|-------------|-------|----------|
| **Retrieval** (two-tower + ANN) | Billions → ~1,000 candidates | 1-5ms | Good enough |
| **Ranking** (GBDT or cross-encoder) | ~1,000 → ordered list | 10-50ms | Precise |
| **Re-ranking** (business rules, diversity) | Final display order | <1ms | Policy |

The retrieval stage trades accuracy for coverage. The ranking stage trades coverage for accuracy. Neither works alone. Together they serve billions of candidates in under 100ms total.

This is why the two-tower model's inability to see both sides at once isn't fatal — it's not trying to produce the final ranking. It's trying to ensure the right items are *in the candidate set* for the ranker. The [GBDT](/deep-dives/wtf-lightgbm/) does the precise work.

{% callout(type="insight") %}
Two-tower is fundamentally a *serving* innovation, not a *modelling* innovation. A single combined model that sees both user and item features would be more accurate. The two-tower model sacrifices that accuracy for the ability to actually run at production scale. Every recommendation system you use makes this tradeoff. The ones that feel magical just hide the pipeline better.
{% end %}

## The Architecture

```text
    User Tower                    Item Tower
        │                             │
  [user features]              [item features]
  - watch history              - title embedding
  - demographics               - category
  - recent clicks              - popularity
        │                             │
    MLP / Transformer          MLP / Transformer
        │                             │
  user embedding (d=128)    item embedding (d=128)
        │                             │
        └──────── dot product ────────┘
                      │
              relevance score
```

Two separate neural networks that **independently** encode their inputs into vectors of the same dimensionality (typically 64-256). The {{ glossary(term="dot product", def="The sum of element-wise products of two vectors. Measures alignment in the embedding space. Higher = more relevant.") }} of the two vectors is the relevance score.

The independence is the feature, not the limitation. Because the towers don't interact:

- **Item embeddings are precomputed offline.** Run the item tower once per item. Store the vectors in an {{ glossary(term="ANN index", def="Approximate Nearest Neighbour index — a data structure (FAISS, ScaNN, Qdrant, HNSW) that finds vectors close to a query vector in sublinear time.") }} (FAISS, ScaNN, Qdrant).
- **At query time, run only the user tower.** One forward pass — a few milliseconds — produces a user vector. ANN lookup against the item index returns the top candidates.
- **100M items: brute-force dot product ≈ 100ms. ANN lookup ≈ 1-5ms.** At 10,000 QPS, that's the difference between "data centre" and "server."

## What Goes In Each Tower

The **user tower** sees everything about the user's current context: interaction history (often processed by a sequence model), demographics, time of day, session depth. It runs online, so it must be fast — typically 4-8 MLP layers.

The **item tower** sees content features (title embeddings, categories, tags), engagement statistics, creator metadata. It runs offline, so it can afford to be heavier — some systems use BERT or larger transformers here because latency at indexing time is free.

## Training: Where It Actually Gets Hard

The model trains end-to-end with a {{ glossary(term="contrastive objective", def="A loss function that pushes positive (user, item) pairs closer in embedding space and negative pairs further apart. The model learns what 'relevant' means by seeing examples of both.") }}. Given a batch of (user, item) pairs: the positive is the item the user engaged with. {{ glossary(term="Negative samples", def="Items the user did not interact with, used as counterexamples during training. The quality of negatives determines the quality of the model.") }} are items they didn't. The loss pushes positive dot products up, negative dot products down.

The quality of your negatives determines the quality of your model. This is the part most implementations get wrong:

**Random negatives** are easy to beat. The model learns to distinguish meditation sessions from tractor parts and calls it a day. Useless.

**{{ glossary(term="In-batch negatives", def="Using other users' positive items in the same training batch as negatives. Simple, free, surprisingly effective at batch sizes of 4096+.") }}** use other users' positives in the same batch as negatives. Simple, free, surprisingly effective at large batch sizes (4096+).

**Hard negatives** are items similar to the positive but wrong — the cases where the model is currently confused. {{ cite(key="yi2019", title="Sampling-Bias-Corrected Neural Modeling for Large Corpus Item Recommendations", authors="Yi et al.", year="2019", url="https://research.google/pubs/pub48840/") }} showed that correcting for popularity bias in negative sampling significantly improves retrieval quality.

{% callout(type="warning") %}
If you train with only random negatives, your model learns to distinguish popular from unpopular (trivial) instead of learning fine-grained relevance (useful). Hard negative mining or in-batch negatives with large batches are not optional.
{% end %}

## What It Can't Do

**No {{ glossary(term="cross-features", def="Features that depend on both user and item together, like 'has this user listened to this creator before?'. The most powerful ranking signals, but require seeing both sides simultaneously.") }}.** The user tower can't see which item it's scoring. "This user has listened to this creator 47 times" is a powerful signal. The two-tower model can't use it at retrieval time.

**Popularity amplification.** Popular items produce high-magnitude embeddings close to many user vectors. Without explicit debiasing, the model amplifies what's already popular.

**Long-tail blindness.** Items with few interactions have poorly-trained embeddings. The model falls back to content features, which are weaker than interaction signals.

**Sequence compression.** Encoding a full interaction history into a single fixed-length vector is lossy. The user who loves jazz *and* true crime podcasts gets averaged into a vector that represents neither well.

## The Alternatives

The two-tower pattern has competition in the retrieval space:

**{{ glossary(term="ColBERT", def="A late-interaction model that stores per-token embeddings for documents and computes relevance via MaxSim over token pairs. Middle ground between dual encoder speed and cross-encoder accuracy.") }}** stores per-token embeddings instead of a single vector per item. More expressive than a single dot product, more efficient than a full cross-encoder. Reach for it when your retrieval quality ceiling is too low but you can't afford cross-encoder latency on the full corpus.

**{{ glossary(term="SPLADE", def="Learned sparse retrieval — produces sparse, high-dimensional representations that work with inverted indexes. Combines neural semantic power with traditional search infrastructure.") }}** learns sparse representations that work with traditional inverted indexes. Useful when you need explainability, want to combine neural retrieval with keyword matching, or already have a BM25 infrastructure you'd rather extend than replace.

**Hybrid towers** (IntTower, RankTower, 2025) add lightweight cross-attention between towers at the output layer. The question the field is converging on: how much interaction can you add before serving breaks?

## The Lineage

| Year | Model | What It Changed |
|------|-------|-----------------|
| 2013 | {{ cite(key="dssm2013", title="Learning Deep Structured Semantic Models for Web Search", authors="Huang et al.", year="2013", url="https://www.microsoft.com/en-us/research/publication/learning-deep-structured-semantic-models-for-web-search-using-clickthrough-data/") }} (DSSM) | The original. Word hashing + MLP towers for web search. |
| 2016 | {{ cite(key="youtube2016", title="Deep Neural Networks for YouTube Recommendations", authors="Covington et al.", year="2016", url="https://arxiv.org/abs/1606.07792") }} | Two-stage retrieve+rank at YouTube scale. Established the production pattern everyone still follows. |
| 2019 | {{ cite(key="yi2019", title="Sampling-Bias-Corrected Neural Modeling", authors="Yi et al.", year="2019", url="https://research.google/pubs/pub48840/") }} | Proved that negative sampling strategy matters more than architecture. |
| 2020 | {{ cite(key="colbert2020", title="ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction", authors="Khattab & Zaharia", year="2020", url="https://arxiv.org/abs/2004.12832") }} | Late interaction as a middle ground. |
| 2025 | MICE, IntTower, RankTower | Selective cross-attention without destroying serving efficiency. |

## Bottom Line

**Use two-tower if:** you need to retrieve from millions+ of candidates in real time. There is currently no practical alternative at that scale.

**Pair it with a ranker.** Two-tower gets you from "everything" to "plausible." A [GBDT](/deep-dives/wtf-lightgbm/) or cross-encoder gets you from "plausible" to "right."

**Watch the negatives.** Your model is only as good as what it learns to distinguish. In-batch negatives with large batches are the minimum. Hard negative mining is where the real gains live.

Two-tower is a compromise. It sacrifices the ability to see both sides at once for the ability to serve at scale.
