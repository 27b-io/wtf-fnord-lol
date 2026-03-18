# Section Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat chronological post list on `/deep-dives/` with a tabbed theme-grouped card grid featuring deterministic animated SVG hero images.

**Architecture:** Theme config in `_index.md` frontmatter, best-match tag algorithm in Tera template, deterministic SVG generator as build script (`generate-hero-svgs.ts`), CSS-only layered animations (ambient + hover reveal), vanilla JS tab switching with URL hash deep-linking.

**Tech Stack:** Zola (Tera templates), SCSS, TypeScript (build script), inline SVG with CSS animations.

**Spec:** `docs/superpowers/specs/2026-03-16-section-page-redesign-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `content/deep-dives/_index.md` | Theme definitions (name, slug, intro, match_tags) |
| `templates/section.html` | Tabbed layout, best-match assignment, card grid, tab JS |
| `sass/style.scss` | Theme tabs, post cards, SVG animations, responsive |
| `scripts/generate-hero-svgs.ts` | Deterministic SVG generator seeded by slug |
| `static/heroes/{slug}.svg` | Generated SVG files (committed) |
| `package.json` | `heroes` npm script |
| `.github/workflows/deploy.yml` | Run hero generation + verify before build |
| `.github/workflows/qa.yml` | Run hero generation + verify before build |

---

## Chunk 1: SVG Generator Script

### Task 1: Create `scripts/generate-hero-svgs.ts`

**Files:**
- Create: `scripts/generate-hero-svgs.ts`

This script follows the same pattern as `scripts/generate-glossary.ts`: walk `content/deep-dives/`, extract frontmatter, produce static output. It reuses `findMarkdownFiles` logic.

- [ ] **Step 1: Write the SVG generator script**

Create `scripts/generate-hero-svgs.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * Generate deterministic hero SVGs for each deep-dive post.
 * Reads post slugs from content/deep-dives/, generates unique
 * geometric SVG art seeded by slug hash.
 *
 * Usage: npx tsx scripts/generate-hero-svgs.ts
 */

import { readdirSync, statSync, writeFileSync, mkdirSync } from "fs";
import { basename, dirname, join, resolve } from "path";

// Site palette
const ACCENT = "#6cb4ee";
const WARM = "#c6a07a";
const BG = "#0a0a0f";

function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...findMarkdownFiles(full));
    } else if (entry.endsWith(".md") && entry !== "_index.md") {
      files.push(full);
    }
  }
  return files;
}

function extractSlug(filePath: string): string {
  return basename(dirname(filePath));
}

/** Simple seeded PRNG (mulberry32) */
function seededRng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a 32-bit integer */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function rangeF(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

interface SvgElement {
  ambient: string; // SVG markup for always-visible ambient layer
  hover: string; // SVG markup for hover-reveal layer
}

function generateElements(rng: () => number): SvgElement[] {
  const elements: SvgElement[] = [];
  const count = 3 + Math.floor(rng() * 3); // 3-5 primary elements

  for (let i = 0; i < count; i++) {
    const cx = rangeF(rng, 40, 260);
    const cy = rangeF(rng, 20, 100);
    const color = rng() > 0.3 ? ACCENT : WARM;
    const delay = rangeF(rng, 0, 6).toFixed(1);
    const duration = rangeF(rng, 5, 9).toFixed(1);
    const shape = pick(rng, ["circle", "ring", "line", "rect"]);

    let ambient = "";
    let hover = "";

    switch (shape) {
      case "circle": {
        const r = rangeF(rng, 2, 5);
        ambient = `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" opacity="0.5" class="ambient" style="animation-delay:${delay}s;animation-duration:${duration}s"/>`;
        break;
      }
      case "ring": {
        const r = rangeF(rng, 15, 35);
        ambient = `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.3" class="ambient-pulse" style="animation-delay:${delay}s;animation-duration:${duration}s"/>`;
        break;
      }
      case "line": {
        const x2 = cx + rangeF(rng, 30, 80);
        const y2 = cy + rangeF(rng, -20, 20);
        hover = `<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="0.5" opacity="0.4" class="hover-draw" stroke-dasharray="200" style="transition-delay:${(i * 0.15).toFixed(2)}s"/>`;
        break;
      }
      case "rect": {
        const w = rangeF(rng, 20, 60);
        const h = rangeF(rng, 2, 4);
        ambient = `<rect x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${color}" opacity="0.15" class="ambient" style="animation-delay:${delay}s;animation-duration:${duration}s"/>`;
        break;
      }
    }
    elements.push({ ambient, hover });
  }

  // Add 1-2 hover-only secondary dots
  const extraDots = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < extraDots; i++) {
    const cx = rangeF(rng, 60, 240);
    const cy = rangeF(rng, 25, 95);
    const color = rng() > 0.5 ? ACCENT : WARM;
    elements.push({
      ambient: "",
      hover: `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2" fill="${color}" opacity="0.5" class="hover-reveal"/>`,
    });
  }

  return elements;
}

