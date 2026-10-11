# Kudos AI

Turn a group-chat JSON export into roasty friend awards and an AI-generated awards ceremony you can drop back into the chat.

## Status

**Demo, ready to deploy.** Product docs in [`/docs`](./docs). **Free** end-to-end—no paywall. Local dev uses the slideshow ceremony unless Magic Hour credentials are set.

## What we're building

1. User uploads a **JSON** chat file (native [Kudos format](./docs/07-api-and-data-model.md#kudos-chat-json-v1) or auto-detected platform export).
2. We **validate** for size/structure/malicious content, normalize messages, compute stats, and use [Jev](https://jevtypesafeai.com/jev/api) for subjective award judging.
3. User picks roast level (**gentle / medium / spicy**) and optional avatars.
4. [Magic Hour](https://docs.magichour.ai/integration/overview) renders a shareable ceremony video (async + webhooks).
5. User gets a link and/or MP4 to post in the group.

## Architecture & defaults

**Monorepo** (`pnpm` workspaces):

| Path | Role |
|------|------|
| `apps/web` | Next.js 15 app (UI + Route Handlers API) |
| `apps/worker` | BullMQ worker (analyze + ceremony jobs) |
| `packages/chat-json` | JSON ingest, adapters, validation |
| `packages/awards` | Stats, deterministic awards, Jev orchestration |
| `packages/shared` | Shared types/utilities |

**Local dependencies:** Postgres 16 and Redis 7 via [`docker-compose.yml`](./docker-compose.yml).

**Environment:** copy [`.env.example`](./.env.example) to `.env` at the repo root (the web app loads it from there).

| Variable | Default / notes |
|----------|-----------------|
| `DATABASE_URL` | `postgres://kudos:kudos@localhost:5432/kudos` |
| `REDIS_URL` | `redis://localhost:6379` |
| `OBJECT_STORE` | `local` (default) or `r2` |
| `OBJECT_STORE_DIR` | `.data` when `OBJECT_STORE=local` |
| `APP_ORIGIN` | Extra CSRF origins, comma-separated (the request host is always allowed) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Required when `OBJECT_STORE=r2` |
| `SESSION_SECRET` | Required for signed session cookies |
| `TYPESAFE_API_KEY` | Jev / TypeSafe API (analyze) |
| `MAGIC_HOUR_API_KEY` | Ceremony render |
| `MAGIC_HOUR_WEBHOOK_SECRET` | Magic Hour webhook verification |

Full system design: [docs/05-architecture.md](./docs/05-architecture.md).

## Run

**Prerequisites:** Node 22, [pnpm](https://pnpm.io/) 9, Docker (for Postgres + Redis).

```bash
pnpm install
cp .env.example .env   # fill secrets as needed
docker compose up -d
pnpm --filter @kudos/web db:push
```

**Web (dev):**

```bash
pnpm dev
# or: pnpm --filter @kudos/web dev
```

**Worker (dev, separate terminal):**

```bash
pnpm --filter @kudos/worker dev
```

## Migration

Schema is managed with [Drizzle](https://orm.drizzle.team/) (`apps/web/src/db/schema.ts`). For local/dev, apply the current schema to Postgres:

```bash
pnpm --filter @kudos/web db:push
```

Uses `DATABASE_URL` from the root `.env` (see `apps/web/drizzle.config.ts`).

## Deploy

| Piece | Host | Notes |
|-------|------|--------|
| Web | Vercel | Set the project **Root Directory** to `apps/web`. [`apps/web/vercel.json`](./apps/web/vercel.json) installs and builds from the repo root. |
| Worker + ffmpeg | Fly.io | From the repo root: `fly deploy` ([`fly.toml`](./fly.toml), [`apps/worker/Dockerfile`](./apps/worker/Dockerfile)). One machine is enough. |
| Postgres | Neon | `DATABASE_URL` on both Vercel and Fly (pooled connection string). Apply schema with `pnpm --filter @kudos/web db:push`. |
| Redis | Upstash | `REDIS_URL` (`rediss://`) on both. |
| Objects | Cloudflare R2 | `OBJECT_STORE=r2` plus the `R2_*` variables. The app uses presigned GET URLs so Magic Hour can fetch avatars and audio without a public bucket. |

Set `APP_ORIGIN` to the public site origin (for example `https://your-app.vercel.app`) if the browser origin and `Host` header can differ. Point the Magic Hour webhook at `https://<web-host>/api/webhooks/magic-hour` and use the same `MAGIC_HOUR_WEBHOOK_SECRET` in the app.

There is no public URL in this repo until that project is created. Do not commit `.env`.

## Build

Production build for the Next.js app:

```bash
pnpm --filter @kudos/web build
```

## Test

From the repo root:

```bash
pnpm test          # vitest in all workspaces
pnpm typecheck     # tsc --noEmit in all workspaces
pnpm secrets:scan  # gitleaks (matches CI)
```

CI runs `test`, `typecheck`, and `secrets:scan` on push/PR ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)).

## Documentation

| Doc | Contents |
|-----|----------|
| [01-product-brief.md](./docs/01-product-brief.md) | Problem, users, demo MVP scope, metrics |
| [02-user-flows.md](./docs/02-user-flows.md) | Landing → share; export guides; upload security |
| [03-awards-system.md](./docs/03-awards-system.md) | Awards catalog, Jev schema, large chats |
| [04-ceremony-generation.md](./docs/04-ceremony-generation.md) | Magic Hour pipeline, cost, fallbacks |
| [05-architecture.md](./docs/05-architecture.md) | Stack, services, diagram |
| [06-data-and-privacy.md](./docs/06-data-and-privacy.md) | Consent, retention, third parties |
| [07-api-and-data-model.md](./docs/07-api-and-data-model.md) | Entities, endpoints, JSON schema |
| [08-roadmap-and-risks.md](./docs/08-roadmap-and-risks.md) | Milestones, risks, unit economics |

## Key decisions

| Area | Choice |
|------|--------|
| **Ingestion** | `.json` upload only at demo MVP; adapters for Telegram / Messenger / Discord JSON |
| **Jev** | TypeSafe direct `POST https://api.typesafe.ai/v1/systemone` (pinned model); gateway optional for dev |
| **Ceremony** | Magic Hour async APIs (`text-to-video`, `ai-talking-photo`, TTS) |
| **Pricing** | Free for demo |
| **Roast dial** | Gentle / medium / spicy |
| **Fairness** | Max **4** awards per person |

## Repo layout

```
/docs/                 Product & architecture
/apps/web/             Next.js UI + API routes
/apps/worker/          Background jobs (BullMQ)
/packages/chat-json/   Schema, validators, platform adapters
/packages/awards/      Stats + Jev orchestration
/packages/shared/      Shared types
/packages/storage/     Local disk and R2 object storage
/fixtures/             Sample & malicious JSON for tests
```

## License

TBD.
