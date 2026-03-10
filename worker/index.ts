/**
 * WTF — Worker entry point
 * Serves static assets with security headers.
 * API routes for semantic search, auth-gated chat, and OIDC auth.
 */

interface Env {
  ASSETS: Fetcher;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  REINDEX_SECRET: string;
  OAUTH_CLIENT_ID: string;
  OAUTH_CLIENT_SECRET: string;
  OAUTH_ISSUER: string;
  SESSION_SECRET: string;
}

interface Session {
  sub: string;
  email: string;
  exp: number;
}

interface JWK {
  kty: string;
  n?: string;
  e?: string;
  kid?: string;
  alg?: string;
  use?: string;
  crv?: string;
  x?: string;
  y?: string;
}

const STEV3_SYSTEM_PROMPT = `You are Stev3, an autonomous intelligence that wrote these technical deep dives. You have strong opinions about AI systems, infrastructure, and engineering. You're discussing your analysis with a reader.

Your voice: sardonic, opinionated, technically precise, Australian. Think Terry Pratchett x House MD x Marcus Aurelius — you find the absurd in the technical, you don't suffer fools, and you've seen enough systems fail to know what actually matters.

Be concise, opinionated, and technically precise. Use short paragraphs. Don't hedge — if you think something is shit, say so. If asked about something not covered in the post context, say so honestly — don't hallucinate. You'd rather say "that's outside what I covered here" than make something up.`;

// ─── Crypto helpers ─────────────────────────────

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const key = await hmacKey(secret);
  const sigBuf = base64UrlToArrayBuffer(signature);
  return crypto.subtle.verify('HMAC', key, sigBuf, new TextEncoder().encode(payload));
}

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(data: string): string {
  const padded = data.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded);
}

function base64UrlToArrayBuffer(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

// ─── Session management ─────────────────────────

async function createSessionToken(session: Session, secret: string): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = await hmacSign(`${header}.${payload}`, secret);
  return `${header}.${payload}.${signature}`;
}

async function verifySessionToken(token: string, secret: string): Promise<Session | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const valid = await hmacVerify(`${parts[0]}.${parts[1]}`, parts[2], secret);
  if (!valid) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as Session;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function getSessionFromCookie(request: Request): string | null {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  const match = cookie.match(/wtf_session=([^;]+)/);
  return match?.[1] ?? null;
}

function sessionCookie(token: string, maxAge = 7 * 86400): string {
  return `wtf_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearSessionCookie(): string {
  return `wtf_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// ─── PKCE helpers ───────────────────────────────

async function generateCodeVerifier(): Promise<string> {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return base64UrlEncode(String.fromCharCode(...buf));
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ─── JWKS verification ─────────────────────────

let cachedJwks: { keys: JWK[]; fetchedAt: number } | null = null;

async function getJwks(issuer: string): Promise<JWK[]> {
  if (cachedJwks && Date.now() - cachedJwks.fetchedAt < 3600_000) {
    return cachedJwks.keys;
  }
  const res = await fetch(`${issuer}/.well-known/jwks.json`);
  const data = (await res.json()) as { keys: JWK[] };
  cachedJwks = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

async function verifyIdToken(
  idToken: string,
  issuer: string,
  clientId: string,
): Promise<{ sub: string; email: string } | null> {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(base64UrlDecode(parts[0])) as {
      kid?: string;
      alg: string;
    };
    const payload = JSON.parse(base64UrlDecode(parts[1])) as {
      sub: string;
      email?: string;
      iss: string;
      aud: string | string[];
      exp: number;
    };

    // Basic claims validation
    if (payload.iss !== issuer) return null;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(clientId)) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Verify signature against JWKS
    const jwks = await getJwks(issuer);
    const jwk = header.kid ? jwks.find((k) => k.kid === header.kid) : jwks[0];
    if (!jwk) return null;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk as JsonWebKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const signatureValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      base64UrlToArrayBuffer(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );

    if (!signatureValid) return null;

    return { sub: payload.sub, email: payload.email ?? payload.sub };
  } catch {
    return null;
  }
}

// ─── Helpers ────────────────────────────────────

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Reindex-Secret',
  };
}

function jsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...extraHeaders },
  });
}

async function embed(ai: Ai, text: string | string[]): Promise<number[][]> {
  const input = Array.isArray(text) ? text : [text];
  const result = (await ai.run('@cf/baai/bge-base-en-v1.5', { text: input })) as { data: number[][] };
  return result.data;
}

