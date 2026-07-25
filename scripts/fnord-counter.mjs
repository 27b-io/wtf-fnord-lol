// Counts fnord occurrences per content file and prints a summary.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function countFnords(dir) {
  const results = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const text = readFileSync(join(dir, entry.name), 'utf8');
    const matches = text.match(/fnord/g) || [];
    results[entry.name] = matches.length;
  }
  return results;
}

// Returns the top-N files by fnord count. FNORD_LIMIT overrides n when it
// parses as a non-negative integer (0 is a valid limit).
export function topFnordFiles(counts, n) {
  const parsed = Number.parseInt(process.env.FNORD_LIMIT, 10);
  const limit = Number.isInteger(parsed) && parsed >= 0 ? parsed : n;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node scripts/fnord-counter.mjs <dir>');
    process.exit(1);
  }
  const counts = countFnords(dir);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`total fnords: ${total}`);
}
