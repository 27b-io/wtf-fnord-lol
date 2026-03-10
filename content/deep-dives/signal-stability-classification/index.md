+++
title = "Signal Stability Classification: Inference Cost-Benefit in Hybrid Recommendation Systems"
description = "Not all behavioral signals deserve the same compute budget. Genre affinity changes over weeks; session mood changes in seconds. Classify by stability, infer by tier, and stop pretending daily batch is the answer to everything."
date = 2026-03-10

[taxonomies]
tags = ["recommendation-systems", "architecture", "personalization", "feature-stores", "cost-optimization"]
series = ["foundational-patterns"]

[extra]
reading_time_original = "~12 min"
+++

## The One-Sentence Version

Your recommendation system shouldn't treat "prefers documentaries" and "is currently bingeing Korean horror" as the same kind of signal — one can be computed at 2am, the other needs to be detected right now, and mixing up which is which is how you burn money while serving stale recommendations.

{% callout(type="tldr") %}
**What:** Classify every personalization signal by how fast it changes, how expensive it is to recompute, and how much staleness hurts — then assign each to the appropriate compute tier: batch, near-real-time, streaming, or request-time.
**Why it matters:** The "offline vs. realtime" debate is a false binary. Both sides are right *about different signals*. The architecture that wins is the one that puts each signal in the tier that matches its volatility.
**The insight:** The most stale feature isn't always the most important to refresh. Accuracy-aware scheduling (RALF) reduces prediction error by a third — or cuts compute costs by 1.6× — by updating whichever feature's staleness *hurts most*, not whichever has been stale longest.
**The cost:** You're now operating four compute tiers instead of one. The complexity budget is real. But so is the alternative: paying request-time prices for signals that haven't changed since Tuesday.
{% end %}

## The Problem: One Tier to Ruin Them All

The [Offline Agent Pattern](/deep-dives/offline-agent-pattern/) makes a compelling case: move your LLM off the critical path, pre-compute personalization artifacts, serve lookups. Zero latency, infinite scale. And it's right — for a specific class of signals.

But here's what it glosses over: not everything *can* be pre-computed. Or rather, not everything *should* be.

Consider a user named Alex. Alex has spent three months steadily reading about distributed systems, Rust, and observability tooling. Your daily batch job knows this. It computed a beautiful profile artifact overnight: boost Rust content, suppress blockchain, prefer technical depth.

Then Alex opens your app on a Tuesday afternoon and starts furiously searching for "beginner Python tutorials." They've been asked to mentor a junior developer. Their *stable* interests haven't changed. Their *session intent* is completely different.

Your batch artifact is simultaneously correct (Alex does prefer distributed systems) and useless (Alex needs Python 101 right now). If you serve the batch artifact, you've ignored the most informative signal available. If you recompute everything in real time, you've thrown away the offline pattern's advantages.

The answer, obviously, is to do both — but to know *which signals go where*. This is signal stability classification — categorizing each signal by how volatile it is, how expensive it is to compute, and how much staleness hurts, then routing it to the right tier.

## The Four-Tier Model

Every major recommendation platform has independently converged on something like this, even if none of them bothered to write it down cleanly. Here's the model:

```
TIER 1: BATCH (hours to days)
├── Genre affinity, lifetime value, experience level
├── Computed: daily/weekly batch jobs (Spark, offline LLM)
├── Staleness tolerance: HIGH — changes slowly
└── Compute cost per refresh: HIGH — but amortized across days

TIER 2: NEAR-REAL-TIME (seconds to minutes)
├── Trending signals, binge detection, embedding refresh
├── Computed: event-driven (Kafka, Flink, triggered recomputation)
├── Staleness tolerance: MEDIUM — minutes matter, seconds don't
└── Compute cost per refresh: MEDIUM — targeted updates, not full recompute

TIER 3: STREAMING (sub-second)
├── Session behavior, click sequences, active browsing patterns
├── Computed: streaming pipeline (Kafka Streams, Flink, in-memory)
├── Staleness tolerance: LOW — seconds matter
└── Compute cost per refresh: LOW per event — but high aggregate volume

TIER 4: REQUEST-TIME (per query)
├── Novel query expansion, compositional intent, time-of-day context
├── Computed: at request time (lightweight inference, rule engine)
├── Staleness tolerance: ZERO — must reflect current state
└── Compute cost per refresh: MUST BE CHEAP — or you're back to the bottleneck
```

