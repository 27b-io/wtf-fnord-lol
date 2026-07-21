+++
title = "Your Golden Dataset Is Lying To You"
description = "You defined 12 user archetypes. Your data contains 17. How hand-crafted personas fail at tens of millions of users, and what happens when you let BigQuery ML K-Means and diversity-aware sampling tell you the truth."
date = 2026-03-17T21:00:00+11:00

[taxonomies]
tags = ["machine-learning", "clustering", "bigquery", "evaluation", "data-quality"]
series = ["deep-dives"]

[extra]
+++

## The One-Sentence Version

Hand-crafted user archetypes are fiction at scale — let K-Means on your actual data marts show you the clusters that exist, then use diversity-aware sampling to build eval sets that represent them.

{% callout(type="tldr") %}
**What:** We defined 12 user archetypes for a product with tens of millions of users. Then we ran {{ glossary(term="K-Means clustering", def="An unsupervised algorithm that partitions n observations into k clusters by iteratively assigning points to the nearest centroid and recomputing centroids until convergence.") }} on BigQuery ML against actual behavioural data and discovered the real distribution looked nothing like our taxonomy.

**Why it matters:** Every downstream evaluation — A/B tests, model evals, prompt testing — inherits the biases of your test set. If your "representative sample" was built from personas someone invented in a product offsite, your evaluations are measuring fit to imagination, not fit to reality.

**The fix:** Data-driven clustering to discover real segments, then {{ glossary(term="DPP", def="Determinantal Point Process — a probabilistic model over subsets that assigns higher probability to diverse subsets, used for sampling items that are spread across a feature space rather than clumped together.") }} or farthest-first traversal to sample from them in a way that actively promotes diversity.
{% end %}

## The Archetype Trap

Here's how it usually goes. Product team runs a research sprint. They interview 30 users, survey 500, maybe cluster some NPS responses. Out comes a poster with 12 personas: "Power User Priya," "Casual Carl," "Enterprise Eva." Marketing loves it. Design loves it. The ML team inherits it as ground truth for evaluation datasets.

The problem isn't that personas are wrong. The problem is that personas are *aspirational*. They describe who you think your users are, filtered through who you want them to be. At tens of millions of users, the actual behavioural distribution is weirder, lumpier, and more skewed than any whiteboard exercise produces.

We found this out the hard way.

## What the Data Actually Said

We had 12 hand-crafted archetypes. We had tens of millions of users with behavioural features in BigQuery data marts — session frequency, feature usage patterns, content preferences, time-of-day distributions, retention curves. We ran K-Means on the actual data to see how many natural clusters existed and what they looked like.

Here's the BigQuery ML query that started the conversation:

```sql
-- Step 1: Create a K-Means model on actual behavioural features
CREATE OR REPLACE MODEL `project.ml.user_segments_kmeans`
OPTIONS (
  model_type = 'KMEANS',
  num_clusters = 20,           -- Start high, inspect silhouette
  max_iterations = 50,
  standardize_features = TRUE,
  kmeans_init_method = 'KMEANS++',
  distance_type = 'EUCLIDEAN'
) AS
SELECT
  -- user_id deliberately excluded: BQ ML would encode it as a feature
  -- (one-hot if STRING), training the model on identity, not behaviour.
  -- Map users to clusters afterwards via ML.PREDICT — non-feature columns
  -- in the input pass through to the output.
  sessions_per_week,
  avg_session_duration_sec,
  distinct_features_used_28d,
  content_diversity_score,      -- entropy over content categories
  pct_sessions_morning,
  pct_sessions_evening,
  days_since_first_session,
  d7_retention_flag,
  d30_retention_flag,
  revenue_lifetime_usd
FROM `project.marts.user_behavioural_features`
WHERE snapshot_date = CURRENT_DATE()
  AND sessions_per_week > 0;   -- Exclude true churns
```

```sql
-- Step 2: Evaluate cluster quality
SELECT
  davies_bouldin_index,        -- Lower = better-separated clusters
  mean_squared_distance         -- Within-cluster compactness
FROM ML.EVALUATE(MODEL `project.ml.user_segments_kmeans`);
```

```sql
-- Step 3: See what the clusters actually look like
SELECT
  centroid_id,
  feature,
  numerical_value AS centroid_value
FROM ML.CENTROIDS(MODEL `project.ml.user_segments_kmeans`)
ORDER BY centroid_id, feature;
```

