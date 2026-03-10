+++
title = "From Single LLM Call to Deep Agent: An Honest Migration Path"
description = "Start with one function call. Add skills when the prompt gets too long. A no-framework guide to building agents that actually ship."
date = 2026-03-10

[taxonomies]
tags = ["llm-agents", "architecture", "migration", "langgraph"]
series = ["architecture-deep-dives"]

[extra]
reading_time = "12 min"
+++

## The One-Sentence Version

Build the simplest thing that could possibly work, persist its context to a file, and only migrate to a framework when the empirical signals tell you to — not when a conference talk makes you feel bad.

{% callout(type="tldr") %}
**What:** A migration path from a single LLM call with structured output to a LangGraph Deep Agent with skills, sub-agents, and a virtual filesystem.
**Why it matters:** Most teams over-engineer immediately or under-invest until it's painful. This is the empirical signal set for knowing which one you are.
**The trick:** A persistent context file gives you cross-cycle memory without a backend, an orchestration framework, or a single dependency. That's the sneaky-smart bit.
{% end %}

## The Problem Nobody Admits

Here is the most common trajectory for AI product development in 2026: a team gets excited, reads about {{ glossary(term="deep agents", def="AI systems that operate over multiple reasoning steps, use tools, maintain state, and can spawn sub-agents — as opposed to single-shot LLM calls that take an input and return an output.") }}, spends six weeks wiring up LangGraph, Temporal, and a Redis-backed memory store, ships nothing, and then argues about whether to switch to a different orchestration framework.

The alternative failure mode: a team ships a single LLM call in production, it works great for four months, and then someone notices the prompt is 8,000 tokens long and contains three contradictory instructions and a complete encyclopedia of edge cases. They add more instructions. The model starts ignoring old ones. They add retry logic. Then a cache. Then some routing. Then one day they look up and realise they have built, badly, the same architecture they could have designed intentionally at the start.

Both failures are real. Both are avoidable. What's required is an honest answer to the question: *when does a single LLM call stop being sufficient?*

The answer isn't philosophical. It's empirical. And the migration path has checkpoints.

## V1: The Honest Minimum Viable Agent

Let's be precise about what V1 actually is, because "single LLM call" undersells it.

V1 is:
1. One LLM call with structured output (a Pydantic schema, a JSON mode, whatever your model supports)
2. A persistent context file on disk

That second part is the thing people skip, and it's a mistake. Here's the shape of it:

```python
import json
from pathlib import Path
from anthropic import Anthropic

CONTEXT_FILE = Path("agent_context.json")

def load_context() -> dict:
    if CONTEXT_FILE.exists():
        return json.loads(CONTEXT_FILE.read_text())
    return {"history": [], "state": {}, "version": 1}

def save_context(ctx: dict) -> None:
    CONTEXT_FILE.write_text(json.dumps(ctx, indent=2))

def run_agent_cycle(user_input: str) -> dict:
    ctx = load_context()

    response = Anthropic().messages.create(
        model="claude-opus-4-6",
        max_tokens=2048,
        system=build_system_prompt(ctx["state"]),
        messages=ctx["history"] + [{"role": "user", "content": user_input}],
    )

    result = parse_structured_output(response.content[0].text)

    ctx["history"].append({"role": "user", "content": user_input})
    ctx["history"].append({"role": "assistant", "content": response.content[0].text})
    ctx["state"].update(result.get("state_updates", {}))

    save_context(ctx)
    return result
```

This is not a toy. This is a legitimately useful production system. It has:

- **Cross-cycle memory** without a database, without a vector store, without a framework
- **Structured output** that downstream systems can actually consume
- **State accumulation** across invocations — the agent knows what it decided last time
- **Zero infrastructure dependencies** beyond an API key and a filesystem

{{ glossary(term="persistent context", def="State persisted between agent invocations — allowing an LLM agent to remember decisions, user preferences, and history across multiple calls without a backend database.") }} is the pattern here. The JSON file is not a hack; it's a deliberate architectural choice. For a single-tenant use case, or a per-user file per tenant, this scales further than you think.