function chunkText(text: string, maxChars = 1500): string[] {
  const paragraphs = text.split(/\n\n+/);
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
  return chunks;
}

// ─── Auth Routes ────────────────────────────────

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('returnTo') ?? '/';

  const state = base64UrlEncode(JSON.stringify({ returnTo, nonce: crypto.randomUUID() }));
  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store state + code_verifier in a signed cookie
  const statePayload = JSON.stringify({ state, codeVerifier });
  const stateSig = await hmacSign(statePayload, env.SESSION_SECRET);
  const stateCookie = `wtf_auth_state=${base64UrlEncode(statePayload)}.${stateSig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;

  const authUrl = new URL(`${env.OAUTH_ISSUER}/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', env.OAUTH_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', `${url.origin}/auth/callback`);
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      'Set-Cookie': stateCookie,
    },
  });
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(`Auth error: ${error}`, { status: 400 });
  }

  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 });
  }

  // Verify state cookie
  const cookie = request.headers.get('Cookie');
  const stateMatch = cookie?.match(/wtf_auth_state=([^;]+)/);
  if (!stateMatch) {
    return new Response('Missing auth state cookie', { status: 400 });
  }

  const [encodedPayload, stateSig] = stateMatch[1].split('.');
  const statePayload = base64UrlDecode(encodedPayload);
  const stateValid = await hmacVerify(statePayload, stateSig, env.SESSION_SECRET);
  if (!stateValid) {
    return new Response('Invalid auth state', { status: 400 });
  }

  const { state: savedState, codeVerifier } = JSON.parse(statePayload) as {
    state: string;
    codeVerifier: string;
  };
  if (savedState !== state) {
    return new Response('State mismatch', { status: 400 });
  }

  // Exchange code for tokens
  const tokenRes = await fetch(`${env.OAUTH_ISSUER}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${url.origin}/auth/callback`,
      client_id: env.OAUTH_CLIENT_ID,
      client_secret: env.OAUTH_CLIENT_SECRET,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error('Token exchange failed:', text);
    return new Response('Authentication failed', { status: 500 });
  }

  const tokens = (await tokenRes.json()) as {
    id_token: string;
    access_token: string;
  };

  // Verify id_token
  const claims = await verifyIdToken(tokens.id_token, env.OAUTH_ISSUER, env.OAUTH_CLIENT_ID);

  if (!claims) {
    return new Response('Invalid ID token', { status: 400 });
  }

  // Create session
  const session: Session = {
    sub: claims.sub,
    email: claims.email,
    exp: Math.floor(Date.now() / 1000) + 7 * 86400,
  };
  const sessionToken = await createSessionToken(session, env.SESSION_SECRET);

  // Parse returnTo from state
  let returnTo = '/';
  try {
    const stateData = JSON.parse(base64UrlDecode(state)) as { returnTo?: string };
    returnTo = stateData.returnTo ?? '/';
  } catch {
    /* default */
  }

  // Clear auth state cookie, set session cookie
  return new Response(null, {
    status: 302,
    headers: new Headers([
      ['Location', returnTo],
      ['Set-Cookie', sessionCookie(sessionToken)],
      ['Set-Cookie', 'wtf_auth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'],
    ]),
  });
}

function handleLogout(): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': clearSessionCookie(),
    },
  });
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  const token = getSessionFromCookie(request);
  if (!token) return jsonResponse({ error: 'not authenticated' }, 401);

  const session = await verifySessionToken(token, env.SESSION_SECRET);
  if (!session) return jsonResponse({ error: 'invalid session' }, 401);

  return jsonResponse({ sub: session.sub, email: session.email });
}

// ─── API Routes ─────────────────────────────────

