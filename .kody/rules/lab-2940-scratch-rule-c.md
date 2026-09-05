<!-- @kody-ignore -->
---
title: "LAB-2940 scratch C: no bare fetch() in scratch fixtures"
scope: "file"
path: ["scratch/**/*.ts"]
severity_min: "medium"
languages: ["jsts"]
uuid: "lab-2940-scratch-rule-c"
enabled: true
---

## Instructions
Scratch-only fixture for the LAB-2940 .kody/rules sync-integrity trial (rule C). Flag any bare `fetch()` call in scratch fixtures that has no timeout or error handling.

## Examples

### Bad example
```ts
const res = await fetch(url);
```

### Good example
```ts
const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
```
