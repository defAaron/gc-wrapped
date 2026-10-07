# Group Chat Wrapped (working title)

Turn a group-chat export into roasty friend awards and an AI-generated awards ceremony you can drop back into the chat.

## Status

**Planning / pre-build.** Foundational product docs live in [`/docs`](./docs).

## What we're building

1. User uploads an official (or documented third-party) chat export.
2. We parse messages, compute stats, and use [Jev](https://jevtypesafeai.com/jev/api) for subjective award judging (typed `choice` / `score` / `noul` decisions—not free-form text).
3. [Magic Hour](https://docs.magichour.ai/integration/overview) renders a shareable ceremony video (async jobs + webhooks).
4. User gets a link and/or MP4 to post in the group.

## Documentation index

| Doc | Contents |
|-----|----------|
| [01-product-brief.md](./docs/01-product-brief.md) | Problem, users, MVP scope, metrics, name ideas |
| [03-awards-system.md](./docs/03-awards-system.md) | Award catalog, signals, Jev schema, large-chat strategy |
| *02, 04–08* | *Drafted after review of 01 & 03* |

## Key constraints (already decided)

- **Ingestion:** export file upload only (no live platform connectors at MVP).
- **Judging:** Jev API (`POST /api/v1/decide` or TypeSafe `POST /api/v1/systemone`).
- **Ceremony:** Magic Hour video APIs (async).

## Repo layout (planned)

```
/docs/           Product & architecture documentation
/apps/web/       Next.js web app (TBD)
/apps/api/       Upload, parse, analyze, render orchestration (TBD)
/packages/       Shared parsers, stats, award definitions (TBD)
```

## Local development

Not wired yet. See roadmap in `docs/01-product-brief.md` once milestones are finalized.

## License

TBD.
