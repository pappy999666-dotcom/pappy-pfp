# Pappy PFP Web

A premium, guided web experience for changing WhatsApp profile pictures in minutes. Built as a companion to the Pappy PFP Telegram bot.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/pappy-pfp run dev` — run the frontend (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (pre-provisioned)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Framer Motion, wouter
- API: Express 5, Zod validation
- DB: PostgreSQL + Drizzle ORM
- Image processing: multer (upload), sharp (metadata + thumbnails)
- QR generation: qrcode
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `artifacts/pappy-pfp/src/pages/home.tsx` — landing page
- `artifacts/pappy-pfp/src/pages/app/` — multi-step wizard (steps 1-7)
- `artifacts/pappy-pfp/src/components/layout/` — Navbar, BackgroundOrbs
- `artifacts/api-server/src/routes/pfp/upload.ts` — image upload/delete endpoints
- `artifacts/api-server/src/routes/pfp/sessions.ts` — WhatsApp session endpoints
- `artifacts/api-server/src/lib/sessions.ts` — in-memory session lifecycle manager
- `lib/db/src/schema/uploads.ts` — uploads table
- `lib/db/src/schema/sessions.ts` — whatsapp_sessions table
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)

## Architecture decisions

- **In-memory session simulation**: Real Baileys/WhatsApp Web.js integration would replace `src/lib/sessions.ts` without touching the routes. The session manager exposes `initLiveSession`, `advanceSessionToApplying`, `getStatusInfo` for clean swap-out.
- **Polling for live status**: Frontend polls `/api/pfp/sessions/:id/status` every 2 seconds instead of SSE — simpler to proxy and more reliable across load balancers.
- **Temporary uploads in /tmp**: Uploaded images are stored at `/tmp/pappy-pfp-uploads/` and removed after the session completes or on explicit delete.
- **QR code generation**: QR codes are generated server-side with the `qrcode` package and returned as base64 data URLs.
- **Multipart upload excluded from codegen**: The `POST /pfp/upload` requestBody is intentionally absent from the OpenAPI spec to avoid `File`/`Blob` type errors in Node.js Zod schemas. The frontend sends FormData directly via fetch.

## Product

- **Landing page** (`/`): Hero, How It Works, Security/Privacy sections with animated floating orbs background
- **Wizard** (`/app`): 6-step guided flow — Upload → Preview → Phone Number → Pairing Method → Pair WhatsApp → Live Progress → Success

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, run `pnpm --filter @workspace/api-spec run codegen` before touching frontend or server code.
- Do not change `info.title` in `openapi.yaml` — it controls generated filenames.
- Run `pnpm run typecheck:libs` after any `lib/*` changes before checking artifact packages.
- The upload endpoint uses multer on the server; do NOT add a `requestBody` with `format: binary` to the OpenAPI spec (causes `File`/`Blob` type errors in Node.js Zod schemas).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Telegram bot source: https://github.com/pappy999666-dotcom/pappy-pfp
