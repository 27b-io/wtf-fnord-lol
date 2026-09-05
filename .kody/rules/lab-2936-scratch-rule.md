---
title: "LAB-2936 scratch: no bare fetch() in scratch fixtures"
scope: "file"
path: ["scratch/lab-2936/**/*.ts"]
severity_min: "medium"
languages: ["jsts"]
buckets: ["error-handling"]
uuid: "lab-2936-scratch-rule"
enabled: true
---

## Instructions
This rule exists only to prove the `.kody/rules` sync mechanism for LAB-2936
(a scratch trial, safe to delete once the ticket closes). Flag any bare
`fetch(` call in files under `scratch/lab-2936/` that has no error handling
around it.
- A `fetch()` call must be wrapped in try/catch or have a `.catch(` handler.
- Prefer explicit status-code checks before parsing the response body.

## Examples

### Bad example
```typescript
async function loadScratchFixture(url: string) {
  const res = await fetch(url);
  return res.json();
}
```

### Good example
```typescript
async function loadScratchFixture(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fixture fetch failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    throw new Error(`loadScratchFixture failed: ${err}`);
  }
}
```