{% callout(type="insight") %}
**The insight most people miss:** You don't need a vector database to have memory. You need a file. Vector search is for recall across a large corpus — not for the agent knowing what it decided an hour ago. Reach for the file first.
{% end %}

What V1 genuinely cannot do:
- Run multiple tools concurrently
- Break a complex task into sub-problems with independent execution
- Track experiments or A/B tests across users
- Let a team of engineers develop independent capabilities without stepping on each other

When you hit one of those four walls, you have empirical evidence that it's time to migrate. Not before.

## The Migration Signals (Empirically)

These are not theoretical thresholds. They're the patterns that show up in production logs and sprint retros before teams realise they've outgrown V1.

**Signal 1: Your context file is growing faster than your features.**

When the JSON is 50KB and growing, it's no longer a context file — it's a badly-structured database. The solution is not to compress it; it's to add a proper state layer. This is also the moment when {{ glossary(term="virtual filesystem", def="A per-agent or per-user filesystem abstraction — a directory tree of files that the agent treats as its working memory, analogous to a human's scratch pad and long-term storage.") }} per user starts making sense.

**Signal 2: Your prompt has conditional branches.**

```
If the user is in the experiment group, use the new carousel logic.
If they've been using the app for more than 30 days, show the advanced options.
If it's a weekend, reduce push notification frequency unless...
```

When your system prompt reads like a Bash script, you've outgrown the system prompt. The conditional logic belongs in code, and the skill architecture is where that code lives.

**Signal 3: Two engineers are editing the same prompt.**

This is the social signal. When more than one person needs to change the core prompt to add a feature, you have an integration bottleneck that will create bugs and resentment in roughly equal measure. {{ glossary(term="skills", def="Self-contained capability modules that an agent can invoke — each skill has its own prompt, tools, and state, developed and deployed independently.") }} exist to solve this. When you need independent skill development, you need the architecture that supports it.

**Signal 4: You're retrying the same call with different phrasings.**

If you're catching structured output failures and retrying with a different prompt, you're implementing, badly, the planning loop that a proper agent gives you for free. Migration cost: you stop paying the retry tax and start paying the orchestration tax. The orchestration tax is lower.

**Signal 5: Someone asks "can we track which approach is working better?"**

The moment experiment tracking becomes a requirement, V1 is structurally insufficient. The context file has no notion of cohort, variant, or metric. You need an experiment layer, and that belongs in the agent architecture — not bolted onto the file.

## V2+: The LangGraph Deep Agent

{{ glossary(term="LangGraph", def="A framework for building stateful, multi-actor LLM applications as directed graphs — nodes are callables (LLM calls, tools, functions), edges are conditional transitions.") }} is not the only answer here, but it's a good one and I'll use it concretely because vague framework discussions are useless.

The V2 architecture for a personalisation agent (which is the use case this migration path was built around) looks like this:

```
User Request
    ↓
[Planning Node] — decides which skills to invoke
    ↓
[Skill Router] ──→ search-personalisation
               ──→ carousel-generation
               ──→ push-notification
               ──→ experiment-design
    ↓
[Synthesis Node] — combines skill outputs
    ↓
[State Persistence] — writes to virtual filesystem
    ↓
Structured Response
```

Each {{ glossary(term="skills", def="Self-contained capability modules that an agent can invoke — each skill has its own prompt, tools, and state, developed and deployed independently.") }} node is a self-contained LangGraph subgraph. It has its own system prompt, its own tools, its own state schema. The search-personalisation skill knows about user search history and content preferences. The carousel-generation skill knows about layout rules and asset constraints. The push-notification skill knows about send-time optimisation and opt-out states. None of them need to know about each other.

This is {{ glossary(term="progressive disclosure", def="An architectural principle where complexity is hidden until it's needed — users and systems see only the relevant interface for their current task, with more detail available on demand.") }} at the architecture level. The planning node sees a high-level task; the skill node sees a focused sub-problem; the synthesis node sees only the outputs.

{% callout(type="warning") %}
**The trap:** Teams new to LangGraph often make every node a full LLM call. Don't. Some nodes should be pure Python — routing decisions, output validation, state updates. LLM calls are expensive and slow. Use them only where the reasoning is genuinely needed.
{% end %}

