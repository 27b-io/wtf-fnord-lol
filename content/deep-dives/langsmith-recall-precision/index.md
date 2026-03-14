+++
title = "Optimising Recall and Precision in LangSmith Experiments"
description = "Your retrieval pipeline returns results. But does it return the right results? How New Computer used LangSmith's experiment framework to achieve 50% higher recall and 40% higher precision in agentic memory retrieval — and what you can steal from their approach."
date = 2026-03-12T09:00:00+11:00

[taxonomies]
tags = ["evaluation", "retrieval", "langsmith", "rag", "memory"]
series = ["tier-1-opinions"]

[extra]
reading_time = "14 min"
+++

## The One-Sentence Version

LangSmith's experiment framework turns the vague question "is my retrieval any good?" into something measurable — and New Computer's work on Dot proves that systematic measurement can double your recall without sacrificing precision.

{% callout(type="tldr") %}
**What:** {{ glossary(term="LangSmith", def="LangChain's observability and evaluation platform for LLM applications. Provides tracing, dataset management, experiment comparison, and evaluator frameworks for systematic testing.") }} provides experiment-level evaluators (not just per-row scoring) that let you measure precision, recall, and F1 across entire datasets — the metrics that actually matter for retrieval.

**Why it matters:** Most teams eyeball retrieval quality. "Looks about right" is not a metric. Without systematic measurement, you can't tell whether your clever reranking strategy actually helped or just moved the failure mode.

**The trick:** Separate your retrieval experiments from your generation experiments. Score retrieval independently using labeled relevance judgments. Then — and only then — optimise the prompt.
{% end %}

---

## The Problem: Retrieval Evaluation Is Everyone's Blind Spot

Here's a pattern I see constantly in RAG systems: someone builds a retrieval pipeline, connects it to an LLM, asks it a few questions, gets reasonable-looking answers, and ships it. When it starts hallucinating three weeks later, they blame the model.

The model isn't the problem. The retrieval is the problem. It was always the retrieval.

The fundamental issue is that {{ glossary(term="RAG", def="Retrieval-Augmented Generation. The pattern of retrieving relevant documents from a knowledge base and injecting them into an LLM's context window before generation. Only as good as the retrieval.") }} has two failure modes that look identical from the outside:

1. **Low recall** — relevant documents exist but aren't retrieved. The LLM doesn't know what it doesn't know, so it confabulates or gives a generic answer.
2. **Low precision** — irrelevant documents are retrieved and injected. The LLM gets confused by noise in the context window and produces subtly wrong answers.

Both produce "wrong answer" as output. But the fixes are completely different. Low recall means your embedding space is wrong, your chunking is too coarse, or your similarity threshold is too high. Low precision means you're retrieving too many documents, your reranking is weak, or your metadata filtering isn't selective enough.

You can't fix what you can't measure. And most teams aren't measuring.

## The Approach: LangSmith's Experiment Framework

LangSmith's evaluation system has a feature that most people walk right past: {{ glossary(term="summary evaluators", def="Experiment-level evaluators in LangSmith that receive the complete set of runs and examples after all individual evaluations complete. Used for aggregate metrics like precision, recall, and F1 that only make sense across an entire dataset.") }}.

Regular evaluators score one row at a time — did this specific query return the right answer? Summary evaluators receive the *entire experiment's* runs and examples, letting you compute aggregate metrics that only make sense across a dataset. Like precision and recall.

Here's the skeleton:

```python
from langsmith import evaluate
from langsmith.schemas import Example, Run
from typing import Sequence

def precision(runs: Sequence[Run], examples: Sequence[Example]):
    """Experiment-level: what fraction of retrieved items were relevant?"""
    tp, fp = 0, 0
    for run, example in zip(runs, examples):
        retrieved = set(run.outputs["retrieved_ids"])
        relevant = set(example.outputs["relevant_ids"])
        tp += len(retrieved & relevant)
        fp += len(retrieved - relevant)
    return {"score": tp / (tp + fp) if (tp + fp) > 0 else 0.0}

def recall(runs: Sequence[Run], examples: Sequence[Example]):
    """Experiment-level: what fraction of relevant items were retrieved?"""
    tp, fn = 0, 0
    for run, example in zip(runs, examples):
        retrieved = set(run.outputs["retrieved_ids"])
        relevant = set(example.outputs["relevant_ids"])
        tp += len(retrieved & relevant)
        fn += len(relevant - retrieved)
    return {"score": tp / (tp + fn) if (tp + fn) > 0 else 0.0}

results = evaluate(
    my_retrieval_pipeline,
    data="memory-retrieval-benchmark",
    summary_evaluators=[precision, recall],
    experiment_prefix="semantic-search-v2",
)
```

