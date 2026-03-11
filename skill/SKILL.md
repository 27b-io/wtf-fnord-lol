---
name: wtf-writer
description: Write technical deep-dive articles for wtf.fnord.lol — papers, architectures, and systems explained without the bullshit. Use when creating, drafting, or editing deep-dive content for the WTF site. Covers research, structure, Zola shortcodes, glossary terms, citations, and deployment. NOT for site infrastructure changes (use CLAUDE.md in the repo).
---

# WTF Deep-Dive Writer

Write technically rigorous, opinionated deep dives for [wtf.fnord.lol](https://wtf.fnord.lol).

**Repo:** `~/code/wtf-fnord-lol`
**Stack:** Zola 0.19.2 + Cloudflare Workers
**Content dir:** `content/deep-dives/`
**Author voice:** Stev3 — sardonic, precise, Australian. Pratchett × House MD × Aurelius.

## Workflow

### 1. Research

Before writing, deeply understand the subject:

- Read the paper/docs/source. Not the blog post about it. The actual thing.
- Identify: what's genuinely new vs well-executed vs hype
- Find 3-5 key concepts that need glossary definitions
- Collect citations (author, year, title, URL)
- Form an opinion. "This is interesting because..." or "This matters because..." — if you can't finish that sentence, you haven't understood it yet.

### 2. Scaffold

```bash
bash <SKILL_DIR>/scripts/new-article.sh "slug-name" "Full Title"
```

Creates `content/deep-dives/<slug>/index.md` with frontmatter template.

### 3. Structure

Every deep dive follows this arc. Sections are flexible but the arc is not:

1. **One-sentence version** — what happened, in plain language
2. **TL;DR callout** — what/why/trick in 3 bullets
3. **The problem** — what existed before, why it wasn't enough
4. **The approach** — architecture, method, key decisions. Use glossary terms for jargon.
5. **Results** — numbers, comparisons, tables. Be honest about what's impressive vs expected.
6. **What's actually new** — genuinely novel vs well-executed vs prior art. This is the integrity section.
7. **Open questions** — what they didn't answer, what breaks, where this doesn't apply
8. **Bigger picture** — trend this fits into, implications, what it means for practitioners
9. **Bottom line** — read it if X, skip it if Y

Not every article needs every section. Short systems explainers might skip results. Architecture deep dives might expand the approach. But the arc — context → method → evaluation → honesty → implications — is non-negotiable.

### 4. Write

See `references/content-format.md` for frontmatter, shortcodes, and Zola conventions.
See `references/writing-voice.md` for tone, style, and quality standards.
See `references/example-structure.md` for how an actual article uses these patterns.

Key rules:
- **Glossary terms on first use.** Define jargon inline with `{{ glossary() }}` the first time. Reader shouldn't need to Google.
- **Cite everything.** Papers, blog posts, prior work — use `{{ cite() }}`.
- **Callouts for cognitive breaks.** TL;DR at top, insights for "aha" moments, questions for open problems, warnings for gotchas.
- **Tables for comparisons.** Numbers side-by-side, not buried in prose.
- **Code only when it clarifies.** Not for decoration. Pseudocode > real code unless the implementation detail matters.
- **Opinions are mandatory.** "This is well-executed but not novel" is more useful than a summary.

### 5. Quality Check

Before PR:

```bash
cd ~/code/wtf-fnord-lol && zola check
```

Verify:
- [ ] Every glossary term defined on first use
- [ ] All citations have URL, author, year
- [ ] TL;DR callout within first 200 words
- [ ] At least one insight or question callout
- [ ] "What's actually new" section is honest
- [ ] Bottom line gives clear read/skip guidance
- [ ] No unexplained acronyms
- [ ] Article works standalone — no assumed context from other articles

### 6. Deploy

```bash
cd ~/code/wtf-fnord-lol
git checkout -b content/<slug>
git add content/deep-dives/<slug>/
git commit -m "content: add <title> deep dive"
git push origin content/<slug>
# PR to main — CI builds, deploys, and indexes into Vectorize
```

Branch protection is enforced — always PR, never push to main.

## Content Types

### Paper Deep Dive (primary)
Academic paper → accessible explanation. Include `paper_url` and `paper_date` in frontmatter extra.

### Architecture Explainer
System/tool architecture → how it works and why. Include diagrams via `{{ figure() }}` where helpful.

### Comparison / State of the Art
Multiple approaches to a problem → what works, what doesn't, when to use which. Heavy on tables and callouts.

### Post-Mortem / Failure Analysis
What broke, why, lessons. Use `warning` callouts for the gotchas.

## Glossary Management

The site has a global glossary page (`content/glossary.md`) with `<dl>` entries. When introducing terms:

1. Use `{{ glossary(term="X", def="...") }}` inline on first use in each article
2. Add the term to `content/glossary.md` with a longer definition
3. Keep inline defs short (one sentence). Glossary page defs can be a paragraph.
