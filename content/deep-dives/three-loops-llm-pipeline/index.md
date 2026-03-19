+++
title = "Three Loops Your LLM Pipeline Needs From Day One"
description = "Zero-cost architectural decisions — a prompt registry, per-block model config, and three BigQuery columns — that cost nothing to add now and unlock DSPy optimisation, LangSmith experiments, and behavioural flywheels later."
date = 2026-03-17T21:20:00+11:00

[taxonomies]
tags = ["llm-ops", "dspy", "langsmith", "optimisation", "architecture", "bigquery"]
series = ["deep-dives"]

[extra]
+++

## The One-Sentence Version

Add three things to your LLM pipeline on day one — a prompt registry, per-block model config, and three behavioural columns in BigQuery — and you get DSPy prompt optimisation, LangSmith model selection, and behavioural flywheels for free later.

{% callout(type="tldr") %}
**What:** Three feedback loops that most LLM pipelines need eventually but almost nobody builds from the start: (1) prompt optimisation via {{ glossary(term="DSPy MIPROv2", def="An automated prompt optimiser from Stanford NLP that uses Bayesian surrogate models to search the space of prompt instructions, few-shot examples, and module compositions — treating prompt engineering as a hyperparameter optimisation problem.") }}, (2) model selection experiments via {{ glossary(term="LangSmith", def="LangChain's observability and evaluation platform — traces LLM calls, runs dataset evaluations, and supports A/B experiments across models and prompt variants.") }}, and (3) behavioural flywheels from production data.

**Why it matters:** Each loop requires specific architectural affordances — a prompt registry, per-block model routing, structured logging columns. Adding these later means refactoring your pipeline. Adding them now costs essentially zero additional engineering effort.

**The trick:** You don't need to *use* any of these loops on day one. You just need to not *prevent* them. Three decisions made at pipeline construction time determine whether optimisation is a config change or a rewrite six months later.
{% end %}

## The Problem With "We'll Optimise Later"

Every LLM pipeline starts the same way. You hardcode a prompt, pick a model (GPT-4, probably), wire it to your application, ship it. It works. Costs are low because traffic is low. Nobody's thinking about optimisation because there's nothing to optimise yet.

Six months later, traffic is 50x, your OpenAI bill is a line item that finance asks about, and you want to:
- Try cheaper models for some tasks
- Optimise your prompts systematically instead of vibes-based editing
- Use production behavioural data to improve outputs

And you discover that doing any of this requires rewriting your pipeline, because every optimisation loop needs a hook that doesn't exist.

Here are the three hooks. Each costs approximately zero to add now.

## Loop 1: Prompt Optimisation (DSPy MIPROv2)

### What It Does

{{ cite(key="opsahlong2024", title="Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs", authors="Opsahl-Ong et al.", year="2024", url="https://arxiv.org/abs/2406.11695") }} introduced MIPROv2 — an optimiser that treats prompt engineering as a {{ glossary(term="hyperparameter optimisation", def="Systematically searching a configuration space (here: prompt instructions and few-shot examples) using techniques like Bayesian optimisation rather than manual trial-and-error.") }} problem. You define a task metric, give it your pipeline, and it searches the space of instructions and few-shot examples using Bayesian surrogate models.

It works. On DSPy benchmarks, MIPROv2 consistently outperforms hand-tuned prompts by 5-15% on task metrics. Not because it's smarter than you — because it can try 200 prompt variants in the time you try 3.

### The Architectural Requirement

MIPROv2 needs one thing: **prompts that are addressable and swappable without code changes.** If your prompt is a string literal inside a function, DSPy can't optimise it without modifying your source code. If your prompt is a named entry in a registry, DSPy can swap variants while your pipeline runs unchanged.

### The Zero-Cost Decision: A Prompt Registry

```python
# Don't do this:
def summarize(text: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{
            "role": "system",
            "content": "You are a helpful assistant that summarizes text concisely."
        }, {
            "role": "user",
            "content": text
        }]
    )
    return response.choices[0].message.content

# Do this instead:
from dataclasses import dataclass, field

@dataclass
class PromptConfig:
    name: str
    version: str
    system: str
    template: str
    few_shot_examples: list[dict] = field(default_factory=list)

# Prompt registry — can be YAML, DB, whatever.
# The point is: prompts are data, not code.
PROMPTS: dict[str, PromptConfig] = {
    "summarize_v1": PromptConfig(
        name="summarize",
        version="v1",
        system="You are a helpful assistant that summarizes text concisely.",
        template="{text}",
        few_shot_examples=[]
    ),
}

def summarize(text: str, prompt_key: str = "summarize_v1") -> str:
    prompt = PROMPTS[prompt_key]
    messages = [{"role": "system", "content": prompt.system}]
    for ex in prompt.few_shot_examples:
        messages.append({"role": "user", "content": ex["input"]})
        messages.append({"role": "assistant", "content": ex["output"]})
    messages.append({"role": "user", "content": prompt.template.format(text=text)})

    response = client.chat.completions.create(
        model="gpt-4",
        messages=messages
    )
    return response.choices[0].message.content
```

