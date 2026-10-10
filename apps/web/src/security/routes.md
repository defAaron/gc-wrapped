# API route inventory

Every `app/api/**/route.ts` must appear here with auth and rate-limit notes.

| Method | Path | Auth | Rate limit |
|--------|------|------|------------|
| POST | `/api/sessions` | Sets owner cookie | 30 / hour / IP |
| POST | `/api/sessions/:id/upload` | Owner cookie | 5 / hour / IP |
| PATCH | `/api/sessions/:id` | Owner cookie | — |
| DELETE | `/api/sessions/:id` | Owner cookie | — |
| POST | `/api/sessions/:id/analyze` | Owner cookie | Regenerate max 2 |
| POST | `/api/sessions/:id/publish` | Owner cookie | — |
| POST | `/api/sessions/:id/ceremony` | Owner cookie + consent | 3 / day / IP |
| GET | `/api/sessions/:id/status` | Owner cookie | — |
| GET | `/api/sessions/:id/video` | Owner cookie | — |
| GET | `/api/sessions/:id` | Owner cookie | — |
| POST | `/api/sessions/:id/members/:memberId/avatar` | Owner cookie | — |
| GET | `/api/s/:slug` | Public (slug) | — |
| GET | `/api/s/:slug/video` | Public (slug) | — |
| POST | `/api/s/:slug/report` | Same-origin | 5 / hour / IP |
| POST | `/api/webhooks/magic-hour` | HMAC signature | — |

Public routes must not expose session UUIDs or raw message archives. Owner routes return 404 without the matching cookie.
