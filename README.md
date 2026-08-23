# Meridian

An original AI assistant platform. Blue-accented, responsive, built on Next.js 14 (App Router) + TypeScript + Tailwind.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, AUTH_SECRET, MERIDIAN_MODEL_PROVIDER, AI_PROVIDER_KEY
npm run dev
```

Open http://localhost:3000.

## What's actually implemented (Phase 4 — web search + citations)

- **Full pipeline from the spec, all real:** `lib/search/pipeline.ts` asks the model to break the
  question into up to 3 focused search queries, `lib/search/provider.ts` (Brave Search API) runs
  each one, results are deduplicated by URL and capped at 8, sequentially renumbered as sources.
- Toggle **Web search** in the composer (now wired to real state, not decorative) and the chat
  route embeds those sources as a system message instructing the model to cite `[1]`, `[2]`, etc.
  and **never fabricate a citation** — matching the spec's explicit requirement.
- Sources stream back after the answer as a trailing frame and render as the `SourceCard` list
  already built in Phase 1, under the message.
- **Failure is surfaced, not hidden:** no `SEARCH_API_KEY` → the model is told search wasn't
  available and says so instead of answering as if it had searched. Zero results → same honest
  handling instead of hallucinating sources.

**Requires:** `SEARCH_API_KEY` from [Brave Search API](https://brave.com/search/api/) in
`.env.local`. Swap `lib/search/provider.ts` for Tavily/Serper/Bing if you prefer — everything else
depends only on the `SearchProvider` interface.

**Known gap:** sources currently use the search snippet, not the full fetched page — good enough
for grounded short answers, but Deep Research mode (multi-page reading, conflict comparison, full
report) is still Phase 5, not this one.

## What's actually implemented (Phase 3 — files, storage, RAG)

- **Upload pipeline, all real, not stubbed:** `app/api/files/upload/route.ts` validates size (20MB
  max, `lib/files/validation.ts`) and mime type, stores the raw file, extracts text
  (`lib/files/extract.ts` — pdf-parse, mammoth for .docx, SheetJS for .xlsx, PapaParse for .csv,
  plain text/markdown), chunks it (`lib/files/chunk.ts` — 220-word sliding windows with overlap),
  embeds each chunk via Voyage AI (`lib/embeddings/provider.ts`), and stores vectors in Postgres
  via pgvector.
- **Storage abstraction** (`lib/storage/provider.ts`) — local-disk under `./storage/uploads` for
  dev (gitignored, doesn't survive a real serverless deploy), with a clear seam to swap in
  S3/R2/Supabase Storage.
- **Retrieval wired into chat:** attach a file in the composer, ask a question, and
  `app/api/chat/route.ts` embeds your question, finds the closest chunks via pgvector cosine
  distance (`lib/db/files.ts`), and injects them as a system message telling the model to cite
  which file each fact came from — not the whole document dumped into context.
- **Composer attachments are real uploads now**, not a local-only file list: each file shows
  uploading → ready/unsupported/error status, and only "ready" files are sent with the next
  message.
- Every failure mode is surfaced, not swallowed: oversized file → 413 with the actual size in the
  message; unsupported type → 415; extraction failure or missing `VOYAGE_API_KEY` → file is still
  stored but marked `error`/`unsupported` with a reason, never silently treated as searchable.

**Requires before this works end to end:**
1. `CREATE EXTENSION IF NOT EXISTS vector;` on your Postgres database, then `npm run db:push`
   (the `file_chunks.embedding` column needs pgvector)
2. `VOYAGE_API_KEY` in `.env.local`

**Known gap:** images upload and store fine but aren't text-extracted or embedded — that's the
separate vision path (Phase 7), not this RAG pipeline. They're marked `unsupported` for now.

## What's actually implemented (Phase 2 — real AI chat)

- **Real Anthropic provider** (`lib/ai/providers/anthropic.ts`) implementing the `AIProvider`
  interface — streaming + non-streaming generation, wired into `getAIProvider()` when
  `MERIDIAN_MODEL_PROVIDER=anthropic`.
- **Real streaming API route** (`app/api/chat/route.ts`) — persists the user message, streams the
  assistant reply token-by-token from the live model, persists that too, and auto-titles new
  conversations from the first message.
- **Conversation storage** — `lib/db/conversations.ts` + `/api/conversations` (list, create) and
  `/api/conversations/[id]` (load messages, rename, delete), backed by the Drizzle schema.
- **Message history** — opening `/c/[id]` loads a saved conversation and continues it with full
  prior context sent to the model.
- **Model selector** now maps UI choices to real model strings server-side
  (`lib/ai/models.ts`): Meridian Fast → `claude-sonnet-5`, Meridian Reasoning → `claude-opus-4-8`,
  Meridian Lite → `claude-haiku-4-5-20251001`. Override via `MERIDIAN_MODEL_FAST` etc. in env.
- **Regenerate** re-sends the prior user turn through the same pipeline. **Stop** aborts the
  in-flight fetch via `AbortController` and marks the message no-longer-streaming.
- **Honest fallback, not a fake chatbot:** if `AI_PROVIDER_KEY` or `DATABASE_URL` isn't set yet,
  the API returns 503 and the client shows a clearly-labeled local demo reply explaining exactly
  what's missing — never a response dressed up to look like a real model.

**Known gap carried over from Phase 1:** auth still isn't wired to real sessions, so
`lib/auth/currentUser.ts` uses `DEV_FALLBACK_USER_ID` for every request. Every conversation is
attributed to that one placeholder user until `CredentialsProvider.authorize()` is implemented.
Search `DEV_FALLBACK_USER_ID` before shipping this to real users.

## What's actually implemented (Phase 1)

- Full design system: tokens (color/type/spacing) in `tailwind.config.ts` + `app/globals.css`
- Reusable UI primitives: `components/ui/*` — Button, Input, Textarea, Avatar, Badge, Tooltip, Dropdown, Modal, Tabs
- Responsive app shell: collapsible desktop sidebar + mobile drawer (`components/layout`)
- Full chat UI: empty state, message list, markdown rendering, streaming indicator, composer with
  file attach / web search toggle / deep research toggle / voice input UI / model selector
  (`components/chat/*`)
- Settings page with 6 real tabs (General, Appearance, AI, Privacy, Notifications, Security)
- Light/dark/system theme, persisted, respects `prefers-color-scheme`

## Not started yet (later phases per the original spec)

Deep Research mode (multi-query planning with visible progress, multi-page reading, conflict
comparison, full report generation), agent tool-calling loop, custom agent builder, projects UI,
library UI, conversation search, billing, admin dashboard, landing page. Phases 5–8 in the
original brief.

## Before you run this for real

1. `npm install`
2. Provision a Postgres database (Supabase works well) and set `DATABASE_URL`
3. `CREATE EXTENSION IF NOT EXISTS vector;` on that database
4. `npm run db:push` to create the tables from `lib/db/schema.ts`
5. Set `MERIDIAN_MODEL_PROVIDER=anthropic` and `AI_PROVIDER_KEY=sk-ant-...`
6. Set `VOYAGE_API_KEY` (file uploads/RAG) and `SEARCH_API_KEY` (web search) if you want those features live
7. `npm run dev` — send a message; it should stream from a real model and persist to Postgres

## Structure

```
app/                  routes (App Router)
  api/chat/           streaming chat endpoint
  api/conversations/  conversation CRUD
  api/files/          file upload + listing
  api/auth/           NextAuth handler
  c/[id]/             saved conversation view
  settings/           settings page
components/
  ui/                 design-system primitives
  layout/             sidebar, shell, theme provider
  chat/               composer, message list, model selector, etc.
  settings/           settings-specific rows/controls
lib/
  ai/                  provider-agnostic interface + Anthropic implementation
  db/                  Drizzle schema + data access
  auth/                NextAuth config
  storage/             file storage abstraction
  embeddings/          Voyage AI embeddings
  search/              web search pipeline + provider
  files/               extraction, chunking, validation
  types/               shared types
  hooks/               useChat client hook
