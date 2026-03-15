+++
title = "Editorial Review — Pass 2"
date = 2026-03-15
draft = true
render = false

[extra]
+++

# Editorial Review — Pass 2

**Date:** 2026-03-15
**Panel:** Le Guin (clarity serving complexity), Pratchett (wit as vehicle)
**Failure modes targeted:** Jargon accessibility, punchline landing, reader as student vs collaborator
**Word count:** ~2,969 (post-Pass 1 edits)

---

## Le Guin — Clarity and Implication

### What works
The "Accidentally CRDT-Shaped" section is the article's strongest moment. Each mapping (Memories → G-Set, Metadata → LWW-Register, etc.) earns its place — concrete, specific, and the reader can feel the pattern emerging before the insight callout names it. This is implication working correctly: the reader arrives at the conclusion just as the text does.

The supersede problem section treats the reader as a collaborator — it doesn't hide the weakness, and it trusts the reader to weigh the tradeoff themselves.

### What fails

1. **The comparison table's "N/A" column is a stacked deck.** "Fuzzy query tolerance" is a property unique to Ālaya's use case. Including it in a comparison with general-purpose databases is like comparing a submarine to a bicycle on "depth tolerance." It's not wrong, but it's not honest comparison either. Either remove the row or acknowledge that you're comparing systems designed for different purposes. The table is strongest without that row — the other five properties make the case genuinely.

2. **Eleven glossary terms is heavy.** The writing-voice standard says 5-10. Some of these are earning their keep (CRDT, eventual consistency, G-Set, SEC). Others are explaining things the target audience already knows (Redis, CockroachDB, Cassandra). A reader of a distributed-systems deep-dive on a technical blog doesn't need Redis defined. Keep the glossary terms for concepts that are genuinely jargon (CRDT primitives, SEC, Hebbian learning, idempotency). Drop the product definitions.

3. **The Formalisation section partially retreats from the article's own honesty.** After the Supersede Problem section admits the limits, and after "What You Actually Lose" enumerates the costs, the Formalisation section builds back to triumphalism: "No consensus protocol. No leader election. No split-brain scenarios." The qualifier ("For the 95% of operations...") is there but feels like a parenthetical concession after an assertion. Lead with the qualification: "For append and increment operations — the vast majority of the workload — SEC gives you mathematical guarantees without coordination."

### The annotation
> You have defined twelve terms for the reader. Ask yourself: for each one, is this a word the reader doesn't know, or a word you're explaining because the glossary shortcode is available? CockroachDB, Redis, Cassandra — these are products, not concepts. Your reader either knows them or can look them up. The concept definitions (G-Set, LWW-Register, G-Counter, SEC) are doing real work. The product definitions are treating the reader as a student. Cut the latter and the article breathes.

---

## Pratchett — Does the Joke Land?

### What works
"You just haven't admitted it yet" in the opening line — perfect. It's the setup for the entire article: the reader already suspects they know the answer, and now they're reading to confirm it. That's propulsive.

The armoured car line works because it's concrete, ridiculous, and accurate. That's a Pratchett-grade analogy: the absurdity *is* the argument.

The .zshrc/.zshenv example is good — specific, human, the kind of thing that makes a technical reader nod rather than glaze.

### What fails

1. **The description still says "accidentally CRDT-shaped" but the body now resolves to "inevitably."** This isn't a bug — it's a missed opportunity. The tension between "accidentally" (the title hook) and "inevitably" (the conclusion) is the entire joke. The article should lean into the comedy of this: "We called it 'accidentally CRDT-shaped' because that sounds like a discovery. Honestly, it's more like discovering your house is 'accidentally building-shaped.'" The punchline should acknowledge the joke it's making. Right now the article is serious about a fundamentally funny observation.

2. **"Be honest about them" (opening "What You Actually Lose") is a missed comedic beat.** The article is telling the reader it's about to be honest — which undercuts the honesty. Just *be* honest. Cut the preface. Start with "No global ordering."

3. **The Bottom Line punchline lands better now ("closer to CRDTs than you think. Lean into it.") but it's still a statement, not a revelation.** The article has done all the work to show why this is true. The punchline should make the reader feel clever for having followed the argument. Something like: "If your data is content-hashed, append-heavy, and similarity-searched, congratulations — you've already built a CRDT system. The only question is whether you'll formalise it or keep pretending it's eventual consistency with good vibes."

### The annotation
> The armoured car is doing its job. The punchline isn't. You've spent 2,500 words building a careful, honest case for why memory systems are inevitably CRDT-shaped. Then your closing line is... a summary. That's like building a fireworks display and ending with a PowerPoint slide that says "fireworks happened." Give me the image. Give me the line that makes the reader want to send this to their infrastructure team. "Lean into it" is advice. I want a laugh that carries an idea.

---

## Consensus Issues (flagged by 2+ personas)

1. **Glossary terms need pruning** — product definitions (Redis, CockroachDB, Cassandra) should be removed; keep concept definitions only. (Le Guin focus, supported by WTF voice standards.)
2. **The punchline needs sharpening** — currently a summary, needs to be a revelation. (Pratchett + Le Guin both flag this.)

## Minor Polish

- Remove "Fuzzy query tolerance" row from comparison table
- "Be honest about them" → cut, start directly with first loss
- Reorder Formalisation paragraph to lead with the qualification

## Actions

1. Remove glossary wrappers from Redis, CockroachDB, Cassandra, Riak, Automerge (keep the names, lose the tooltips)
2. Remove "Fuzzy query tolerance" row from comparison table
3. Cut "Eventual consistency costs you things. Be honest about them." → Start with "**No global ordering.**"
4. Sharpen the Bottom Line punchline
5. Reorder the SEC claim in The Formalisation to lead with qualification