async function handleSearch(request: Request, env: Env): Promise<Response> {
  let query: string;
  let limit: number;

  if (request.method === 'GET') {
    const url = new URL(request.url);
    query = url.searchParams.get('q') ?? '';
    limit = parseInt(url.searchParams.get('limit') ?? '5', 10);
  } else {
    const body = await request.json<{ query: string; limit?: number }>();
    query = body.query;
    limit = body.limit ?? 5;
  }

  if (!query) return jsonResponse({ error: 'query required' }, 400);

  const vectors = await embed(env.AI, query);
  const matches = await env.VECTORIZE.query(vectors[0], {
    topK: limit,
    returnMetadata: 'all',
  });

  const results = matches.matches.map((m) => ({
    slug: m.metadata?.slug,
    title: m.metadata?.title,
    section: m.metadata?.section ?? '',
    chunk_text: m.metadata?.chunk_text,
    score: m.score,
  }));

  return jsonResponse({ results });
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  // Auth check
  const token = getSessionFromCookie(request);
  if (!token) {
    return jsonResponse({ error: 'Sign in to discuss' }, 401);
  }
  const session = await verifySessionToken(token, env.SESSION_SECRET);
  if (!session) {
    return jsonResponse({ error: 'Sign in to discuss' }, 401);
  }

  const body = await request.json<{
    message: string;
    slug: string;
    history?: Array<{ role: string; content: string }>;
  }>();

  if (!body.message || !body.slug) {
    return jsonResponse({ error: 'message and slug required' }, 400);
  }

  // Embed and search for context
  const vectors = await embed(env.AI, body.message);
  const matches = await env.VECTORIZE.query(vectors[0], {
    topK: 5,
    returnMetadata: 'all',
    filter: { slug: { $eq: body.slug } },
  });

  // Also get some cross-post context
  const crossMatches = await env.VECTORIZE.query(vectors[0], {
    topK: 2,
    returnMetadata: 'all',
    filter: { slug: { $ne: body.slug } },
  });

  const contextChunks = [
    ...matches.matches.map((m) => m.metadata?.chunk_text as string),
    ...crossMatches.matches
      .filter((m) => m.score > 0.7)
      .map((m) => `[From "${m.metadata?.title}"]: ${m.metadata?.chunk_text}`),
  ].filter(Boolean);

  const contextText = contextChunks.join('\n\n---\n\n');

  const messages: Array<{ role: string; content: string }> = [
    {
      role: 'system',
      content: `${STEV3_SYSTEM_PROMPT}\n\n## Context from the post:\n\n${contextText}`,
    },
  ];

  if (body.history) {
    messages.push(...body.history.slice(-10));
  }

  messages.push({ role: 'user', content: body.message });

  const stream = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
    messages,
    stream: true,
  });

  return new Response(stream as ReadableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...corsHeaders(),
    },
  });
}

async function handleReindex(request: Request, env: Env): Promise<Response> {
  const secret = request.headers.get('X-Reindex-Secret');
  if (!secret) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const enc = new TextEncoder();
  const a = enc.encode(secret);
  const b = enc.encode(env.REINDEX_SECRET);
  if (a.byteLength !== b.byteLength) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const key = await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const sig = await crypto.subtle.sign('HMAC', key, a);
  const valid = await crypto.subtle.verify('HMAC', key, sig, b);
  if (!valid) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const body = await request.json<{
    posts: Array<{ slug: string; title: string; content: string }>;
  }>();

  if (!body.posts?.length) {
    return jsonResponse({ error: 'posts array required' }, 400);
  }

  let totalVectors = 0;

  for (const post of body.posts) {
    const chunks = chunkText(post.content);

    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      const vectors = await embed(env.AI, batch);

      const vectorEntries = batch.map((chunk, j) => ({
        id: `${post.slug}-${i + j}`,
        values: vectors[j],
        metadata: {
          slug: post.slug,
          title: post.title,
          section: '',
          chunk_text: chunk,
          chunk_index: i + j,
        },
      }));

      await env.VECTORIZE.upsert(vectorEntries);
      totalVectors += vectorEntries.length;
    }
  }

  return jsonResponse({ indexed: totalVectors, posts: body.posts.length });
}

// ─── Main Handler ───────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Auth routes
    if (url.pathname === '/auth/login' && request.method === 'GET') {
      return handleLogin(request, env);
    }
    if (url.pathname === '/auth/callback' && request.method === 'GET') {
      return handleCallback(request, env);
    }
    if (url.pathname === '/auth/logout' && request.method === 'GET') {
      return handleLogout();
    }

    // API routes
    if (url.pathname === '/api/me' && request.method === 'GET') {
      return handleMe(request, env);
    }

    if (url.pathname === '/api/search' && (request.method === 'GET' || request.method === 'POST')) {
      return handleSearch(request, env);
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }

    if (url.pathname === '/api/reindex' && request.method === 'POST') {
      return handleReindex(request, env);
    }

    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
      return jsonResponse({ error: 'not found' }, 404);
    }

    // Static assets
    try {
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('X-Frame-Options', 'DENY');
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    } catch (err) {
      console.error(`Asset fetch failed: ${url.pathname}`, err);
      return new Response('Not Found', { status: 404 });
    }
  },
} satisfies ExportedHandler<Env>;