The Davies-Bouldin index told us 20 was too many — some clusters were near-duplicates. We iterated down. The stable structure landed at **17 clusters**, not 12.

More importantly: the shape was wrong. Our hand-crafted archetypes assumed roughly even distribution across personas. The data showed:

- **3 clusters** contained 61% of all users (casual, low-frequency patterns our personas had lumped into one "Casual" bucket)
- **2 clusters** had no archetype equivalent at all (a "bursty evening" pattern and a "feature-explorer-who-never-retains" pattern)
- **4 of our 12 archetypes** mapped to <0.3% of users each — statistically invisible in the real base

{% callout(type="insight") %}
The most dangerous archetype is the one that feels true but describes 0.2% of your users. Every eval weighted toward it is a distortion.
{% end %}

## The Eval Set Problem

Here's where it gets expensive. If your evaluation dataset was sampled to "represent all 12 archetypes equally," you've massively over-weighted the rare ones and under-weighted the dominant patterns. Your model evaluations are optimizing for a user distribution that doesn't exist.

Concretely: we had been testing personalisation models against an eval set where "Power User" accounted for 8.3% of examples (1/12). In reality, power users — by any reasonable behavioural definition — were 1.8% of the active base. Our eval set was telling us models were great at serving power users and mediocre at serving casual users. The production metrics said the opposite.

## Diversity-Aware Sampling: The Fix

Once you have real clusters, you need an eval set that represents them faithfully while maintaining diversity *within* each cluster. Two approaches:

### Farthest-First Traversal (Simple, Effective)

Pick a seed point. Then iteratively pick the point farthest from all already-selected points. You get a sample that's spread widely across your feature space — it's a greedy heuristic (a 2-approximation to the optimal k-center cover), not a guarantee of optimal spread.

```python
import numpy as np
from sklearn.metrics import pairwise_distances

def farthest_first_traversal(
    embeddings: np.ndarray,
    k: int,
    seed_idx: int = 0
) -> list[int]:
    """
    Select k points from embeddings using farthest-first traversal.
    Greedily maximises spread across the feature space — a 2-approximation
    to the optimal k-center cover, not a global optimum.

    O(k * n) — fine for eval set construction, don't use for tens of millions of rows.
    Run on cluster centroids or pre-sampled subsets.
    """
    n = embeddings.shape[0]
    if not 1 <= k <= n:
        raise ValueError(f"need 1 <= k <= n, got k={k}, n={n}")
    if not 0 <= seed_idx < n:
        raise ValueError(f"need 0 <= seed_idx < n, got seed_idx={seed_idx}")

    selected = [seed_idx]
    # min_distances[i] = distance from point i to nearest selected point
    min_distances = np.full(n, np.inf)

    for _ in range(k - 1):
        # Update distances with the last selected point
        last = selected[-1]
        dists = pairwise_distances(
            embeddings[last:last+1],
            embeddings
        ).flatten()
        min_distances = np.minimum(min_distances, dists)
        # Exclude already-selected
        min_distances[selected] = -1
        # Pick the farthest point
        next_idx = np.argmax(min_distances)
        selected.append(next_idx)

    return selected

# Usage: allocate the eval budget proportionally to cluster size,
# then sample diversely *within* each cluster. A flat k per cluster
# would recreate the equal-persona weighting this article criticises.
# Largest-remainder allocation makes the quotas sum *exactly* to the
# budget — rounding each cluster's share independently drifts over or
# under it. NB: cluster IDs come from np.unique, not range(k) —
# BigQuery ML centroid_id values are 1-based, so range(17) would
# process an empty cluster 0 and skip cluster 17.
EVAL_BUDGET = 10_000
cluster_ids, cluster_sizes = np.unique(cluster_assignments, return_counts=True)
shares = EVAL_BUDGET * cluster_sizes / cluster_sizes.sum()
quotas = np.floor(shares).astype(int)
# Hand the leftover seats to the largest fractional remainders
leftover = np.argsort(shares - quotas)[::-1]
quotas[leftover[: EVAL_BUDGET - quotas.sum()]] += 1

cluster_eval_sets = {}
for cluster_id, quota in zip(cluster_ids, quotas):
    mask = cluster_assignments == cluster_id
    global_indices = np.where(mask)[0]
    quota = min(int(quota), len(global_indices))  # cap by cluster size
    if quota == 0:
        # A microscopic cluster can miss out entirely — bump the budget
        # or stratify (workflow step 3) if rare behaviours must be seen.
        cluster_eval_sets[cluster_id] = []
    elif quota == len(global_indices):
        cluster_eval_sets[cluster_id] = global_indices.tolist()
    else:
        local_indices = farthest_first_traversal(user_embeddings[mask], k=quota)
        cluster_eval_sets[cluster_id] = global_indices[local_indices].tolist()
```