### The Virtual Filesystem

This is the part that sounds clever until you realise it's just a directory.

```
users/
  {user_id}/
    context.json        ← V1's context file, now per-user
    experiments/
      search-v2.json    ← which variant they're in
      carousel-v3.json
    history/
      2026-03-10.jsonl  ← append-only event log
    state/
      preferences.json  ← derived preferences, updated by skills
      signals.json      ← behavioural signals
```

The {{ glossary(term="virtual filesystem", def="A per-agent or per-user filesystem abstraction — a directory tree of files that the agent treats as its working memory, analogous to a human's scratch pad and long-term storage.") }} gives each skill its own namespace. The search-personalisation skill reads and writes `state/preferences.json`. The experiment-design skill owns `experiments/`. They don't stomp on each other. Engineers can develop them independently. You can test them independently. You can roll back a skill by reverting its files.

This is not a novel idea. It's git. For agents.

```python
from langgraph.graph import StateGraph, END
from pathlib import Path
import json

class AgentState(TypedDict):
    user_id: str
    task: str
    skill_outputs: dict
    filesystem_root: Path

def load_user_context(state: AgentState) -> AgentState:
    root = state["filesystem_root"] / state["user_id"]
    root.mkdir(parents=True, exist_ok=True)

    context_file = root / "context.json"
    if context_file.exists():
        ctx = json.loads(context_file.read_text())
    else:
        ctx = {"preferences": {}, "signals": {}}

    return {**state, "user_context": ctx}

def planning_node(state: AgentState) -> AgentState:
    # Decide which skills to invoke based on task + context
    # Pure Python or single LLM call — not a complex subgraph
    skills_needed = route_to_skills(state["task"], state["user_context"])
    return {**state, "skills_needed": skills_needed}
```

### Sub-Agents for Parallelism

When skills can run independently (and they usually can), {{ glossary(term="deep agents", def="AI systems that operate over multiple reasoning steps, use tools, maintain state, and can spawn sub-agents — as opposed to single-shot LLM calls that take an input and return an output.") }} support parallel execution. In LangGraph, this is a fan-out / fan-in pattern:

```python
workflow = StateGraph(AgentState)

workflow.add_node("planning", planning_node)
workflow.add_node("search_personalisation", search_personalisation_skill)
workflow.add_node("carousel_generation", carousel_generation_skill)
workflow.add_node("synthesis", synthesis_node)

# Fan-out: planning decides which skills run in parallel
workflow.add_conditional_edges(
    "planning",
    route_skills,
    {
        "search_only": "search_personalisation",
        "carousel_only": "carousel_generation",
        "both": ["search_personalisation", "carousel_generation"],  # parallel
    }
)

# Fan-in: synthesis waits for all skills
workflow.add_edge("search_personalisation", "synthesis")
workflow.add_edge("carousel_generation", "synthesis")
```

This is the structural reason you migrate: not for the framework, but for the fan-out. When two skills can run concurrently and you're running them sequentially, you're leaving latency on the table. The architecture earns its complexity by recovering that latency.

{{ cite(key="langgraph2024", title="LangGraph: Building Stateful, Multi-Actor Applications with LLMs", authors="LangChain Team", year="2024", url="https://github.com/langchain-ai/langgraph") }}

## What's Actually New

The literature on agent architectures is full of framework comparisons and benchmark numbers. What gets less attention is the migration economics — the actual cost of the transition, measured in engineering-hours and system complexity.

Here's the honest accounting:

**V1 → V2+ migration cost:**
- ~1 sprint to extract skills from the monolithic prompt
- ~1 sprint to wire up LangGraph and test the graph
- ~0.5 sprints to migrate the context file to the virtual filesystem structure
- Ongoing: per-skill testing becomes possible, which is a permanent improvement

**V1 → V2+ complexity cost:**
- You now have a graph to debug instead of a prompt to edit
- Distributed state means more failure modes
- The planning node can make wrong routing decisions that are hard to inspect
- LangGraph's checkpointing needs a backend (SQLite works fine for most cases)

