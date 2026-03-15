# Deep Dives Section Page Redesign

## Problem

The `/deep-dives/` section page is a flat chronological list (date, title, description, reading time). It underserves both discovery and reference use cases:

- No visual grouping — ~17 posts across disparate topics presented identically
- No theme or series information shown (despite being available in metadata)
- Tags not displayed (now clickable on post pages but invisible on the section page)
- No visual identity per post — every entry looks the same
- Homepage is richer than the section page (already shows series badges)

## Design

### Layout: Tabbed Theme Groups with Card Grid

The section page becomes a **tabbed interface** with 4 theme groups:

| Theme | Posts | Match Tags |
|-------|-------|------------|
| Recommendation Systems | Signal Fusion, Two-Tower, Negative Signals, Signal Stability, Notification Bandits, Filter Bubble | `recommendation-systems`, `retrieval`, `ranking`, `negative-signals` |
| Personalization & Behavior | Temporal Aggregation, Intention-Action Gaps, Through-Line Detection, Query-Theme Expansion, Empathy Architecture | `personalization`, `behavioral-analytics`, `llm-capabilities` |
| LLM Architecture | Single Call to Deep Agent, Multi-Artifact Output, Offline Agent Pattern, KARL | `llm-agents`, `structured-output`, `migration`, `rag`, `offline-computation` |
| ML Fundamentals | WTF LightGBM, Two-Tower (if not matched elsewhere) | `machine-learning`, `gradient-boosting`, `tabular-data` |

Each tab shows:
1. Theme name as tab label (horizontal bar, centered)
2. 1-2 sentence curator intro blurb below tabs
3. 2-column card grid of posts belonging to that theme

**Tab switching**: Vanilla JS, no page reload. URL hash updates on tab switch (`#rec-systems`, `#personalization`, etc.) for deep-linking. Default tab on load: first theme, or hash-specified theme.

**Mobile (<700px)**: Tabs become horizontally scrollable strip (`overflow-x: auto`). Cards go single-column.

### Theme Configuration: Data-Driven Mapping

Themes defined in `content/deep-dives/_index.md` frontmatter:

```toml
[[extra.themes]]
name = "Recommendation Systems"
slug = "rec-systems"
intro = "How modern rec systems retrieve, rank, and serve content at scale."
match_tags = ["recommendation-systems", "retrieval", "ranking", "negative-signals"]

[[extra.themes]]
name = "Personalization & Behavior"
slug = "personalization"
intro = "Understanding users through what they do, not what they say."
match_tags = ["personalization", "behavioral-analytics", "llm-capabilities"]

[[extra.themes]]
name = "LLM Architecture"
slug = "llm-arch"
intro = "Patterns for building real systems with large language models."
match_tags = ["llm-agents", "structured-output", "migration", "rag", "offline-computation"]

[[extra.themes]]
name = "ML Fundamentals"
slug = "ml-fundamentals"
intro = "The algorithms and architectures underneath everything else."
match_tags = ["machine-learning", "gradient-boosting", "tabular-data"]
```

### Post-to-Theme Assignment: Best Match

For each post, count how many of its tags intersect each theme's `match_tags`. Assign the post to the theme with the **highest overlap count**. Ties broken by theme order in config. Each post appears exactly once. Posts matching zero themes go to an "Everything Else" overflow section at the bottom.

**"Everything Else" overflow**: Rendered as a simple post-list (the current flat format — date, title, description, reading time) below all themed tabs. Visible regardless of which tab is active. Headed with "Everything Else" in the same style as theme intros. No cards, no SVGs — just a clean list for uncategorized posts.

This is computed in the Tera template via nested loops (O(pages × themes × tags) — trivial at build time).

### Post Cards with Deterministic SVG Art

Each card shows:
- **Hero image** (~100px height): Procedurally generated SVG, unique per post
- **Title**: Post title
- **Description snippet**: First ~100 chars of post description
- **Footer**: Reading time + 2-3 most relevant tags as clickable badges

#### SVG Generation

`scripts/generate-hero-svgs.ts` — deterministic SVG generator:

