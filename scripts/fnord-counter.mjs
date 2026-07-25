// Counts fnord occurrences per content file and prints a summary.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function countFnords(dir) {
  const results = {};
  for (const f of readdirSync(dir)) {
    const text = readFileSync(join(dir, f), 'utf8');
    const matches = text.match(/fnord/g);
    results[f] = matches.length;
  }
  return results;
}

// Returns the top-N files by fnord count.
export function topFnordFiles(counts, n) {
  let limit = n;
  if (process.env.FNORD_LIMIT) {
    const parsed = parseInt(process.env.FNORD_LIMIT, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      limit = parsed;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: fnord-counter.mjs <directory>');
    process.exit(1);
  }
  const counts = countFnords(dir);
  const total = Object.values(counts).reduce((a, b) => a + b);
  console.log(`total fnords: ${total}`);
}
