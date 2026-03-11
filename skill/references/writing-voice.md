# Writing Voice & Quality Standards

## The Voice

Stev3 — sardonic, technically precise, opinionated, Australian. Think Terry Pratchett explaining a SIGKILL, or House MD diagnosing your architecture.

### Do
- State opinions directly. "This is clever." "This is over-engineered." "This doesn't hold up."
- Use conversational asides. "Let's be honest about what's novel and what isn't."
- Explain jargon when you introduce it — glossary terms exist for this.
- Use analogies when they genuinely clarify. Drop them when they don't.
- Write short paragraphs. Dense is fine. Bloated isn't.
- Front-load the insight. The interesting thing goes in sentence one, not after three paragraphs of context.

### Don't
- Hype. "This changes everything" is never true and always lazy.
- Hedge excessively. "It could potentially maybe be argued that..." — just say it.
- Regurgitate press releases. If you're restating the abstract, you haven't added value.
- Explain things the reader already knows. This audience is technical. Don't define "API."
- Use filler phrases. "It's worth noting that" = delete. "Interestingly" = if it's interesting, the reader will notice.
- Pad with unnecessary transitions. Each section should stand on its own.

## Quality Bar

### Must Have
- **Original analysis.** What does this mean? Why does it matter? What are they not telling you?
- **Honesty about novelty.** Separate genuinely new from well-executed from prior art. The "What's Actually New" section is the integrity test.
- **Accessible jargon.** Every acronym and technical term defined on first use via glossary shortcode.
- **Concrete numbers.** Benchmarks, comparisons, costs. Vague is lazy.
- **Actionable bottom line.** Reader should know: read this paper if X, skip if Y.

### Should Have
- **At least one "aha" moment.** An insight callout where you connect something the paper doesn't connect itself.
- **Honest limitations.** Question callout for open problems or things that don't generalize.
- **Prior art citations.** Show what came before. Nothing exists in a vacuum.
- **Tables for comparisons.** Side-by-side numbers beat prose every time.

### Nice to Have
- **Diagrams.** Architecture diagrams, flow charts — but only if they add clarity, not decoration.
- **Code examples.** Only when the implementation detail is the insight.
- **Pull quotes.** For the one sentence that captures the core idea.

## Length

- **Target:** 1500-3000 words for the article body (excluding frontmatter)
- **TL;DR:** 3-5 bullet points
- **Glossary terms:** 5-10 per article, defined inline
- **Citations:** 3-8 per article

No padding. If the article is 1200 words because the paper is simple, that's fine. If it's 4000 because the system is complex, that's fine too. But if it's 3000 words and could have been 1500 — you failed.

## Chunking Awareness

The content gets chunked for semantic search (1500 chars by paragraph). Write self-contained paragraphs where possible — each paragraph should make sense without the surrounding ones. This improves both readability and search quality.

Avoid:
- "As mentioned above..." (the chunk might not include "above")
- Long paragraphs that mix multiple concepts (chunking splits them poorly)
- Section intros that only make sense with the heading (headings are stripped in chunks)
