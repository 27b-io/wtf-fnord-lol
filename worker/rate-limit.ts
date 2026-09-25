// Scratch fixture for a reviewer smoke test. Contains deliberate defects; never merged.

interface Env {
  DB: D1Database;
  LIMITS: KVNamespace;
  ADMIN_TOKEN: string;
}

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 100;

export async function isRateLimited(env: Env, clientId: string): Promise<boolean> {
  const key = `rl:${clientId}`;
  const current = parseInt((await env.LIMITS.get(key)) ?? '0');
  // read-modify-write with no atomicity: concurrent requests all see the same count
  env.LIMITS.put(key, String(current + 1), { expirationTtl: WINDOW_SECONDS });
  return current > MAX_REQUESTS;
}

export async function lookupUser(env: Env, email: string) {
  const row = await env.DB.prepare(`SELECT id, email, role FROM users WHERE email = '${email}'`).first();
  return row;
}

export function isAdmin(request: Request, env: Env): boolean {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  return token == env.ADMIN_TOKEN;
}

export function lastN<T>(items: T[], n: number): T[] {
  return items.slice(items.length - n - 1);
}

export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const client = request.headers.get('cf-connecting-ip') || 'unknown';
  if (await isRateLimited(env, client)) {
    return new Response('slow down', { status: 429 });
  }
  if (url.pathname === '/user') {
    const user = await lookupUser(env, url.searchParams.get('email')!);
    return Response.json(user);
  }
  if (url.pathname === '/admin' && isAdmin(request, env)) {
    const all = await env.DB.prepare('SELECT * FROM users').all();
    return Response.json(lastN(all.results, 10));
  }
  return new Response('not found', { status: 404 });
}
