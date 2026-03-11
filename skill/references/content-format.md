# Content Format Reference

## Frontmatter (TOML)

```toml
+++
title = "Full Article Title"
description = "One sentence that hooks — what happened and why it matters."
date = 2026-03-09

[taxonomies]
tags = ["tag1", "tag2", "tag3"]
series = ["series-name"]

[extra]
paper_url = "https://arxiv.org/abs/..."    # optional, for paper reviews
paper_date = "2026-03-05"                   # optional
reading_time_original = "77 pages"          # optional, original paper length
+++
```

**Tags:** lowercase, hyphenated. Use existing tags where possible. Common: `reinforcement-learning`, `rag`, `paper-review`, `architecture`, `infrastructure`.

**Series:** group related articles. Existing: `paper-deep-dives`.

## Shortcodes

### Callout (block)
```
{% callout(type="tldr") %}
Content here. Supports **markdown**.
{% end %}
```
Types: `tldr` (📋), `insight` (💡), `warning` (⚠️), `question` (❓), `note` (📌 default).

### Glossary (inline)
```
{{ glossary(term="GRPO", def="Group Relative Policy Optimization — generates a group of outputs, ranks them relative to each other, reinforces the best. No value model needed.") }}
```
Renders as tooltip on hover. Define on first use per article. Keep def to one sentence.

### Citation (inline)
```
{{ cite(key="karl2026", title="KARL: Knowledge Agents via RL", authors="Databricks", year="2026", url="https://arxiv.org/abs/2603.05218") }}
```
Renders as `[Databricks 2026]` with link. References auto-collected at bottom.

### Figure (block)
```
{{ figure(src="diagram.png", caption="Architecture overview") }}
```
Images go in the article directory (e.g., `content/deep-dives/my-article/diagram.png`). Supports lightbox zoom.

### Code Compare (block)
```
{% code_compare(label_a="Before", label_b="After") %}
\`\`\`python
old_code()
\`\`\`
{% end %}
```
Side-by-side code comparison panels.

### Pull Quote (block)
```
{% pull_quote() %}
The important insight goes here.
{% end %}
```
Optionally: `{% pull_quote(cite="Author Name") %}`

## Markdown Conventions

- **Headers:** `##` for major sections, `###` for subsections. `#` is reserved for the title (auto-generated from frontmatter).
- **Tables:** Standard markdown. Used for comparisons and results.
- **Code blocks:** Fenced with language identifier. Use sparingly — only when implementation matters.
- **Links:** Standard markdown. External links open in new tab via template.
- **Bold/italic:** `**bold**` for emphasis, `*italic*` for terms or asides.
- **Horizontal rules:** `---` to separate major conceptual shifts within a section.

## File Structure

```
content/deep-dives/
└── my-article-slug/
    ├── index.md          # The article
    ├── diagram.png       # Optional images
    └── architecture.svg  # Optional diagrams
```

Each article is a directory (Zola page bundle) so images are co-located.

## Vectorize Indexing

After deploy, CI runs `npx tsx scripts/index-content.ts` which:
- Strips shortcodes from text
- Chunks at 1500 chars by paragraph boundary
- Embeds with `bge-base-en-v1.5`
- Upserts to Vectorize index `wtf-content`
- Vector IDs: `{slug}-{chunk_index}`

This powers the semantic search and RAG chat. Write with chunking in mind — self-contained paragraphs index better than paragraphs that depend on surrounding context.
