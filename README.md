# Kudos AI

Turn a group-chat JSON export into roasty friend awards and an AI-generated awards ceremony you can drop back into the chat.

## Status

**Demo MVP (planning).** Product docs in [`/docs`](./docs). **Free** end-to-end for now—no paywall.

## What we're building

1. User uploads a **JSON** chat file (native [Kudos format](./docs/07-api-and-data-model.md#kudos-chat-json-v1) or auto-detected platform export).
2. We **validate** for size/structure/malicious content, normalize messages, compute stats, and use [Jev](https://jevtypesafeai.com/jev/api) for subjective award judging.
3. User picks roast level (**gentle / medium / spicy**) and optional avatars.
4. [Magic Hour](https://docs.magichour.ai/integration/overview) renders a shareable ceremony video (async + webhooks).
5. User gets a link and/or MP4 to post in the group.

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

## Repo layout (planned)

```
/docs/                 Product & architecture
/apps/web/             Next.js UI (TBD)
/apps/api/             Upload, parse, analyze, render (TBD)
/packages/chat-json/   Schema, validators, platform adapters (TBD)
/packages/awards/      Stats + Jev orchestration (TBD)
```

## License

TBD.