The key insight isn't the tiers themselves — it's the {{ glossary(term="staleness tolerance", def="How much degradation a signal's prediction quality suffers when computed from stale data. High tolerance means daily refresh is fine. Zero tolerance means you need it live.") }} axis. Some signals can be a day old and still be useful. Others are worthless after five minutes. Treating them identically is like shipping everything overnight express because some packages are urgent. The tier boundary isn't primarily a technology question — it's an economics question. If stale genre preferences lose you 0.1% engagement but stale session intent loses you 15%, the compute budget allocation writes itself.

## Everyone Got This Wrong Before They Got It Right

Here's the tension that makes signal stability classification interesting rather than obvious: TikTok and Netflix looked at the same problem and arrived at opposite architectures. They're both right. They're just running different casinos.

ByteDance built Monolith [Liu et al. 2022] — {{ glossary(term="online learning", def="A machine learning paradigm where the model updates continuously from incoming data rather than being retrained in periodic batch cycles. Enables minute-level adaptation but requires careful infrastructure.") }} with minute-level parameter synchronization, collapsing the batch/serving boundary entirely. They tested five-hour sync cycles. Performance degraded significantly. Thirty minutes was optimal. This tells you everything about TikTok's signal profile: when you've built a dopamine slot machine where users swipe through videos like shuffling cards, *most* signals are volatile. Mood shifts, curiosity wanders, boredom threshold recalibrates — all minute by minute. The stable layer (language preference, broad content type) is tissue-thin. The volatile layer *is* the product. Running batch on TikTok would be like mailing someone yesterday's weather forecast.

Netflix looked at the same problem and shrugged. Their 2025 foundation model work [Netflix Tech Blog 2025] recomputes taste embeddings daily, fine-tunes monthly. Tier 1 signals, changing about as fast as the catalogue itself — which is to say, glacially. But page-load ranking? That's Tier 4. When you open the app, a lightweight ranker rescores pre-retrieved candidates using what you just watched, what time it is, what device you're holding. The heavy lifting happened at 2am. The ranking just adds volatile seasoning at serve time. Netflix didn't choose batch because they're unsophisticated. They chose it because *movie taste moves slowly*. Their domain is stable, and they had the good sense not to fight it.

Spotify sits in the middle, explicitly modeling slow-moving and fast-moving interests [Spotify Research 2022] — batch Spark overnight for 600M+ users, event-driven Kafka to catch when someone suddenly listens to seven jazz albums having never left the metal section before. Pinterest's TransAct [Pinterest KDD 2023] encodes the same insight as infrastructure: a retrieval-to-reranking cascade where each stage uses progressively fresher signals, because your lifetime pin history and your last three clicks belong to different temporal universes. YouTube built a bandit system [Google/YouTube RecSys 2023] for the same reason — a million videos upload daily, and a model trained on yesterday's data has a systematic blind spot for everything that didn't exist yesterday.

Every one of these platforms arrived at the same conclusion through different pain. The domain determines the tier allocation. And every one of them got it wrong first — running one tier for everything, wondering why engagement was mediocre, and gradually discovering that the problem wasn't their models. It was their clocks. TikTok's "everything is volatile" position isn't the future of all recommendation — a meditation app's signals are overwhelmingly stable. The framework is domain-specific, and anyone telling you otherwise is selling infrastructure.

## The RALF Insight: Everyone Got the Scheduling Wrong Too

So you've classified your signals. You've built your tiers. You know what to batch and what to stream. Congratulations — you've solved the easy problem.

Here's the hard one: within each tier, *which feature do you refresh first?*

The naive answer is the one everybody uses: round-robin the stalest features. Genre affinity was last computed 23 hours ago, session mood was last computed 2 hours ago — refresh genre affinity, obviously. It's the stalest.

