# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**wtf.fnord.lol** — A technical deep-dive site ("papers, architectures, and systems explained without the bullshit") built with Zola (static site generator) and deployed to Cloudflare Workers. Features semantic search via Vectorize and an auth-gated AI chat ("Stev3") on each post.

## Commands

```bash
# Development (runs Zola + Wrangler in parallel)
npm run dev

# Build static site only
npm run build          # or: zola build

# Preview (build + local worker)
npm run preview

# Deploy (build + wrangler deploy)
npm run deploy

# Index content into Vectorize
npx tsx scripts/index-content.ts

# Pre-commit checks (runs automatically)
zola check             # validates content/templates
```

**Zola version**: 0.19.2 (pinned in CI). Install via `snap install zola` or see zola docs.

## Architecture

### Two-layer stack

1. **Zola** (`config.toml`) generates static HTML from `content/` + `templates/` + `sass/` into `public/`.
2. **Cloudflare Worker** (`worker/index.ts`) serves those static files with security headers, plus handles all `/api/*` and `/auth/*` routes.

### Worker (`worker/index.ts`) — single file, no framework

The worker is a monolith handling:
- **Static asset serving** via the `ASSETS` binding with security headers
- **Semantic search** (`/api/search`) — embeds query with `@cf/baai/bge-base-en-v1.5`, queries Vectorize
- **Auth-gated chat** (`/api/chat`) — RAG chat with Stev3 persona using `@cf/meta/llama-3.1-8b-instruct-fp8`, streams SSE responses
- **OIDC auth** (`/auth/login`, `/auth/callback`, `/auth/logout`) — PKCE flow against `id.27b.io`, HMAC-signed session cookies
- **Content reindex** (`/api/reindex`) — secret-gated bulk vector upsert

Env bindings: `ASSETS`, `AI`, `VECTORIZE`, `REINDEX_SECRET`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_ISSUER`, `SESSION_SECRET`.

### Content authoring (`content/deep-dives/`)

Posts use TOML frontmatter (`+++`), taxonomies (`tags`, `series`), and custom Zola shortcodes:
- `{% callout(type="tldr|insight|warning|question") %}...{% end %}`
- `{{ glossary(term="FOO", def="explanation") }}`
- `{{ cite(key="ref1", text="Author 2026") }}`
- `{{ figure(src="img.png", caption="...") }}`
- `{{ code_compare() }}`
- `{{ pull_quote() }}`

### Templates

Tera templates in `templates/`. Key structure:
- `base.html` — shell with header, nav, search partial, footer
- `page.html` — article layout with TOC sidebar, post metadata, chat widget
- `partials/search.html` — client-side semantic search (debounced, keyboard nav)
- `partials/chat.html` — chat widget with SSE streaming, localStorage history, auth gating

### Styles

Single SCSS file `sass/style.scss`, compiled by Zola. Dark theme with defined palette variables at top.

## Deployment

GitHub Actions on push to `main` (filtered to content/template/worker changes): builds with Zola, deploys via Wrangler, then indexes content into Vectorize. Secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`.

## Key Conventions

- Content frontmatter uses TOML (`+++` delimiters), not YAML
- Embedding model is `@cf/baai/bge-base-en-v1.5` — used in both worker and indexing script (keep in sync)
- Chat uses Llama 3.1 8B (`@cf/meta/llama-3.1-8b-instruct-fp8`)
- Text chunking at 1500 chars by paragraph boundaries (duplicated in worker and `scripts/index-content.ts`)
- Vector IDs follow pattern `{slug}-{chunk_index}`
- Session cookies named `wtf_session`, auth state cookies `wtf_auth_state`
