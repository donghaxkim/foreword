# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Foreword?

Foreword is an AI-powered email drafting tool built for startup teams. Users provide rough notes (manually or pulled from GitHub PRs / Linear tasks), and the app generates polished, HTML-formatted emails via OpenAI's API. The generated emails can be sent directly through Loops.so or copied as HTML.

## Commands

- `npm run dev` — start Next.js dev server
- `npm run build` — production build
- `npm run lint` — ESLint (extends `next/core-web-vitals` and `next/typescript`)

## Architecture

Next.js App Router app (single page). Source lives in `app/`.

**Components** (`app/components/`):
- `types.ts` — shared types (`Persona`, `Mode`, `modes` const)
- `AnimatedMesh.tsx` — background animated gradient blobs
- `ChatbotIsland.tsx` — input form with mode tabs, sync loading/error states
- `SettingsPanel.tsx` — slide-over settings (personas, API keys, Loops config)
- `SuggestionChips.tsx` — clickable suggestion chips that seed the textarea
- `DraftPreview.tsx` — draft results card with copy HTML + Loops send

**Lib** (`app/lib/`):
- `constants.ts` — storage keys, default persona, suggestion chips, `mapSuggestionToVibe`, `mapSuggestionToPrompt`

**Page** — `app/page.tsx` is the composition root (client component). Holds all state, effects, and handlers. Uses framer-motion for animations, lucide-react for icons, Tailwind CSS v4 (via `@tailwindcss/postcss`). A glassmorphism design system is defined in `app/globals.css` (`.glass-card` class). Two Google Fonts are loaded in `app/layout.tsx`: Inter (`--font-ui`) and Cormorant Garamond (`--font-brand`).

**API Routes:**
- `POST /api/generate` — sends user prompt + system persona to OpenAI (`gpt-4o`, JSON mode) and returns `{ subject, preheader, body }`. The body is HTML using only `<p>`, `<ul>`, `<li>`, `<strong>` tags. Uses `OPENAI_API_KEY` env var or client-provided `openaiApiKey` field as fallback.
- `POST /api/sync` — fetches recent data from GitHub (closed PRs in last 7 days) or Linear (done issues in current cycle). Accepts `{ integration: "github"|"linear", apiKey }`. GitHub repo is configured via `GITHUB_CADDY_REPO` env var (defaults to `getcaddy/caddy`). Auto-triggered when switching to GitHub/Linear mode. Handles both personal API keys and OAuth tokens for Linear (auto-detects Bearer prefix).
- `POST /api/send` — proxies email send to Loops.so transactional API. Accepts `{ subject, preheader, htmlBody, loopsApiKey, transactionalId, recipientEmail }`.
- `GET /api/auth/[provider]` — initiates OAuth flow for `github` or `linear`. Sets a CSRF state cookie and redirects to the provider's authorization page.
- `GET /api/auth/[provider]/callback` — handles OAuth callback, exchanges authorization code for access token, stores token in localStorage via an HTML bridge page, and redirects to `/`.

**State management** — all client state is in React useState hooks in `Home()`. API keys, personas, and Loops config are persisted to localStorage under `foreword-*` keys.

**Input modes** — Manual (freeform text), GitHub (auto-fetches PRs on mode switch), Linear (auto-fetches tasks on mode switch). Mode selection triggers sync and populates the textarea.

## Environment Variables

See `.env.example`. `OPENAI_API_KEY` can be set in env or provided via the Settings UI. Optional: `GITHUB_CADDY_REPO` (defaults to `getcaddy/caddy`).

**OAuth (optional):** Set `NEXT_PUBLIC_GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` and/or `NEXT_PUBLIC_LINEAR_CLIENT_ID` + `LINEAR_CLIENT_SECRET` to enable one-click account linking. When the `NEXT_PUBLIC_*_CLIENT_ID` vars are set, the Settings panel shows "Connect" buttons; otherwise it falls back to manual token entry. OAuth callback URLs must be set to `<domain>/api/auth/github/callback` and `<domain>/api/auth/linear/callback` respectively in the provider's app settings.

## Style Notes

- Tailwind v4 — imported via `@import "tailwindcss"` in `globals.css`, configured through `@tailwindcss/postcss` plugin
- Path alias: `@/*` maps to project root
- TypeScript strict mode enabled, `allowJs: false`
