#!/usr/bin/env tsx
/**
 * Generate deterministic hero SVGs for each deep-dive post.
 * Reads post slugs from content/deep-dives/, generates unique
 * geometric SVG art seeded by slug hash.
 *
 * Usage: npx tsx scripts/generate-hero-svgs.ts
 */

import { readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

// Site palette
const ACCENT = '#6cb4ee';
const WARM = '#c6a07a';
const BG = '#0a0a0f';

function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...findMarkdownFiles(full));
    } else if (entry.endsWith('.md') && entry !== '_index.md') {
      files.push(full);
    }
  }
  return files;
}

function extractSlug(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 2];
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
  ambient: string;
  hover: string;
}

function generateElements(rng: () => number): SvgElement[] {
  const elements: SvgElement[] = [];
  const count = 3 + Math.floor(rng() * 3);

  for (let i = 0; i < count; i++) {
    const cx = rangeF(rng, 40, 260);
    const cy = rangeF(rng, 20, 100);
    const color = rng() > 0.3 ? ACCENT : WARM;
    const delay = rangeF(rng, 0, 6).toFixed(1);
    const duration = rangeF(rng, 5, 9).toFixed(1);
    const shape = pick(rng, ['circle', 'ring', 'line', 'rect']);

    let ambient = '';
    let hover = '';

    switch (shape) {
      case 'circle': {
        const r = rangeF(rng, 2, 5);
        ambient = `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" opacity="0.5" class="ambient" style="animation-delay:${delay}s;animation-duration:${duration}s"/>`;
        break;
      }
      case 'ring': {
        const r = rangeF(rng, 15, 35);
        ambient = `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.3" class="ambient-pulse" style="animation-delay:${delay}s;animation-duration:${duration}s"/>`;
        break;
      }
      case 'line': {
        const x2 = cx + rangeF(rng, 30, 80);
        const y2 = cy + rangeF(rng, -20, 20);
        hover = `<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="0.5" opacity="0.4" class="hover-draw" stroke-dasharray="200" style="transition-delay:${(i * 0.15).toFixed(2)}s"/>`;
        break;
      }
      case 'rect': {
        const w = rangeF(rng, 20, 60);
        const h = rangeF(rng, 2, 4);
        ambient = `<rect x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${color}" opacity="0.15" class="ambient" style="animation-delay:${delay}s;animation-duration:${duration}s"/>`;
        break;
      }
    }
    elements.push({ ambient, hover });
  }

  const extraDots = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < extraDots; i++) {
    const cx = rangeF(rng, 60, 240);
    const cy = rangeF(rng, 25, 95);
    const color = rng() > 0.5 ? ACCENT : WARM;
    elements.push({
      ambient: '',
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
${ambientParts.join('\n')}
${hoverParts.join('\n')}
</svg>
`;
}

function main() {
  const contentDir = resolve(__dirname, '..', 'content', 'deep-dives');
  const outDir = resolve(__dirname, '..', 'static', 'heroes');
  mkdirSync(outDir, { recursive: true });

  const files = findMarkdownFiles(contentDir);
  console.log(`Scanning ${files.length} content files...`);

  let count = 0;
  for (const file of files) {
    const slug = extractSlug(file);

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