function buildSvg(elements: SvgElement[]): string {
  const ambientParts = elements.map((e) => e.ambient).filter(Boolean);
  const hoverParts = elements.map((e) => e.hover).filter(Boolean);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120">
<rect width="300" height="120" fill="${BG}"/>
${ambientParts.join("\n")}
${hoverParts.join("\n")}
</svg>
`;
}

function main() {
  const contentDir = resolve(__dirname, "..", "content", "deep-dives");
  const outDir = resolve(__dirname, "..", "static", "heroes");
  mkdirSync(outDir, { recursive: true });

  const files = findMarkdownFiles(contentDir);
  const slugs = new Set(files.map(extractSlug));
  console.log(`Found ${slugs.size} unique slugs from ${files.length} content files...`);

  let count = 0;
  for (const slug of slugs) {
    const seed = hashString(slug);
    const rng = seededRng(seed);
    const elements = generateElements(rng);
    const svg = buildSvg(elements);

    const outPath = join(outDir, `${slug}.svg`);
    writeFileSync(outPath, svg);
    count++;
  }

  console.log(`Generated ${count} hero SVGs to ${outDir}`);
}

main();
```

- [ ] **Step 2: Run Prettier on the new file**

Run: `npx prettier --write scripts/generate-hero-svgs.ts`

- [ ] **Step 3: Run the script and verify output**

Run: `npx tsx scripts/generate-hero-svgs.ts`
Expected: `Scanning 17 content files...` / `Generated 17 hero SVGs to .../static/heroes`

Verify: `ls static/heroes/ | head -5` — should see `{slug}.svg` files.

- [ ] **Step 4: Verify typecheck and lint pass**

Run: `npm run typecheck && npm run lint`
Expected: Both pass.

- [ ] **Step 5: Add heroes npm script to package.json**

Modify `package.json`: add `"heroes": "tsx scripts/generate-hero-svgs.ts"` to the `scripts` block, after the existing `"glossary"` line.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-hero-svgs.ts static/heroes/ package.json
git commit -m "feat: add deterministic hero SVG generator"
```

---

## Chunk 2: Theme Configuration + Section Template

### Task 2: Add theme config to `_index.md`

**Files:**
- Modify: `content/deep-dives/_index.md`

- [ ] **Step 1: Add theme definitions to frontmatter**

Replace the entire file with:

```toml
+++
title = "Deep Dives"
sort_by = "date"
paginate_by = 20
template = "section.html"

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
+++
```

- [ ] **Step 2: Verify `zola build` still passes**

Run: `zola build`
Expected: Passes (frontmatter change doesn't break anything — themes are in `[extra]`).

- [ ] **Step 3: Commit**

```bash
git add content/deep-dives/_index.md
git commit -m "content: add theme definitions to deep-dives section"
```

### Task 3: Rewrite `templates/section.html`

**Files:**
- Modify: `templates/section.html`

This is the core of the redesign. The template needs to:
1. Read themes from `section.extra.themes`
2. For each page, compute best-match theme (highest tag overlap count)
3. Render tabs + card grids per theme
4. Render "Everything Else" overflow for unmatched posts
5. Include tab-switching JS with URL hash support

- [ ] **Step 1: Replace section.html with the full tabbed layout**

Replace the entire contents of `templates/section.html`:

```html
{% extends "base.html" %}

{% block content %}
{% if section.title %}
<div class="section-header">
  <h1>{{ section.title }}</h1>
  <p class="section-tagline">Papers, architectures, and systems explained without the bullshit</p>
</div>
{% endif %}

{# ── Theme tabs ──────────────────────────────── #}
{% if section.extra.themes %}
<div class="theme-tabs" role="tablist">
  {% for theme in section.extra.themes %}
  <button class="theme-tab{% if loop.first %} active{% endif %}"
          role="tab"
          aria-selected="{% if loop.first %}true{% else %}false{% endif %}"
          aria-controls="theme-{{ theme.slug }}"
          data-theme="{{ theme.slug }}"
          onclick="switchTab('{{ theme.slug }}')">
    {{ theme.name }}
  </button>
  {% endfor %}
</div>

{# ── Theme panels ────────────────────────────── #}
{% for theme in section.extra.themes %}
<div class="theme-panel{% if loop.first %} active{% endif %}"
     id="theme-{{ theme.slug }}"
     role="tabpanel">
  <p class="theme-intro">{{ theme.intro }}</p>

  <div class="card-grid">
    {# Best-match: assign each page to theme with highest tag overlap #}
    {% for page in section.pages %}
      {% set_global score = 0 %}
      {% if page.taxonomies.tags %}
        {% for tag in page.taxonomies.tags %}
          {% if theme.match_tags is containing(tag) %}
            {% set_global score = score + 1 %}
          {% endif %}
        {% endfor %}
      {% endif %}

      {# Check if this theme is the best match for this page #}
      {% set_global is_best = false %}
      {% if score > 0 %}
        {% set_global best_score = 0 %}
        {% set_global best_slug = "" %}
        {% for t in section.extra.themes %}
          {% set_global t_score = 0 %}
          {% if page.taxonomies.tags %}
            {% for tag in page.taxonomies.tags %}
              {% if t.match_tags is containing(tag) %}
                {% set_global t_score = t_score + 1 %}
              {% endif %}
            {% endfor %}
          {% endif %}
          {% if t_score > best_score %}
            {% set_global best_score = t_score %}
            {% set_global best_slug = t.slug %}
          {% endif %}
        {% endfor %}
        {% if best_slug == theme.slug %}
          {% set_global is_best = true %}
        {% endif %}
      {% endif %}

      {% if is_best %}
      <a href="{{ page.permalink }}" class="post-card">
        <img src="/heroes/{{ page.slug }}.svg" alt="" class="card-svg" loading="lazy"/>
        <div class="card-body">
          <h3 class="card-title">{{ page.title }}</h3>
          {% if page.description %}
          <p class="card-desc">{{ page.description | truncate(length=120) }}</p>
          {% endif %}
          <div class="card-meta">
            <span class="card-reading-time">{% if page.extra.reading_time %}{{ page.extra.reading_time }}{% else %}{{ page.reading_time }} min{% endif %}</span>
            {% if page.taxonomies.tags %}
            <span class="card-tags">
              {% for tag in page.taxonomies.tags | slice(end=3) %}
              <span class="post-tag">{{ tag }}</span>
              {% endfor %}
            </span>
            {% endif %}
          </div>
        </div>
      </a>
      {% endif %}
    {% endfor %}
  </div>
</div>
{% endfor %}

{# ── Everything Else (unmatched posts) ───────── #}
{% set_global has_overflow = false %}
{% for page in section.pages %}
  {% set_global matched = false %}
  {% if page.taxonomies.tags %}
    {% for theme in section.extra.themes %}
      {% for tag in page.taxonomies.tags %}
        {% if theme.match_tags is containing(tag) %}
          {% set_global matched = true %}
        {% endif %}
      {% endfor %}
    {% endfor %}
  {% endif %}
  {% if not matched %}
    {% set_global has_overflow = true %}
  {% endif %}
{% endfor %}

{% if has_overflow %}
<div class="theme-overflow">
  <h2 class="theme-overflow-title">Everything Else</h2>
  <ul class="post-list">
    {% for page in section.pages %}
      {% set_global matched = false %}
      {% if page.taxonomies.tags %}
        {% for theme in section.extra.themes %}
          {% for tag in page.taxonomies.tags %}
            {% if theme.match_tags is containing(tag) %}
              {% set_global matched = true %}
            {% endif %}
          {% endfor %}
        {% endfor %}
      {% endif %}
      {% if not matched %}
      <li>
        <a href="{{ page.permalink }}">
          <span class="post-date">{{ page.date | date(format="%Y-%m-%d") }}</span>
          <div class="post-title">{{ page.title }}</div>
          {% if page.description %}
          <div class="post-summary">{{ page.description }}</div>
          {% endif %}
          <span class="post-reading-time">{% if page.extra.reading_time %}{{ page.extra.reading_time }}{% else %}{{ page.reading_time }} min{% endif %}</span>
        </a>
      </li>
      {% endif %}
    {% endfor %}
  </ul>
</div>
{% endif %}

{% endif %}

<script>
function switchTab(slug) {
  document.querySelectorAll('.theme-tab').forEach(function(t) {
    var active = t.getAttribute('data-theme') === slug;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.theme-panel').forEach(function(p) {
    p.classList.toggle('active', p.id === 'theme-' + slug);
  });
  history.replaceState(null, '', '#' + slug);
}
(function() {
  var hash = location.hash.replace('#', '');
  if (hash && /^[A-Za-z0-9-]+$/.test(hash)) {
    var tab = document.querySelector('.theme-tab[data-theme="' + hash + '"]');
    if (tab) switchTab(hash);
  }
  var themeTabs = document.querySelector('.theme-tabs');
  if (themeTabs) themeTabs.addEventListener('keydown', function(e) {
    var tabs = Array.from(document.querySelectorAll('.theme-tab'));
    var idx = tabs.indexOf(document.activeElement);
    if (idx < 0) return;
    var next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    var slug = tabs[next].getAttribute('data-theme');
    if (slug && /^[A-Za-z0-9-]+$/.test(slug)) switchTab(slug);
  });
})();
</script>
{% endblock %}
```

**Key Tera patterns used:**
- `set_global` for ALL variables that are read after mutation inside a `for` loop — Tera's `set` creates a local scope shadow that prevents reads from seeing the mutated global. **Every** counter, flag, and accumulator must use `set_global` for both initialization and mutation.
- `is containing` for tag membership checks
- `truncate(length=120)` for description snippets
- `slice(end=3)` to limit visible tags per card

- [ ] **Step 2: Verify `zola build` passes**

Run: `zola build`
Expected: Passes, creates section page with themed cards.

- [ ] **Step 3: Commit**

```bash
git add templates/section.html
git commit -m "feat: tabbed theme layout with card grid for section page"
```

---

## Chunk 3: SCSS Styles + Animations

### Task 4: Add card and theme styles to `sass/style.scss`

**Files:**
- Modify: `sass/style.scss` (append before the `// ─── Responsive` section, around line 897)

- [ ] **Step 1: Add the theme and card styles**

Insert the following new SCSS sections before `// ─── Responsive`:

```scss
// ─── Section header ────────────────────────────

.section-header {
  text-align: center;
  margin-bottom: 2rem;

  h1 {
    font-family: $display;
    font-size: 2rem;
    font-weight: 700;
    color: $fg;
  }

  .section-tagline {
    font-family: $mono;
    font-size: 0.7rem;
    color: $fg-muted;
    margin-top: 0.4rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
}

// ─── Theme tabs ────────────────────────────────

.theme-tabs {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.theme-tab {
  font-family: $mono;
  font-size: 0.68rem;
  color: $fg-muted;
  background: rgba($accent, 0.04);
  border: 1px solid $border;
  border-radius: 3px;
  padding: 0.35em 0.8em;
  cursor: pointer;
  transition: color 0.2s, background 0.2s, border-color 0.2s;

  &:hover {
    color: $accent;
    background: rgba($accent, 0.08);
  }

  &.active {
    color: $accent;
    background: rgba($accent, 0.12);
    border-color: rgba($accent, 0.3);
  }
}

// ─── Theme panels ──────────────────────────────

.theme-panel {
  display: none;
  &.active { display: block; }
}

.theme-intro {
  font-family: $serif;
  font-size: 0.9rem;
  color: $fg-muted;
  line-height: 1.6;
  max-width: 600px;
  margin: 0 auto 1.5rem;
  text-align: center;
}

// ─── Card grid ─────────────────────────────────

.card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  max-width: 750px;
  margin: 0 auto;
}

.post-card {
  display: block;
  background: $bg-raised;
  border: 1px solid $border;
  border-radius: 6px;
  overflow: hidden;
  text-decoration: none;
  transition: border-color 0.3s, transform 0.2s;

  &:hover {
    border-color: $accent;
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 2px solid $accent;
    outline-offset: 2px;
  }
}

.card-svg {
  width: 100%;
  height: 100px;
  display: block;
  object-fit: cover;
}

.card-body {
  padding: 0.7rem 0.85rem;
}

.card-title {
  font-family: $display;
  font-size: 0.9rem;
  font-weight: 600;
  color: $fg;
  margin: 0 0 0.25rem;
  line-height: 1.3;
}

.card-desc {
  font-size: 0.72rem;
  color: $fg-muted;
  line-height: 1.5;
  margin: 0 0 0.5rem;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-reading-time {
  font-family: $mono;
  font-size: 0.6rem;
  color: $fg-dim;
}

.card-tags {
  display: flex;
  gap: 0.3rem;
}

// ─── SVG animations ────────────────────────────

@keyframes drift {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(3px, -2px); }
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

@keyframes rotate-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.ambient {
  animation: drift 8s ease-in-out infinite;
}

.ambient-pulse {
  animation: pulse 4s ease-in-out infinite;
}

.ambient-rotate {
  animation: rotate-slow 30s linear infinite;
  transform-origin: center;
}

.hover-reveal {
  opacity: 0;
  transition: opacity 0.5s ease;
}

.hover-draw {
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  transition: stroke-dashoffset 0.8s ease;
}

.post-card:hover .hover-reveal { opacity: 1; }
.post-card:hover .hover-draw { stroke-dashoffset: 0; }

@media (prefers-reduced-motion: reduce) {
  .ambient, .ambient-pulse, .ambient-rotate {
    animation: none !important;
  }
  .hover-draw {
    transition: none !important;
    stroke-dashoffset: 0 !important;
  }
  .hover-reveal {
    transition: none !important;
  }
}

// ─── Everything Else overflow ──────────────────

.theme-overflow {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid $border;
}

.theme-overflow-title {
  font-family: $mono;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: $fg-dim;
  margin-bottom: 1rem;
}
```

- [ ] **Step 2: Add responsive rules for cards**

In the existing `@media (max-width: 600px)` block (around line 949), add:

```scss
  .card-grid { grid-template-columns: 1fr; }

  .theme-tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    justify-content: flex-start;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 0.3rem;
  }

  .theme-tab { white-space: nowrap; }
```

- [ ] **Step 3: Verify `zola build` and visual check**

Run: `zola build`
Expected: Passes.

Run: `npm run dev` (or `zola serve`) and visually check `/deep-dives/` in a browser — should show tabs, cards with SVG heroes, working tab switching.

- [ ] **Step 4: Commit**

```bash
git add sass/style.scss
git commit -m "style: theme tabs, post cards, SVG animations for section page"
```

---

## Chunk 4: CI Integration + Verification

### Task 5: Add hero generation to CI pipelines

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `.github/workflows/qa.yml`

- [ ] **Step 1: Add hero generation step to deploy.yml**

After the `Generate glossary` step and its verify step, add:

```yaml
      - name: Generate hero SVGs
        run: npx tsx scripts/generate-hero-svgs.ts

      - name: Verify generated heroes are committed
        run: |
          git diff --exit-code static/heroes/ || (echo "ERROR: Generated hero SVGs differ from committed versions. Run 'npx tsx scripts/generate-hero-svgs.ts' and commit the results." && exit 1)
```

- [ ] **Step 2: Add hero generation step to qa.yml**

Same steps, added after the glossary generation/verify steps and before `Zola build`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml .github/workflows/qa.yml
git commit -m "ci: add hero SVG generation and verification to pipelines"
```

### Task 6: Full quality gate verification

- [ ] **Step 1: Run the full quality gate**

Run: `npm run check`
Expected: typecheck, lint, format, and `zola build` all pass.

- [ ] **Step 2: Run zola check**

Run: `zola check`
Expected: All internal links valid.

- [ ] **Step 3: Visual smoke test**

Run: `zola serve` and verify in browser:
1. `/deep-dives/` shows 4 theme tabs
2. Clicking tabs switches content, URL hash updates
3. Cards show SVG hero images with ambient animation
4. Hovering a card triggers lift + SVG hover reveal
5. Clicking a card navigates to the post
6. Posts with zero tag matches appear in "Everything Else" below tabs
7. Mobile viewport (<600px): tabs scroll horizontally, cards go single column
8. `prefers-reduced-motion`: all animations disabled

- [ ] **Step 4: Final commit if any fixes needed**

Only if prior steps required changes.
