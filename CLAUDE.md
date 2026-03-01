# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Foreword?

Foreword is an AI-powered email drafting tool built for startup teams. Users provide rough notes (manually or pulled from GitHub PRs / Linear tasks), and the app generates polished, HTML-formatted emails via Anthropic's API. The generated emails can be sent directly through Loops.so or copied as HTML.

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
- `SettingsPanel.tsx` — slide-over settings (personas, Integrations: Connect GitHub/Linear)
- `SuggestionChips.tsx` — clickable suggestion chips that seed the textarea
- `DraftPreview.tsx` — draft results card with copy HTML + Loops send

**Lib** (`app/lib/`):
- `constants.ts` — storage keys, default persona, vibe chips (`vibeChips`), `mapSuggestionToVibe`

**Page** — `app/page.tsx` is the composition root (client component). Holds all state, effects, and handlers. Uses framer-motion for animations, lucide-react for icons, Tailwind CSS v4 (via `@tailwindcss/postcss`). A glassmorphism design system is defined in `app/globals.css` (`.glass-card` class). Two Google Fonts are loaded in `app/layout.tsx`: Inter (`--font-ui`) and Cormorant Garamond (`--font-brand`).

**API Routes:**
- `POST /api/generate` — sends user prompt + system persona to Anthropic (Claude) and returns `{ subject, preheader, body }`. The body is HTML using only `<p>`, `<ul>`, `<li>`, `<strong>` tags. Uses server-side `ANTHROPIC_API_KEY` env var only.
- `GET /api/config` — returns `{ loopsConfigured, loopsDefaultRecipient }` from server env (no secrets). Used by the client to show the Send via Loops UI and pre-fill default recipient.
- `POST /api/sync` — fetches recent data from GitHub (merged PRs and commits) or Linear (done issues). Accepts `{ days?, repo? }`. GitHub repo is set by the user in Settings (owner/repo); tokens from OAuth or manual entry. Auto-triggered when switching to GitHub/Linear mode.
- `POST /api/send` — proxies email send to Loops.so transactional API. Uses server-side `LOOPS_API_KEY` and `LOOPS_TRANSACTIONAL_ID`. Accepts only `{ subject, preheader, htmlBody, recipientEmail }`.
- `GET /api/auth/[provider]` — initiates OAuth flow for `github` or `linear`. Sets a CSRF state cookie and redirects to the provider's authorization page.
- `GET /api/auth/[provider]/callback` — handles OAuth callback, exchanges authorization code for access token, stores token in localStorage via an HTML bridge page, and redirects to `/`.

**State management** — client state is in React useState in `Home()`. Personas and GitHub/Linear tokens (from OAuth or manual entry when OAuth not configured) are persisted to localStorage under `foreword-*` keys. Anthropic and Loops are server-side only (no keys in client).

**Input modes** — Manual (freeform text), GitHub (auto-fetches PRs on mode switch), Linear (auto-fetches tasks on mode switch). Mode selection triggers sync and populates the textarea.

## Environment Variables

See `.env.example`.

- **Anthropic** — server-side only. Set `ANTHROPIC_API_KEY` for `POST /api/generate`.
- **Loops** — server-side only. Set `LOOPS_API_KEY` and `LOOPS_TRANSACTIONAL_ID` for `POST /api/send`. Optional `LOOPS_RECIPIENT_EMAIL` pre-fills the Send UI (exposed via `GET /api/config`).
- **GitHub / Linear** — users connect via OAuth in Settings. Set `NEXT_PUBLIC_GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` and/or `NEXT_PUBLIC_LINEAR_CLIENT_ID` + `LINEAR_CLIENT_SECRET` to enable Connect buttons; when not set, Settings shows setup instructions and manual token entry. OAuth callback URLs: `<domain>/api/auth/github/callback` and `<domain>/api/auth/linear/callback`.
- GitHub repo for sync is chosen in the app (Settings → GitHub repository); no env var required.

## Style Notes

- Tailwind v4 — imported via `@import "tailwindcss"` in `globals.css`, configured through `@tailwindcss/postcss` plugin
- Path alias: `@/*` maps to project root
- TypeScript strict mode enabled, `allowJs: false`
