// LAB-2936 AC3: this file matches the .kody/rules path scope
// (scratch/lab-2936/**/*.ts) and should trigger the scratch rule below —
// a bare fetch() with no error handling.
export async function loadScratchFixture(url: string) {
  const res = await fetch(url);
  return res.json();
}