That's it. Same functionality, ~20 extra lines. But now:
- DSPy can swap `prompt_key` to test variants
- You can A/B test prompts by routing traffic to different keys
- Prompt changes are config changes, not deployments
- You have a natural versioning point for every prompt in your system

{% callout(type="insight") %}
The prompt registry isn't about DSPy specifically. It's about making prompts a **configuration surface** instead of embedded code. DSPy, manual A/B testing, regulatory audit trails — they all need the same thing: prompts that are named, versioned, and swappable.
{% end %}

### What MIPROv2 Optimisation Looks Like (When You're Ready)

```python
import dspy

# Define your pipeline as a DSPy module
class Summarizer(dspy.Module):
    def __init__(self):
        self.summarize = dspy.Predict("text -> summary")

    def forward(self, text):
        return self.summarize(text=text)

# Define your metric
def quality_metric(example, prediction, trace=None):
    """Your eval metric — could be LLM-as-judge, ROUGE, human labels."""
    # ... score the summary against the reference
    return score

# Run MIPROv2 optimisation
from dspy.teleprompt import MIPROv2

optimiser = MIPROv2(
    metric=quality_metric,
    num_candidates=30,      # Prompt variants to generate
    num_trials=200,         # Bayesian optimisation trials
    max_bootstrapped_demos=4,  # Few-shot examples per prompt
    max_labeled_demos=8,
)

optimized = optimiser.compile(
    Summarizer(),
    trainset=training_examples,
    eval_kwargs={"num_threads": 8}
)

# The optimized module has better prompts and few-shot examples
# Export them back to your prompt registry
```

You don't need this on day one. You need the registry on day one so this works on day 90.

## Loop 2: Model Selection (LangSmith Experiments)

### What It Does

LangSmith experiments let you run the same dataset through different model configurations and compare results side by side. Same inputs, same evaluation criteria, different models. The output is a comparison table showing quality, latency, and cost per model.

This matters because model selection is the highest-leverage cost optimisation in most LLM pipelines. The difference between GPT-4 and GPT-3.5-turbo is 20-30x on cost. The quality difference is task-dependent and often smaller than people assume.

### The Architectural Requirement

Model experiments need **per-block model configuration.** If your pipeline calls `gpt-4` in 6 places and you want to test whether block 3 can use a cheaper model, you need to be able to change block 3's model without touching blocks 1-6.

### The Zero-Cost Decision: Per-Block Model Config

```python
from dataclasses import dataclass

@dataclass
class BlockConfig:
    prompt_key: str
    model: str
    temperature: float = 0.7
    max_tokens: int = 1024

# Pipeline configuration — one model per block
PIPELINE_CONFIG = {
    "extract_entities": BlockConfig(
        prompt_key="extract_entities_v2",
        model="gpt-3.5-turbo",    # Cheap, entity extraction is easy
        temperature=0.0,
    ),
    "analyze_sentiment": BlockConfig(
        prompt_key="sentiment_v1",
        model="gpt-3.5-turbo",    # Also cheap
        temperature=0.0,
    ),
    "generate_summary": BlockConfig(
        prompt_key="summarize_v3",
        model="gpt-4",            # Expensive, but quality matters here
        temperature=0.7,
    ),
    "draft_response": BlockConfig(
        prompt_key="response_v1",
        model="gpt-4",            # Keep expensive for now, test later
        temperature=0.8,
    ),
}

def run_block(block_name: str, input_text: str) -> str:
    config = PIPELINE_CONFIG[block_name]
    prompt = PROMPTS[config.prompt_key]  # From Loop 1's registry

    response = client.chat.completions.create(
        model=config.model,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        messages=build_messages(prompt, input_text)
    )
    return response.choices[0].message.content
```

Now running a LangSmith experiment to test whether `generate_summary` works with `gpt-3.5-turbo` is a config change:

```python
from langsmith import Client
from langsmith.evaluation import evaluate

ls_client = Client()

def run_pipeline_with_config(inputs: dict, config: dict) -> dict:
    """Wrapper that lets LangSmith swap model configs per experiment."""
    override = config.get("model_overrides", {})
    # Temporarily override specific blocks
    for block_name, model in override.items():
        PIPELINE_CONFIG[block_name].model = model

    result = run_full_pipeline(inputs["text"])
    return {"output": result}

# Run experiment: can generate_summary use gpt-3.5-turbo?
results = evaluate(
    run_pipeline_with_config,
    data="summarization-eval-set",
    evaluators=[quality_evaluator, cost_evaluator],
    experiment_prefix="summary-model-swap",
    metadata={
        "model_overrides": {"generate_summary": "gpt-3.5-turbo"}
    }
)
```

{% callout(type="question") %}
**When should you actually run these experiments?** When your LLM spend crosses a threshold that someone asks about — usually $5-10K/month. Before that, use GPT-4 everywhere and focus on product-market fit. The per-block config costs you nothing now and saves you a pipeline rewrite when finance comes knocking.
{% end %}

## Loop 3: Behavioural Flywheels (Three BQ Columns)

### What It Does

A behavioural flywheel uses production user behavior to improve your pipeline outputs. User clicks on recommendation A instead of B → that signal feeds back into your system to generate better recommendations. The pipeline gets smarter from usage without explicit training.