{{ cite(key="agentic2025", title="Agentic Workflows: Patterns and Anti-Patterns", authors="Harrison Chase", year="2025", url="https://blog.langchain.dev/agentic-workflows/") }}

The break-even on this cost is roughly Signal 3: when two engineers are blocked by the same prompt, the coordination cost of the monolith exceeds the maintenance cost of the architecture. Before that point, the graph is overhead. After it, the graph is load-bearing.

{% callout(type="insight") %}
**Opinion, stated plainly:** Most teams migrate too early. The LLM-call-plus-context-file pattern is underrated because it's boring. It doesn't make for good conference talks. But it ships, it's debuggable, and a production system that ships is worth ten elegant architectures that don't. Resist the pull toward framework adoption until the empirical signals are there.
{% end %}

## Open Questions

**When does the virtual filesystem break?**

At some scale of users or history depth, reading and writing files per-cycle becomes the bottleneck. The migration path from files to a proper store (SQLite → Postgres → vector search for retrieval) is well-understood, but the trigger point varies enormously by use case. For a daily-cycle personalisation agent (runs once per user per day), files are probably fine at 100k users. For a real-time agent processing events continuously, you'll hit limits much sooner.

**How do you test a planning node?**

Unit testing individual skills is straightforward — they're functions with typed inputs and outputs. Testing the planning node requires a different approach: you need golden examples of (task, context) → expected skill routing, and you need to track when the planner diverges from expected routes. This is a solved problem in classification systems; it's not yet solved cleanly in agent frameworks. Most teams default to eyeballing it in production, which is a mistake.

**What happens when a skill contradicts another?**

The synthesis node has to resolve conflicts between skill outputs, and that resolution logic is itself a prompt or a rule set. When the search-personalisation skill says "show diverse content" and the experiment variant says "show similar content," something has to win. The answer is usually "whoever the product manager decided wins," but encoding that decision in a way that's legible and maintainable is harder than it sounds.

{{ cite(key="agents2025", title="The Future of AI Agents", authors="Anthropic", year="2025", url="https://www.anthropic.com/research/building-effective-agents") }}

## The Bigger Picture

The {{ glossary(term="agent migration", def="The process of transitioning an LLM application from a simpler architecture (single call, fixed prompt) to a more capable one (multi-step, multi-skill, stateful) — ideally triggered by empirical signals rather than hype.") }} question is a microcosm of a bigger pattern in software development: the premature optimisation failure mode, now applied to AI systems.

We have a tendency to reach for the most powerful tool before we understand the problem. LangGraph, AutoGen, CrewAI — these are powerful tools. They're also heavyweight. They come with learning curves, debugging surfaces, and dependencies. The cost of that complexity is real and ongoing.

The persistent context file is, genuinely, the sneaky-smart thing in this article. It's not glamorous. It's a JSON file. But it buys you cross-cycle memory without the complexity tax of a framework, and it gives you something even more valuable: time to understand your actual problem before you commit to an architecture for it.

Most AI products change their requirements three times in the first six months. A single LLM call with a JSON file changes in fifteen minutes. A LangGraph graph with four skills and a custom state schema changes in an afternoon. Choose your architecture based on how often your requirements change, not on how impressive it looks in a diagram.

{{ cite(key="building-effective-agents-2024", title="Building Effective Agents", authors="Anthropic", year="2024", url="https://www.anthropic.com/research/building-effective-agents") }}

## Bottom Line

Start with a single LLM call. Add structured output. Persist the context to a file. Ship it. Measure it.

Migrate to a deep agent architecture when **two of the five signals are present** — not before. The signals are: context file growing faster than features, prompt with conditional branches, two engineers editing the same prompt, retry loops over structured output failures, experiment tracking requirements.

When you do migrate, use LangGraph (or equivalent), give each skill its own namespace in a virtual filesystem, use pure Python for routing and validation, and only make LLM calls where the reasoning is genuinely required.

The goal is not to build the most sophisticated agent. The goal is to build the agent that solves the problem, no more complex than necessary, at the moment the problem requires it.

Everything else is cargo cult architecture — a bamboo runway for planes that aren't coming.
