/**
 * WTF — Worker entry point
 * Serves static assets (Zola output) with security headers.
 */

interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ message: 'No API yet' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