- **Input**: Reads all posts from `content/deep-dives/`, extracts slug + tags
- **Output**: Writes `static/heroes/{slug}.svg` per post
- **Determinism**: Slug string hashed to seed a PRNG. Same slug always produces the same visual
- **Pattern vocabulary**: Circles, lines, rectangles, arcs — geometric/minimal style using the site palette (`#6cb4ee` accent, `#c6a07a` warm accent, low opacity on `#0a0a0f` backgrounds)
- **Size**: ~1-2KB per SVG, 16 files total
- **CI integration**: Runs before `zola build` in both deploy and QA workflows. SVGs are **committed to the repo** (like glossary.md). QA pipeline verifies generated output matches committed files via `git diff --exit-code`. `static/heroes/` is checked in, not gitignored.

#### SVG Animations: Layered CSS

Two animation layers, both pure CSS (zero JS dependencies):

**Ambient (always running):**
- `drift`: Elements slowly translate 2-3px over 6-8s, ease-in-out, infinite
- `pulse`: Opacity cycles between 0.2-0.5 over 3-5s
- `rotate-slow`: Gentle 360° rotation over 20-30s for ring/orbit elements
- Staggered `animation-delay` per element so cards don't sync

**Hover reveal (on `.post-card:hover`):**
- `stroke-dashoffset` transitions draw connection lines (0.6-0.8s ease)
- Opacity transitions fade in secondary elements (0.4-0.6s ease)
- Staggered `transition-delay` for sequential reveal feel

**Accessibility:**
```css
@media (prefers-reduced-motion: reduce) {
  .ambient, .ambient-pulse, .ambient-rotate { animation: none !important; }
  .hover-draw { transition: none !important; stroke-dashoffset: 0 !important; }
  .hover-reveal { transition: none !important; }
}
```

**Performance**: All animations use GPU-composited properties only (`transform`, `opacity`, `stroke-dashoffset`). 16 cards × ~3 animated elements = ~48 CSS animations. No layout-triggering properties. No JS animation loops.

### Card Interaction

- **Hover**: Card lifts slightly (`translateY(-2px)`), border transitions to accent color, SVG hover layer reveals
- **Click**: Navigates to the post (entire card is an `<a>` tag)
- **Focus**: Visible focus ring for keyboard navigation

### Post Card as Reusable Component

The `.post-card` markup and SVG heroes are **not section-page-specific**. SVGs live at `static/heroes/{slug}.svg`, referenceable from any template via `/heroes/{{ page.slug }}.svg`. The card partial can be extracted to `templates/partials/post-card.html` and included from:

- `templates/section.html` — themed card grid (this spec)
- `templates/index.html` — homepage post list (future, replaces current flat list)
- `templates/page.html` — "related posts" or prev/next navigation (future)
- Tag/series taxonomy pages (future)

This spec implements the card in `section.html` first. Extracting it to a partial is a natural follow-up once the design is validated.

## Files Modified

| File | Changes |
|------|---------|
| `content/deep-dives/_index.md` | Add `[extra.themes]` array with 4 theme definitions + intro blurbs |
| `templates/section.html` | Replace flat list with tabbed theme groups, card grid layout, SVG hero images, tab-switching JS |
| `sass/style.scss` | New sections: `.theme-tabs`, `.theme-tab`, `.post-card`, `.card-svg`, `.card-body`, animation keyframes, responsive breakpoints |
| `scripts/generate-hero-svgs.ts` | **NEW** — deterministic SVG generator seeded by post slug |
| `package.json` | Add `"heroes"` script |
| `.github/workflows/deploy.yml` | Run hero SVG generation before build |
| `.github/workflows/qa.yml` | Run hero SVG generation before build |

No changes to individual post files. No new taxonomies. Theme configuration lives entirely in `_index.md` frontmatter.

## What This Does NOT Include

- No changes to the homepage (`index.html`) — future candidate for card reuse but not in this scope
- No changes to individual post pages (`page.html`) — future candidate for hero SVG in post header
- No JavaScript framework or build tool additions
- No changes to the search system
- No server-side rendering changes (worker stays untouched)
