# Vercel deployment plan

Deploy the Kudos AI Next.js app (`apps/web`) to Vercel. Postgres and Redis stay on managed hosts. The ceremony worker does **not** run on Vercel.

## What lands where

| Piece | Host | Why |
|-------|------|-----|
| Next.js UI and API routes | **Vercel** | `apps/web`, Next.js 15 App Router |
| Postgres | **Supabase** | Sessions, members, analysis, ceremonies. The app uses Drizzle and `pg`, so any Supabase Postgres URL works. |
| Redis | **Upstash** | BullMQ queue that `POST /api/sessions/:id/ceremony` writes to |
| Ceremony worker + ffmpeg | **Not Vercel** | `apps/worker` is a long-running process (`pnpm --filter @kudos/worker dev`). Vercel functions cannot run ffmpeg or a BullMQ worker. |
| Avatars and MP4s | **Not durable on Vercel yet** | Code writes to local disk (`OBJECT_STORE_DIR`, default `.data`). Serverless disks are ephemeral. Upload, analyze, and preview work. Avatar and video playback do not survive across requests until object storage is swapped for R2 or S3. |

Do not set `CEREMONY_INLINE=1` in production. That runs the ceremony inside the API request, which needs ffmpeg and a writable disk.

## Before you start

You need:

- This repo on GitHub (Vercel deploys from Git).
- A [Vercel](https://vercel.com) account.
- A [Supabase](https://supabase.com) project (Postgres only; the app does not use the Supabase client or anon key).
- An [Upstash](https://upstash.com) Redis database (needed only when someone starts a ceremony).
- These secrets, kept out of git: `SESSION_SECRET`, `TYPESAFE_API_KEY`, `MAGIC_HOUR_API_KEY`, `MAGIC_HOUR_WEBHOOK_SECRET`.

Node **22** and **pnpm 9.15.9** match CI and `package.json`. Vercel should use the same.

---

## 1. Create the database

1. In Supabase, create a project. Save the database password. That password is the Postgres role password, not the anon or service-role API key.
2. Open **Connect** (or **Project Settings → Database**) and copy the **Session pooler** URI. It uses port **5432** on `pooler.supabase.com` and looks like `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`.
3. Use that URI for `DATABASE_URL`. The app opens a `pg` pool, and session mode supports the prepared statements that driver uses. Transaction mode (port **6543**) will fail those queries unless the pool is changed in code.
4. If the URI has no `sslmode`, append `?sslmode=require`.

Leave the local Docker Postgres (`localhost:5432`) for development. Production uses the Supabase URL only. The direct host `db.[ref].supabase.co` is IPv6-only unless you add the IPv4 add-on, so prefer the session pooler from a laptop and from Vercel.

## 2. Create Redis

1. In Upstash, create a Redis database in a region close to the Vercel region you will pick (US East is a safe default).
2. Copy the **TLS** URL (`rediss://…`). BullMQ needs this as `REDIS_URL`.
3. The web app only enqueues jobs. Nothing consumes the queue until the worker from step 8 is running somewhere else.

## 3. Push the schema

There is no committed `drizzle/` migration folder. The schema lives in `apps/web/src/db/schema.ts` and is applied with Drizzle Kit.

From the repo root, with `DATABASE_URL` set to the Supabase **session pooler** URI (do not point this at localhost, and do not use port 6543):

```bash
cd apps/web
DATABASE_URL='postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require' pnpm exec drizzle-kit push
```

Confirm in the Supabase **SQL Editor** that tables such as `sessions`, `members`, `uploads`, `analyses`, and `ceremonies` exist. Drizzle creates them in `public`. Leave Row Level Security off for this demo: the Next.js server connects as the database user and enforces access with its own session cookie. The anon key is unused.

Re-run this command after schema changes, before promoting a deploy that depends on them.

## 4. Import the project on Vercel

1. Vercel → **Add New…** → **Project** → import the GitHub repo.
2. Set **Root Directory** to `apps/web`.
3. Leave **Include source files outside of the Root Directory** enabled. `apps/web` depends on workspace packages (`@kudos/chat-json`, `@kudos/awards`, `@kudos/shared`, `@kudos/worker`). The install must see the pnpm workspace at the repo root.
4. Framework preset: **Next.js**.
5. Node.js version: **22.x** (Project → Settings → General).
6. Package manager: **pnpm**. If Vercel asks for an override, set the install command to `pnpm install --frozen-lockfile` and the build command to `pnpm build`. Those run in `apps/web` after Vercel installs the workspace.
7. Do not set an Output Directory. Next.js sets that itself.

Production branch should be the branch you actually ship (`main` or `master`).

## 5. Set environment variables

In the Vercel project → **Settings → Environment Variables**, add these for **Production** (and Preview if you want PR URLs to work).

| Name | Value |
|------|--------|
| `DATABASE_URL` | Supabase session pooler URI from step 1 (port 5432, `sslmode=require`) |
| `REDIS_URL` | Upstash `rediss://` URL from step 2 |
| `SESSION_SECRET` | Long random string. Generate with `openssl rand -base64 32`. Cookie signing and rate-limit hashing use it. |
| `TYPESAFE_API_KEY` | TypeSafe key. If it is empty, analysis uses the local stub instead of Jev. |
| `MAGIC_HOUR_API_KEY` | Magic Hour key. Only the worker reads this. |
| `MAGIC_HOUR_WEBHOOK_SECRET` | Shared secret for `POST /api/webhooks/magic-hour`. If unset, that route returns 503. |

Leave these **unset** on Vercel:

| Name | Why |
|------|-----|
| `CEREMONY_INLINE` | Would run ffmpeg inside the request. |
| `CEREMONY_PROVIDER` | `fallback` and `fake_fail` are for tests. |
| `RATE_LIMIT_DISABLED` | Turns off rate limits outside development. |
| `OBJECT_STORE_DIR` | A path on the function filesystem will not persist. |
| `VITEST` | Forces the in-memory test database. |

Vercel sets `NODE_ENV=production` on production deploys. The session cookie is `Secure` only when that is set.

`.env` at the repo root is for local `next dev` only. `apps/web/next.config.ts` loads it when present. Vercel injects the dashboard variables, so you do not upload `.env`.

## 6. Deploy

1. Trigger a deploy (push to the production branch, or **Deploy** in the dashboard).
2. Open the build log. A good install mentions the workspace and finishes `next build` for `@kudos/web`.
3. If the build fails because a workspace package cannot be resolved, confirm Root Directory is `apps/web` and files outside that directory are included. Do not switch the root to the repo root unless you also set the build to `pnpm --filter @kudos/web build` and the output to Next’s `.next` under `apps/web`.

The first successful deploy prints a URL like `https://<project>.vercel.app`.

## 7. Point Magic Hour at the webhook

After the URL exists:

1. Magic Hour webhook URL: `https://<project>.vercel.app/api/webhooks/magic-hour`
2. Use the same secret as `MAGIC_HOUR_WEBHOOK_SECRET`.
3. Redeploy if you added or changed env vars after the first build. Vercel bakes env into the deployment; editing them does not update an already-built deployment until you redeploy.

If you add a custom domain later, update the webhook to that host. Same-origin checks compare the request `Origin` to `Host`, so the app itself does not need an extra allowlist.

## 8. Run the worker off Vercel

Ceremony jobs sit in Redis until a process calls `startCeremonyWorker()` (`apps/worker/src/index.ts`).

On a host that can run a container (Fly.io or Railway, per the architecture doc):

- Node 22, ffmpeg installed.
- Same `DATABASE_URL`, `REDIS_URL`, `MAGIC_HOUR_API_KEY`, and `MAGIC_HOUR_WEBHOOK_SECRET` as Vercel.
- Start command: `pnpm --filter @kudos/worker dev` is the watch script for local use. For a server, run the worker entry with `tsx` once: `pnpm --filter @kudos/worker exec tsx src/index.ts` from a built checkout of this repo.
- Writable disk only matters until object storage moves off local files. The worker and the web app must share the same store; a disk on the worker is invisible to Vercel routes that read avatars and video (`createLocalObjectStore`).

Skip this step if the goal is only to ship the site and the upload → analyze flow. Starting a ceremony will enqueue a job and stay on `rendering` until a worker runs.

## 9. Smoke test the deployment

Use the production URL in a browser, not `next dev`.

1. Open `/`. The landing page loads and the response includes `X-Content-Type-Options: nosniff`.
2. Start a session and upload a small fixture, for example `fixtures/sample-minimal.json`.
3. Finish setup and run analyze. With `TYPESAFE_API_KEY` set, awards come from Jev. Without it, the stub provider still returns a preview.
4. Confirm the owner cookie is set (`kudos_sid`, HttpOnly, Secure).
5. Optional: `POST` a signed body to `/api/webhooks/magic-hour` and expect 401 for a bad signature, not 503. 503 means `MAGIC_HOUR_WEBHOOK_SECRET` is missing.

Avatar upload and ceremony video will not round-trip on Vercel with the current disk store. Treat a failure there as expected until R2 or S3 is wired in.

## 10. Later deploys

1. Merge to the production branch. Vercel builds and promotes automatically if production auto-deploy is on.
2. If `apps/web/src/db/schema.ts` changed, run `drizzle-kit push` against the Supabase session pooler **before** the new deployment serves traffic.
3. Change env vars in the dashboard, then redeploy.
4. Preview deployments on pull requests get Preview env vars. Point them at a separate Supabase project if you do not want previews writing to production data.

## Checklist

- [ ] Supabase project created; session pooler `DATABASE_URL` copied (port 5432)
- [ ] `drizzle-kit push` applied to that database
- [ ] Upstash Redis created; `REDIS_URL` copied
- [ ] Vercel project root is `apps/web`, Node 22, pnpm
- [ ] Production env vars set; `CEREMONY_INLINE` and `RATE_LIMIT_DISABLED` unset
- [ ] Production deploy succeeded
- [ ] Landing page, upload, and analyze work on the Vercel URL
- [ ] Magic Hour webhook URL and secret match the deployment
- [ ] Worker planned on Fly.io or Railway when ceremonies must finish
