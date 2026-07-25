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

const dir = process.argv[2];
const counts = countFnords(dir);
const total = Object.values(counts).reduce((a, b) => a + b);
console.log(`total fnords: ${total}`);
