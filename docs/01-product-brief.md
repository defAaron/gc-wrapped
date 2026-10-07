# 01 — Product brief

**Product name:** **Kudos AI**  
**One-liner:** Upload your group chat as JSON → get friend awards + a shareable AI awards ceremony.

---

## Problem

Group chats hold years of jokes, chaos, and “who’s bringing chips?” logistics. There’s no fun, shareable artifact that *celebrates* that history the way year-end recaps celebrate music or fitness.

Kudos AI gives groups a **roasty awards night**—stats-backed, Jev-judged where it matters, and a **ceremony video** worth posting back into the chat.

## Target users

| Segment | Why they care |
|--------|----------------|
| **College / early-career groups** (5–15 people) | Banter-heavy, share culture |
| **Long-running group chats** | Enough signal for meaningful awards |
| **Event chats** (trips, weddings, leagues) | Natural recap moment |

**Primary persona:** *The Organizer* — exports or converts chat to JSON, uploads, maps names/photos, shares the link.

**Demo MVP focus:** prove the **wow loop** (upload → awards → video → share), not revenue.

## Core loop

```mermaid
flowchart LR
  A[Landing] --> B[How to get JSON]
  B --> C[Upload JSON + validate]
  C --> D[Roast level + map members]
  D --> E[Analyze]
  E --> F[Awards preview]
  F --> G[Ceremony render]
  G --> H[Share link / MP4]
```

1. Land on “Your group chat deserves a standing ovation.”
2. Optional: read platform export guides (Telegram, Messenger, Discord, etc.)—all paths end in **JSON**.
3. Upload `.json`; server validates structure and security limits.
4. Choose **gentle / medium / spicy** roast level; confirm members and optional avatars.
5. Analyze (code stats + Jev).
6. Preview awards + receipts.
7. Generate ceremony (Magic Hour, async).
8. Share unlisted link or download video.

**Session shape:** one upload → one Kudos session artifact. Re-upload is v2.

## Why it’s shareable

- Everyone in the export can “win” something.
- Roast + affection = reply fuel in the original chat.
- Vertical video fits Stories / TikTok / Discord.
- Free demo removes friction for “try it on our chat tonight.”

## Demo MVP scope (v0.1)

| In scope | Out of scope |
|----------|----------------|
| Web app, mobile-friendly | Native apps |
| **JSON upload only** (see [07](./07-api-and-data-model.md)) | `.txt`, ZIP, live APIs |
| Auto-detect **Telegram**, **Messenger**, **DiscordChatExporter** JSON + **Kudos v1** schema | WhatsApp txt at launch (guide users to convert or use sample) |
| Malicious / abusive JSON checks | AV scanning of binaries inside JSON (no embedded blobs at MVP) |
| 3–20 members, ≥500 messages recommended | 2M+ msgs without date-range picker |
| 18 awards, max **4 per person** | Custom user-written awards |
| Roast dial: **gentle / medium / spicy** | Per-award tone |
| Optional avatar per member (user upload) | Scraping faces from chat media |
| Free preview + free ceremony | Payments, accounts, chat library |
| Share page + MP4 download | Public discover feed |

### Ingestion strategy (demo)

**Single rule for the product:** upload must be a **JSON file**.

| Layer | Behavior |
|-------|----------|
| **Canonical** | [Kudos Chat JSON v1](./07-api-and-data-model.md#kudos-chat-json-v1) — documented for scripts and partners |
| **Adapters** | Sniff `format` / shape → normalize to canonical |
| **Security** | Reject oversize, deeply nested, prototype-pollution keys, HTML/script in text fields, absurd cardinality (see [02](./02-user-flows.md#upload-validation--security)) |

Platform research (for **export guides**, not separate parsers at MVP):

| Platform | Path to JSON for users |
|----------|-------------------------|
| **Telegram** | Desktop → Export chat → **JSON** → `result.json` |
| **Messenger** | Facebook DYI → Messages → **JSON** → `messages/inbox/.../message_1.json` (upload one thread file or zip later) |
| **Discord** | DiscordChatExporter / browser tools → **JSON** |
| **WhatsApp** | No JSON export → demo: use converter script (docs) or Telegram/Messenger for dogfood |
| **iMessage** | Third-party tools → CSV/TXT → not MVP; convert to Kudos JSON manually |

**Upload limits (demo):** **50 MB** JSON max; **500k messages** max after normalize; **10k** max per message body length (truncate with warning).

## Business model

**Demo: everything free.** No paywall, no credits UI. Internal cost caps (Magic Hour + Jev) enforced via rate limits and queue depth (see [08](./08-roadmap-and-risks.md)).

Post-demo options (not committed): free preview + paid HD, or one-time per ceremony.

## Success metrics (demo)

| Metric | Target |
|--------|--------|
| Upload → awards preview | ≥ 50% |
| Preview → ceremony started | ≥ 70% |
| Ceremony completed (non-fallback) | ≥ 85% of started |
| Share (link copy or MP4 download) | ≥ 35% |
| Median time to preview (30k msgs) | < 90s |
| Security rejects (abusive uploads) | logged; <1% false positive |

## Principles

1. **Roast, don’t harm** — [03](./03-awards-system.md).
2. **JSON in, nothing raw kept** — delete upload after analysis ([06](./06-data-and-privacy.md)).
3. **Jev for judgment, code for math.**
4. **Kudos AI** branding; don’t imply official partnership with chat apps.

## Naming

**Chosen:** **Kudos AI** — positive frame (“kudos”) with explicit AI transparency for ceremony and judging.

---

## Assumptions & open questions

| # | Item |
|---|------|
| 1 | **Confirmed:** Free demo; no monetization in v0.1. |
| 2 | **Confirmed:** JSON-only upload with security validation. |
| 3 | **Confirmed:** Roast dial gentle / medium / spicy. |
| 4 | **Confirmed:** Max 4 awards per person. |
| 5 | **Confirmed:** Jev via TypeSafe direct API; pin model version. |
| 6 | **Assumption:** ≥3 members and ≥500 messages for “full” award deck; fewer → shortened deck + UI warning. |
| 7 | **Open:** Allow multi-file Messenger (merge `message_*.json`) in one session vs single file only at demo. |
| 8 | **Open:** Public share links indexed by Google (default `noindex` assumed). |
