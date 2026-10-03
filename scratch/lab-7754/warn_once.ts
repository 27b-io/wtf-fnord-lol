// Keys this isolate has already warned about. Module scope is the isolate's
// lifetime, so each key warns once per isolate rather than once per request.
const warned = new Set<string>();

export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[${key}] ${message}`);
}