{{ glossary(term="RALF", def="Accuracy-Aware Scheduling for Feature Store Maintenance (Wooders et al., VLDB 2024). A scheduling framework that prioritizes feature updates by their impact on downstream prediction accuracy, not by how stale they are.") }} — Wooders et al. at VLDB 2024 [Wooders et al. 2024] — proved this is exactly wrong.

Genre affinity hasn't *changed* in 23 hours. It rarely changes. Refreshing it costs compute and gains you nothing — like checking whether the mountain has moved since breakfast. Session mood has drifted substantially in 2 hours, and that drift is actively poisoning your predictions right now. That's where your compute budget should go.

They cut prediction error by a third. Same compute budget. Or flip it: 1.6× compute cost savings for the same accuracy. Just by asking "which stale feature actually *hurts*?" instead of "which feature has been stale longest?"

This is embarrassingly obvious in retrospect — which is the hallmark of good research. Staleness-based scheduling optimizes for the clock. RALF optimizes for the user. The clock doesn't care whether a feature changed. The user notices when you serve recommendations based on a mood they were in three hours ago. Once you frame feature freshness scheduling as a prediction task — predicting which refresh would most improve downstream accuracy — round-robin looks as sophisticated as alphabetizing your priorities.

## What You Actually Can't Precompute

Signal stability classification is powerful, but it has limits. Some signals genuinely resist precomputation, and it's worth knowing where the wall is before you run into it.

Start with the most visceral case: "Something like *Severance* but shorter and without the corporate satire." That's a compositional query — arbitrary constraint composition against a user's entire engagement history. It requires genuine reasoning, not lookup. You can't precompute it because the constraint space is effectively infinite. The 2025 work on inference-time feature injection [arxiv 2512.14734] tries to split the difference — injecting fresh context *into* pre-computed representations at serve time — but the hard cases still need Tier 4 inference.

Then there are the combinatorial explosions. User × context × item × time × mood × query creates state spaces that make precomputation laughable. {{ glossary(term="two-tower models", def="A retrieval architecture where user and item representations are computed independently in separate 'towers' (neural networks), then combined via dot product or similar at serve time. Enables precomputation of item embeddings.") }} handle this by factoring the problem — precompute the towers independently, combine at serve time — but the long tail of specific combinations will always need online inference.

And cross-user realtime signals: "what's resonating right now among users like me." Trending within a collaborative cluster is inherently volatile *and* cross-user, which means no single user's batch job can capture it. You need a streaming aggregation layer computing cluster-level trends continuously.

The industry's emerging answer is {{ glossary(term="generative recommendation", def="Using LLMs to generate recommendations directly rather than scoring pre-computed candidate lists. Collapses the candidate retrieval + scoring pipeline but introduces latency and cost tradeoffs.") }} — LLMs generating recommendations rather than scoring precomputed candidates. This collapses the precomputation problem entirely but introduces latency and cost tradeoffs that push you right back toward the tiered model. Which is fitting. The problem isn't escaping tiers. The problem is putting each signal in the right one.

## The Decision Framework

Here's the cheat sheet. For any signal in your system, ask four questions:

| Dimension | Question | Low → Batch | High → Realtime |
|-----------|----------|-------------|-----------------|
| **Volatility** | How fast does this signal actually change? | Days/weeks | Seconds/minutes |
| **Inference cost** | How expensive to recompute? | Cheap embedding | Expensive LLM call |
| **Staleness damage** | How wrong does it get before users notice? | Slightly off recommendations | Serving contradictory content |
| **Business criticality** | What breaks if this is stale? | Engagement drops 0.1% | Safety filter fails |

No published framework combines all four dimensions cleanly. RALF handles volatility and inference cost brilliantly but doesn't model business criticality. Platform implementations handle criticality but don't formalize the scheduling tradeoff. Feature stores like Hopsworks and Tecton let you set per-feature-group freshness SLAs — but these are operational knobs, not a decision framework. They're the steering wheel, not the map.

The practical approach: score each signal on these four dimensions, plot them, and draw your tier boundaries. Anything in the "changes slowly, cheap to compute, tolerates staleness" corner is batch. Anything in the "changes fast, critical if stale" corner is streaming or request-time. Everything in between is the engineering judgment call that justifies your salary.