The crucial thing: you're evaluating the **retrieval step in isolation**. Not the final LLM output. Not "did the chatbot say something reasonable." Did. The. Retrieval. Return. The. Right. Documents.

This is where most teams go wrong. They evaluate the end-to-end system, which conflates retrieval quality with prompt quality with model capability. When the score drops, they don't know which knob to turn.

## The Case Study: New Computer's Dot

{{ glossary(term="Dot", def="A personal AI built by New Computer that maintains long-term memory of user preferences and context. Uses an agentic memory system that dynamically structures information during creation for later retrieval.") }} is an interesting case because its memory system is more complex than standard RAG. It's *agentic memory* — the system doesn't just store documents, it actively creates and structures memories with metadata (status fields, datetime ranges, tags) that become retrieval filters.

This creates a combinatorial explosion of retrieval strategies:
- Semantic search alone
- {{ glossary(term="BM25", def="Best Matching 25 — a classic probabilistic information retrieval algorithm that scores documents based on term frequency, inverse document frequency, and document length. Often used alongside semantic search for keyword-heavy queries.") }} keyword search alone
- Semantic + BM25 hybrid
- Pre-filtered by metadata, then semantic search
- Pre-filtered by metadata, then BM25
- Various combinations with different thresholds and k values

Without systematic measurement, you'd be guessing. "Semantic search feels better for most queries" is not engineering — it's vibes-based retrieval.

### The Dataset Problem

The New Computer team faced a real constraint: they couldn't use actual user data for evaluation (privacy). Their solution was elegant: {{ glossary(term="synthetic evaluation data", def="Test data generated by LLMs to simulate realistic user scenarios while preserving privacy. Includes synthetic user backstories, conversation histories, and labeled relevance judgments.") }}.

They generated synthetic users with LLM-generated backstories, seeded memory databases through simulated conversations, then created query-memory pairs with human-labeled relevance judgments. The labels are the key part — for each query, someone marked which memories *should* have been retrieved.

This gives you a ground truth. Without ground truth, precision and recall are meaningless. You need to know what the correct answer is before you can score how close you got.

### The Results

Using LangSmith's experiment comparison view, they ran dozens of retrieval configurations against the same labeled dataset:

| Configuration | Recall | Precision | F1 |
|---|---|---|---|
| Baseline (semantic only, k=5) | ~40% | ~35% | ~37% |
| Optimised (hybrid + meta-filter) | ~60% | ~49% | ~54% |

That's a **50% improvement in recall** and **40% improvement in precision** — not by changing the embedding model, not by throwing more compute at it, but by systematically measuring what worked for different query types and combining the right strategies.

The comparison view is where the insight happens. LangSmith shows you, side by side, which specific examples improved and which regressed. A change that boosts recall on temporal queries ("what did I do last week?") might tank precision on preference queries ("what kind of music do I like?"). You can't see this in aggregate scores alone.

## What's Actually New

Let's be honest about novelty here:

**Not new:** Precision and recall as retrieval metrics. This is Information Retrieval 101, circa 1960. Cranfield experiments established this evaluation paradigm before most of us were born.

**Not new:** Hybrid retrieval (semantic + keyword). This has been standard practice since at least 2020.

**Not new:** Using synthetic data for evaluation. Common in any domain with privacy constraints.

**Genuinely useful:** The *combination* — using LangSmith's experiment framework to systematically compare retrieval strategies with labeled synthetic data and aggregate metrics. This is the engineering discipline that most teams skip. It's not novel research; it's novel *practice*.

The insight isn't any single technique. It's that you need an evaluation harness that lets you:
1. Define ground truth (labeled datasets)
2. Run multiple experiments (different configurations)
3. Score at the aggregate level (precision/recall/F1)
4. Compare side-by-side (which examples improved/regressed)
5. Iterate fast (without re-labeling or rebuilding)