### DPP Sampling (Statistically Principled)

Determinantal Point Processes give you a principled way to sample diverse subsets. The probability of selecting a subset is proportional to the determinant of its kernel matrix — similar items reduce the determinant, so diverse subsets are naturally preferred.

{{ cite(key="kulesza2012", title="Determinantal Point Processes for Machine Learning", authors="Kulesza & Taskar", year="2012", url="https://arxiv.org/abs/1207.6083") }} is the foundational reference — it covers DPPs for recommendation diversity, document summarisation, and subset selection. The same mathematical framework that ensures diverse training batches for contrastive learning ensures diverse eval sets for model evaluation.

```python
from dppy.finite_dpps import FiniteDPP
from sklearn.metrics.pairwise import rbf_kernel

def dpp_sample(
    embeddings: np.ndarray,
    k: int,
    gamma: float = 1.0,
    max_pool: int = 5_000,
    rng: np.random.Generator | None = None,
) -> list[int]:
    """
    Sample k diverse points using a DPP with RBF kernel.
    More expensive than farthest-first but statistically principled —
    samples are drawn from a proper probability distribution over
    diverse subsets, not a greedy heuristic.

    The RBF kernel is a dense n x n matrix and exact k-DPP sampling is
    cubic in n — running this on a raw multi-million-user cluster will
    exhaust memory long before sampling finishes. Anything larger than
    max_pool is first cut down to a uniform random coreset.
    """
    n = embeddings.shape[0]
    if not 1 <= k <= min(n, max_pool):
        raise ValueError(f"need 1 <= k <= min(n, max_pool), got k={k}, n={n}, max_pool={max_pool}")

    pool = np.arange(n)
    if n > max_pool:
        rng = rng or np.random.default_rng(42)
        pool = rng.choice(n, size=max_pool, replace=False)
        embeddings = embeddings[pool]

    # RBF kernel: K_ij = exp(-gamma * ||x_i - x_j||^2)
    L = rbf_kernel(embeddings, gamma=gamma)
    dpp = FiniteDPP(kernel_type='likelihood', L=L)
    # k-DPP: sample exactly k items
    dpp.sample_exact_k_dpp(size=k)
    # Map pool-local indices back to the caller's index space
    return pool[dpp.list_of_samples[-1]].tolist()
```

{% callout(type="question") %}
**Which should you use?** Farthest-first traversal is deterministic and fast — good for reproducible eval sets. DPP sampling is stochastic and gives you a distribution over diverse subsets — good when you want to measure variance across multiple eval runs. Start with farthest-first. Graduate to DPPs when you need statistical rigor about evaluation stability.
{% end %}

## The Workflow

1. **Cluster your actual users** — BQ ML K-Means on behavioural features from your data marts. Not surveys. Not interviews. Features derived from what users *did*.
2. **Inspect cluster distributions** — If any cluster contains <1% of users, you probably have too many clusters (or a genuinely rare behaviour worth isolating). If the top 3 clusters contain >70% of users, your product has a dominant usage pattern and your eval set should reflect that.
3. **Sample diversely within clusters** — Farthest-first or DPP, proportional to cluster size (or stratified if you deliberately want to over-represent minorities for fairness evaluation).
4. **Label and version your eval set** — This is now a versioned artifact. When your user base shifts, re-cluster and re-sample. Treat eval sets like code: they have releases.

## The Uncomfortable Implication

If you swap your hand-crafted eval set for a data-driven one, your model metrics will change. Probably for the worse on the metrics you've been reporting, because you've been accidentally optimizing for a fantasy distribution.

This is good. Painful, but good. Better to find out your model is mediocre for 61% of your users from an honest eval set than to keep reporting great numbers on a fictional one.

Your golden dataset was never golden. It was gilded. Strip the paint and look at the wood underneath.

## Bottom Line

**Read this if** you're building evaluation datasets for any ML system at scale and your test set was designed by humans in a room. Especially if your eval metrics look suspiciously good.

**Skip this if** your product has <10K users (hand-crafted personas are fine at that scale) or your eval sets are already sampled from production behavioural data.