{% callout(type="warning") %}
The most dangerous misclassification is putting a volatile signal in the batch tier. A stale safety filter, a stale abuse-detection signal, or stale session intent served with high confidence will actively harm the user experience. When in doubt about tier placement, err toward fresher computation. The cost of unnecessary freshness is money. The cost of dangerous staleness is trust.
{% end %}

## The Hybrid Override Problem

There's a design challenge nobody writes about cleanly: what happens when tiers contradict each other?

Your batch tier says Alex likes distributed systems. Your streaming tier says Alex is currently searching for Python tutorials. Which wins?

The naive answer is "the fresher signal wins." But that's not quite right either. If Alex searches for "Python tutorial" once and then goes back to browsing Rust articles, the streaming override should decay — you don't want a single anomalous query to corrupt the batch profile.

The pattern that works: **volatile overrides with decay**. The streaming tier can override the batch tier, but the override has a TTL. If the volatile signal isn't reinforced (more Python searches, more beginner content clicks), it decays back to the batch baseline within minutes. Responsiveness without instability.

The schema implication: your profile artifact needs a `patches` layer that the streaming tier can write to without corrupting the batch-computed base. Separate the stable foundation from the volatile overlay. Merge at read time.

In practice, this looks something like:

```json
{
  "user_id": "alex-42",
  "batch_profile": {
    "computed_at": "2026-03-10T02:00:00Z",
    "genre_affinity": {"distributed_systems": 0.91, "rust": 0.84, "observability": 0.72},
    "experience_level": "advanced",
    "content_depth": "technical"
  },
  "volatile_patches": [
    {
      "signal": "session_intent",
      "value": {"python_beginner": 0.88, "mentoring": 0.65},
      "observed_at": "2026-03-10T14:23:00Z",
      "ttl_seconds": 1800,
      "reinforcement_count": 3
    }
  ],
  "resolved_profile": "< merge(batch_profile, active_patches) at read time >"
}
```

The `volatile_patches` array is the streaming tier's write surface. Each patch has a TTL and a reinforcement counter — every confirming signal bumps the counter and resets the TTL. No confirming signal? The patch expires and the batch baseline reasserts. This is how you get responsiveness without instability, and it's the pattern that {{ glossary(term="feature stores", def="Infrastructure for managing, serving, and versioning ML features across training and inference. Examples include Feast (open-source, batch + online serving), Hopsworks (real-time feature pipelines with RALF-style scheduling), and Tecton (managed, with built-in freshness SLAs). The feature store is where signal stability classification becomes concrete infrastructure.") }} like Feast, Hopsworks, and Tecton are increasingly building native support for — tiered freshness with explicit staleness budgets per feature group.

## Open Questions (With Opinions)

**Can RALF's accuracy-aware scheduling work with LLM-generated features?** Probably not yet. RALF was validated on traditional ML features where you can measure accuracy impact cleanly — a stale embedding has a quantifiable effect on downstream loss. LLM-generated semantic summaries don't have the same clean loss signal. You'd need a proxy metric for "how much did this summary's staleness hurt the recommendation," and nobody's built a convincing one. The research gap is real, but the direction is obvious: someone will define an accuracy proxy for semantic features within two years, and RALF's framework will absorb it.

**Where does generative recommendation fit in the tier model?** It's doing Tier 4 work at Tier 1 cost — which is to say, it's currently too expensive for request-time serving at scale. But inference costs drop roughly 10× per year. Within three years, what's currently a batch-only luxury will be viable at request time for high-value queries. The tier boundaries aren't fixed. They're economic, and the economics are moving fast. Plan your architecture for the costs you'll have in 2028, not the costs you have now.

**How do you test tier placement?** You don't A/B test infrastructure architectures — that way lies six months of shadow-mode execution and a paper nobody reads. The pragmatic approach: instrument your current system to measure staleness-vs-accuracy for each feature. The ones where staleness correlates with accuracy drops are miscategorized — they need a faster tier. The ones where fresher computation doesn't improve anything are candidates for a slower tier. Let the data draw the tier boundaries. Your intuition about which signals are volatile is probably right 80% of the time and catastrophically wrong the other 20%.

