# Example Article Structure

This shows how a paper deep dive uses the WTF format. Based on the KARL article (the site's first post).

## Arc

```text
## The One-Sentence Version          ← Hook. What happened, plain language.
   {{ glossary() }} on first jargon use

{% callout(type="tldr") %}           ← TL;DR within first 200 words
What / Why it matters / The trick
{% end %}

## What Problem Are They Solving?    ← Context. What existed, why it wasn't enough.
   Multiple paragraphs, no jargon without glossary.

## The Architecture                  ← Method. How it works.
   ### Sub-sections for components
   Tables for comparisons
   {{ glossary() }} for each new concept

## The Results                       ← Numbers. Honest.
   | Model | Metric | Cost |         ← Tables for comparisons
   {{ cite() }}                       ← Source your claims

   {% callout(type="insight") %}     ← The "aha" moment
   What this really means
   {% end %}

## What's Actually New Here?         ← The integrity section.
   **Genuinely new:** ...
   **Not new but well-executed:** ...
   **The real contribution:** ...

   {% callout(type="question") %}    ← Open problems
   What they didn't answer
   {% end %}

## The Bigger Picture                ← Trend, implications, what it means for you.

## Bottom Line                       ← Read if X. Skip if Y. Link to paper.
```

## Key Patterns

### Glossary — first use with inline definition
```markdown
took a cheap {{ glossary(term="MoE", def="Mixture of Experts — an architecture
with many expert sub-networks, only a few activated per input.") }} model
```

### Citation — author/year link
```markdown
The headline numbers {{ cite(key="karl2026", title="KARL: Knowledge Agents
via Reinforcement Learning", authors="Databricks", year="2026",
url="https://arxiv.org/abs/2603.05218") }}:
```

### Honesty section — separate novelty from execution
```markdown
**Genuinely new:**
- Off-policy GRPO with importance sampling for search agents

**Not new but well-executed:**
- Using RL to train search agents (see WebGPT)

**The real contribution** is the engineering: showing that you can combine
these pieces into a system that's both cheaper *and* better.
```

### Callout placement
- `tldr` — top, within first 200 words
- `insight` — after results or key technical section
- `question` — in "what's new" or "bigger picture"
- `warning` — gotchas, failure modes, things that don't generalize
