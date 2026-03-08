#!/usr/bin/env tsx
/**
 * Index content into Cloudflare Vectorize via REST API.
 * Reads markdown from content/deep-dives/, chunks, embeds, and upserts.
 *
 * Usage: npx tsx scripts/index-content.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const ACCOUNT_ID = 'a3ff5761a3414bbf10e94ef31ea6aa07';
const INDEX_NAME = 'wtf-content';
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

// Read wrangler OAuth token or use CLOUDFLARE_API_TOKEN env var
function getAuthToken(): string {
  if (process.env.CLOUDFLARE_API_TOKEN) {
    return process.env.CLOUDFLARE_API_TOKEN;
  }
  const configPath = join(
    process.env.HOME ?? '~',
    '.config/.wrangler/config/default.toml'
  );
  const config = readFileSync(configPath, 'utf-8');
  const match = config.match(/oauth_token\s*=\s*"([^"]+)"/);
  if (!match) throw new Error('No oauth_token found in wrangler config');
  return match[1];
}

function extractFrontmatter(md: string): {
  title: string;
  slug: string;
  body: string;
} {
  const match = md.match(/^\+\+\+\n([\s\S]*?)\n\+\+\+\n([\s\S]*)$/);
  if (!match) return { title: 'Untitled', slug: 'unknown', body: md };

  const fm = match[1];
  const body = match[2];
  const titleMatch = fm.match(/title\s*=\s*"([^"]+)"/);
  const slugMatch = fm.match(/slug\s*=\s*"([^"]+)"/);

  return {
    title: titleMatch?.[1] ?? 'Untitled',
    slug: slugMatch?.[1] ?? 'unknown',
    body,
  };
}

function stripShortcodes(text: string): string {
  // Remove Zola shortcodes like {% callout(...) %} ... {% end %}
  return text
    .replace(/\{%\s*\w+\([^)]*\)\s*%\}/g, '')
    .replace(/\{%\s*end\s*%\}/g, '')
    .replace(/\{\{[^}]+\}\}/g, '');
}

function chunkText(text: string, maxChars = 1500): string[] {
  const cleaned = stripShortcodes(text);
  const paragraphs = cleaned.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }
    current += para + '\n\n';
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 50); // skip tiny chunks
}

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

async function callCfApi(
  path: string,
  token: string,
  method = 'GET',
  body?: unknown
): Promise<unknown> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CF API ${method} ${path}: ${res.status} ${text}`);
  }

  return res.json();
}

async function embedTexts(
  texts: string[],
  token: string
): Promise<number[][]> {
  const result = (await callCfApi(
    `/ai/run/${EMBEDDING_MODEL}`,
    token,
    'POST',
    { text: texts }
  )) as { result: { data: number[][] } };
  return result.result.data;
}

async function upsertVectors(
  vectors: Array<{
    id: string;
    values: number[];
    metadata: Record<string, unknown>;
  }>,
  token: string
): Promise<void> {
  // Vectorize upsert expects NDJSON
  const ndjson = vectors
    .map((v) => JSON.stringify(v))
    .join('\n');

  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/v2/indexes/${INDEX_NAME}/upsert`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-ndjson',
    },
    body: ndjson,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vectorize upsert failed: ${res.status} ${text}`);
  }
}

async function main() {
  const token = getAuthToken();
  const contentDir = resolve(__dirname, '..', 'content', 'deep-dives');
  const files = findMarkdownFiles(contentDir);

  console.log(`Found ${files.length} content files`);

  let totalVectors = 0;

  for (const file of files) {
    const md = readFileSync(file, 'utf-8');
    const { title, slug, body } = extractFrontmatter(md);
    const chunks = chunkText(body);

    console.log(`  ${slug}: ${chunks.length} chunks`);

    // Process in batches of 10 (API limit)
    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      const embeddings = await embedTexts(batch, token);

      const vectors = batch.map((chunk, j) => ({
        id: `${slug}-${i + j}`,
        values: embeddings[j],
        metadata: {
          slug,
          title,
          section: '',
          chunk_text: chunk,
          chunk_index: i + j,
        },
      }));

      await upsertVectors(vectors, token);
      totalVectors += vectors.length;
    }
  }

  console.log(`Done! Indexed ${totalVectors} vectors from ${files.length} posts`);
}

main().catch((err) => {
  console.error('Indexing failed:', err);
  process.exit(1);
});