## Same Person at Three Speeds

Here's what the "offline vs. realtime" debate gets wrong: it treats the question as architectural, when it's actually about *what a user is*.

Your user is not one person with one set of preferences. They're at least three people inhabiting the same account. There's the person who "likes documentaries" — stable for months, computed at 2am, perfectly served by batch. There's the person who "is exploring Korean cinema this week" — stable for days, caught by near-real-time pipelines. And there's the person who "wants something short and funny right now because dinner's almost ready" — stable for minutes, invisible to anything slower than a streaming pipeline.

These three people aren't edge cases. They're *every* user, *all the time*. The question was never "batch or realtime?" The question was "which person are you serving right now?"

RALF is the sharpest version of this insight: don't schedule your compute by how old the data is. Schedule it by which version of the user you're failing. The stalest feature isn't the most important to refresh. The one that's *most wrong about who they are right now* — that's your priority.

The platforms that get this right don't pick a lane. They run all four tiers, put each signal where it belongs, and schedule refreshes by impact. Not because they love complexity, but because their users are genuinely multi-timescale creatures. Serving them well means serving all of them — at the speed each one demands.

{% callout(type="tldr") %}
**TL;DR (for the scroll-to-the-bottom crowd):** Not all signals change at the same speed. Classify each by volatility, compute cost, staleness damage, and business criticality. Batch the stable ones, stream the volatile ones, infer the unprecomputable ones at request time. Schedule refreshes by accuracy impact (RALF), not by how long it's been since the last refresh. Same person, three speeds. Serve all of them.
{% end %}

---

## References

{{ cite(key="netflix-fm", title="Foundation Model for Personalized Recommendation", authors="Netflix Technology Blog", year="2025", url="https://netflixtechblog.com/foundation-model-for-personalized-recommendation-1a0bd8e02d39") }}

{{ cite(key="spotify-slow-fast", title="Modeling Users According to Their Slow and Fast-Moving Interests", authors="Spotify Research", year="2022", url="https://research.atspotify.com/2022/02/modeling-users-according-to-their-slow-and-fast-moving-interests") }}

{{ cite(key="spotify-stacks", title="Why We Use Separate Tech Stacks for Personalization and Experimentation", authors="Spotify Engineering", year="2026", url="https://engineering.atspotify.com/2026/1/why-we-use-separate-tech-stacks-for-personalization-and-experimentation") }}

{{ cite(key="monolith", title="Monolith: Real Time Recommendation System With Collisionless Embedding Table", authors="Zhuoran Liu et al.", year="2022", url="https://arxiv.org/abs/2209.07663") }}

{{ cite(key="transact", title="TransAct: Transformer-based Realtime User Action Model for Recommendation at Pinterest", authors="Pinterest Engineering", year="2023", url="https://medium.com/pinterest-engineering/next-level-personalization-how-16k-lifelong-user-actions-supercharge-pinterests-recommendations-bd5989f8f5d3") }}

{{ cite(key="pinterest-multi", title="Synergizing Implicit and Explicit User Interests: Multi-Embedding Retrieval", authors="Pinterest", year="2025", url="https://arxiv.org/html/2506.23060v1") }}

{{ cite(key="youtube-bandit", title="Online Matching: A Real-time Bandit System for Large-scale Recommendations", authors="Google/YouTube", year="2023", url="https://dl.acm.org/doi/fullHtml/10.1145/3604915.3608792") }}

{{ cite(key="ralf", title="RALF: Accuracy-Aware Scheduling for Feature Store Maintenance", authors="Maxwell Wooders et al.", year="2024", url="https://www.vldb.org/pvldb/vol17/p563-wooders.pdf") }}

{{ cite(key="itfi", title="Inference Time Feature Injection for Recommendation", authors="arxiv preprint", year="2025", url="https://arxiv.org/abs/2512.14734") }}

{{ cite(key="spotify-gur", title="Generalized User Representations for Large-Scale Recommendations", authors="Spotify", year="2025", url="https://dl.acm.org/doi/10.1145/3705328.3748132") }}