### The Architectural Requirement

You need **structured behavioural signals in your data warehouse, joined to pipeline outputs.** This means logging three things alongside every LLM-generated output:

1. **What was generated** (output ID, content hash)
2. **What the user did** (engagement signal)  
3. **What alternatives existed** (counterfactual context)

### The Zero-Cost Decision: Three BigQuery Columns

Add these three columns to whatever table already logs your LLM outputs:

```sql
-- Add to your existing LLM output logging table
ALTER TABLE `project.logs.llm_outputs` ADD COLUMN
  user_action STRING;           -- 'clicked', 'dismissed', 'ignored', 'expanded'

ALTER TABLE `project.logs.llm_outputs` ADD COLUMN  
  action_delay_ms INT64;        -- Time from display to action (NULL if ignored)

ALTER TABLE `project.logs.llm_outputs` ADD COLUMN
  alternatives_shown INT64;     -- How many other options were visible
```

That's the entire schema change. Three columns. No new tables, no new pipelines, no new infrastructure.

What these three columns unlock:

```sql
-- Flywheel query 1: Which prompt versions produce content users engage with?
SELECT
  prompt_key,
  prompt_version,
  COUNT(*) AS impressions,
  COUNTIF(user_action = 'clicked') / COUNT(*) AS ctr,
  AVG(IF(user_action IS NOT NULL, action_delay_ms, NULL)) AS avg_response_ms
FROM `project.logs.llm_outputs`
WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY prompt_key, prompt_version
ORDER BY ctr DESC;
```

```sql
-- Flywheel query 2: Does model quality actually affect user behavior?
SELECT
  model,
  prompt_key,
  COUNTIF(user_action = 'clicked') / COUNT(*) AS ctr,
  COUNTIF(user_action = 'dismissed') / COUNT(*) AS dismiss_rate
FROM `project.logs.llm_outputs`
WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY model, prompt_key
ORDER BY prompt_key, ctr DESC;
```

```sql
-- Flywheel query 3: Position bias — are users just clicking the first option?
SELECT
  alternatives_shown,
  COUNTIF(user_action = 'clicked') / COUNT(*) AS ctr,
  -- If CTR is flat across alternatives_shown,
  -- users are engaging with content quality, not position
  COUNTIF(user_action = 'clicked' AND position = 1) /
    COUNTIF(user_action = 'clicked') AS first_position_share
FROM `project.logs.llm_outputs`
WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY alternatives_shown
ORDER BY alternatives_shown;
```

{% callout(type="insight") %}
The flywheel loop is the most valuable of the three and the easiest to add. Three columns. No ML required. No new infrastructure. Just structured logging of "what did the user do after seeing this output?" — and suddenly you can answer questions like "does GPT-4 actually produce content users prefer over GPT-3.5?" with production data instead of vibes.
{% end %}

## How The Three Loops Compound

Each loop is useful alone. Together they compound:

1. **Behavioural flywheel** tells you which prompt versions users prefer → feeds into...
2. **DSPy MIPROv2** which optimises prompts using behavioural CTR as its metric → produces new prompt variants tested via...
3. **LangSmith experiments** which determine which model is cheapest for each optimized prompt while maintaining quality → results logged with...
4. **Behavioural flywheel** columns that measure whether the cheaper model + optimized prompt actually performs in production.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   BQ Behavioural Data ──→ DSPy Metric Function           │
│         │                        │                      │
│         │                   Optimized Prompts            │
│         │                        │                      │
│         │               LangSmith Experiments            │
│         │                        │                      │
│         │                  Model Selection               │
│         │                        │                      │
│         └──── Production Logs ◄──┘                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

None of this works if you hardcoded prompts as string literals, used one model for everything, and didn't log user behavior alongside LLM outputs.

All of this works if you made three decisions on day one that cost approximately zero engineering effort.

## The Checklist

Before you ship your next LLM pipeline, check these boxes:

- [ ] **Prompts are in a registry** (YAML, DB, config file — anything that's not a string literal in source code). Each prompt has a name and version.
- [ ] **Each pipeline block has its own model config.** Changing one block's model doesn't require changing any other block.
- [ ] **LLM outputs are logged with `user_action`, `action_delay_ms`, and `alternatives_shown`** (or your domain-specific equivalents).

That's it. Three decisions. Zero additional infrastructure cost. Zero performance overhead. And when you need optimisation loops — and you will — they're a configuration change instead of a rewrite.

Build the hooks. Use them when you're ready. The worst case is you added 50 lines of config management you never used. The expected case is you saved yourself a month of refactoring when your bill crosses $10K/month and someone asks "can we make this cheaper?"

The answer should be "yes, let me change a config file," not "yes, let me rewrite the pipeline."

## Bottom Line

**Read this if** you're about to build or are early in building an LLM pipeline and want to avoid the "optimisation requires rewrite" trap. The three decisions described here cost zero engineering effort to add now.

**Skip this if** your pipeline is already in production with proper prompt versioning, per-block model routing, and behavioural logging. You've already made these decisions — this article won't tell you anything new.