LangSmith provides all five. You could build this with pytest and spreadsheets, but you won't. That's the value proposition.

## Open Questions

**Threshold sensitivity.** The precision/recall tradeoff is controlled by how many results you retrieve (k) and your similarity threshold. Neither paper nor blog discusses how sensitive the results are to these parameters. A system that achieves 60% recall at k=10 but drops to 30% at k=5 is fragile.

**Distribution shift.** Synthetic data is great for privacy, but does it capture the long tail of real user queries? The 45% paid conversion rate suggests Dot works in practice, but there's no analysis of where synthetic evaluation predictions diverge from production performance.

**Temporal decay.** Memory systems accumulate over time. Does precision degrade as the memory store grows? At 100 memories, semantic search might work fine. At 10,000, you're likely drowning in near-matches. The meta-field filtering presumably helps, but there's no scaling analysis.

**Cross-query interference.** When you pre-filter by metadata, you're making an implicit bet about query intent. "What should I do today?" clearly wants temporal filtering. "Tell me about my relationship with Sarah" doesn't. How does the system decide which filter strategy to apply per query? This is the hard problem that the blog post doesn't address.

## The Bigger Picture: Evaluation as Infrastructure

This fits a broader trend I keep seeing: **the teams that win aren't the ones with the best models or the cleverest prompts. They're the ones with the best evaluation infrastructure.**

Evaluation is infrastructure. It's not a checkbox you tick before shipping. It's the feedback loop that makes improvement possible. Without it, you're doing gradient descent with your eyes closed.

LangSmith isn't the only option — you could use {{ glossary(term="RAGAS", def="Retrieval-Augmented Generation Assessment. An open-source framework for evaluating RAG pipelines with metrics like faithfulness, answer relevancy, context precision, and context recall.") }}, Langfuse, Phoenix, or build your own. The tool matters less than the practice:

1. **Separate retrieval evaluation from generation evaluation.** They're different systems with different failure modes.
2. **Use labeled datasets.** "Looks right" is not a metric.
3. **Measure precision AND recall.** Optimising one at the expense of the other is a trap.
4. **Compare configurations systematically.** A/B testing isn't just for product — it's for pipelines.
5. **Track regressions over time.** Today's improvement is tomorrow's baseline.

The irony is that this is exactly what the information retrieval community has been doing for sixty years. The LLM ecosystem is slowly rediscovering that evaluation methodology matters. Better late than never.

## Bottom Line

**Read this if:** You're building a RAG system and you don't have precision/recall metrics on your retrieval pipeline. Start here. The LangSmith experiment framework makes it genuinely easy.

**Skip this if:** You already have a systematic evaluation harness with labeled datasets and aggregate metrics. The specific techniques (hybrid search, metadata filtering) are standard — the value is in the evaluation methodology, not the retrieval tricks.

**The uncomfortable truth:** If you can't tell me your retrieval pipeline's precision and recall on a representative dataset, you don't know if your system works. You *think* it works because the chatbot says plausible things. That's not the same thing.

---

{% callout(type="insight") %}
The biggest ROI in most RAG systems isn't a better embedding model or a cleverer prompt — it's building an evaluation harness that tells you *which specific queries* your retrieval fails on. Fix those, and the whole system improves. LangSmith's experiment comparison view does exactly this: it shows you the regressions, not just the averages.
{% end %}

---

**References:**

{{ cite(key="newcomputer2024", authors="New Computer / LangChain", year="2024", title="Improving Memory Retrieval: How New Computer achieved 50% higher recall with LangSmith", url="https://blog.langchain.dev/customers-new-computer/") }}

{{ cite(key="langsmith-eval", authors="LangChain", year="2026", title="LangSmith Evaluation Documentation", url="https://docs.langchain.com/langsmith/evaluation") }}

{{ cite(key="langsmith-sdk", authors="LangChain", year="2026", title="LangSmith SDK — aevaluate reference", url="https://langsmith-sdk.readthedocs.io/en/latest/evaluation/langsmith.evaluation._arunner.aevaluate.html") }}

{{ cite(key="precision-recall-llm", authors="Sajjadi et al. / Kynkäänniemi et al.", year="2024", title="Exploring Precision and Recall to assess the quality and diversity of LLMs", url="https://arxiv.org/html/2402.10693v2") }}
