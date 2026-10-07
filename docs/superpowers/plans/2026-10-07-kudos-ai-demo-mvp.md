# Kudos AI Demo MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement **one problem at a time**. Inside that problem, subagents may work in parallel on the subproblems named below. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a free demo where someone uploads a group-chat JSON file, gets 18 roasty friend awards, and can share an awards page plus a 9:16 ceremony video.

**Architecture:** A pnpm monorepo. `packages/chat-json` turns untrusted JSON into a canonical chat. `packages/awards` computes stats, asks Jev only for subjective winners, and fills roast lines from templates. `apps/web` (Next.js App Router) owns the UI, session API, and Postgres. `apps/worker` owns Magic Hour jobs and ffmpeg concat. Object storage is a filesystem adapter locally and R2 in production, behind one interface.

**Tech Stack:** Node 22, pnpm workspaces, Next.js 15 App Router, React, Tailwind, TypeScript, Vitest, Zod, Postgres 16 (Docker), Drizzle, BullMQ + Redis (ceremony only), ffmpeg, TypeSafe Jev `jev-1.13.0`, Magic Hour async APIs.

## Global Constraints

- Demo is free. No payments, accounts, or credits UI.
- Upload is a single `.json` file. No `.txt`, ZIP, or live chat APIs.
- Adapters: Kudos Chat JSON v1, Telegram `result.json`, Messenger `message_1.json`, DiscordChatExporter JSON.
- Limits: 50 MB upload, depth 32, 10,000 keys per object, 500,000 messages, 10,000 chars per text field (truncate message text and record a warning), 100 distinct senders, parse CPU budget 30s.
- Reject `__proto__`, `constructor`, and `prototype` keys. Never `eval`. Strip null bytes. Strip HTML from message text. Reject bodies containing `<script` (case-insensitive).
- 3–20 members expected. Block analysis if fewer than 2 members remain after exclusions. Warn if fewer than 3 members or fewer than 500 messages, and use a shortened award deck.
- 18 awards. Max 4 awards per person. Inactive members (`< 2%` of messages and `< 20` messages) are excluded from negative awards.
- Roast levels: `gentle` | `medium` | `spicy`. Default `medium`.
- Jev returns `choice` / `score` / `noul` only. Presentation lines come from template tables. Pin model `jev-1.13.0`. Never send the full chat to Jev. State target ≤ 20k tokens. Exemplar text ≤ 160 chars. Max 5 exemplars per category per member.
- Regenerate awards at most 2 times per session (Jev only, same stats).
- Rate limits: 5 uploads / hour / IP, 3 ceremonies / day / IP, 30 session creates / hour / IP.
- Raw JSON deleted within 15 minutes of successful parse, or within 1 hour of failure. Do not persist the full message archive. Persist aggregates plus ≤ 5 exemplar quotes per member.
- Session TTL 30 days. Final MP4 TTL 7 days. Rate-limit IP rows TTL 90 days.
- Share quotes hidden by default. Share pages send `noindex`. Slug is 128-bit, unguessable.
- Ceremony is voice-only (no music bed). Watermark text: `Made with Kudos AI`. 9:16, 720p, 60–90s, top 6 talking-photo awards plus a speed-round card.
- Anonymous sessions. `httpOnly` cookie. No JWT.
- Secrets exist only in `.env` (gitignored) and the host’s secret store. `.env.example` has empty values.
- Product name in UI is **Kudos AI**. Do not imply a partnership with Telegram, Meta, or Discord.

## Locked decisions (open questions closed for this plan)

| Topic | Decision |
|-------|----------|
| Messenger multi-file | Single `message_1.json` only. Merge is out of scope. |
| Quotes on the share page | Hidden by default. Owner can toggle them on for their own preview. Public slug stays quote-hidden unless the owner explicitly publishes quotes. |
| Music | Voice-only. |
| Accounts | Anonymous cookie. No magic link. |
| API shape | Same-origin Next.js route handlers under `apps/web/app/api`. No separate `apps/api`. |
| Small-chat analysis | In-process inside the web app. Status is still written to Postgres so the UI can poll. BullMQ starts at the ceremony problem. |
| Local objects | `apps/web/src/storage/local-disk.ts` writing to `.data/` (gitignored). R2 adapter is a later swap behind `ObjectStore`. |
| Watermark | Yes, burned into the slideshow/ceremony end card. |
| Public indexing | `noindex, nofollow` on `/s/[slug]`. |
| Host voice | One voice for all TTS. |

## Execution protocol (every problem)

1. Work **only the next unblocked problem**. Do not start the following problem in the same turn.
2. Inside the problem, dispatch the named subagents in parallel where the plan says `parallel`. The parent integrates their output.
3. Run the problem’s test command. Fix failures before committing.
4. Run the problem’s **security gate**. If it fails, fix and re-run. Do not commit a failing gate.
5. **Stagger commits:** one commit per subproblem, in the order listed, after that subproblem’s tests pass. Do not squash them into one commit. Do not push.
6. Start the dev server when the problem says it is runnable. Give the local URL.
7. Reply with: commits made, what changed, how to test, and the local URL.
8. **Stop.** Wait for the user to say which problem to run next.

Commit messages use the repo’s current style: short, lowercase, no conventional-commit prefix required. Example: `add safe json parser`.

Never commit `.env`, `.data/`, real chat exports, API keys, or Magic Hour download URLs.

## File map

| Path | Responsibility |
|------|----------------|
| `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json` | Workspace |
| `.gitignore`, `.env.example` | Secret and data hygiene |
| `docker-compose.yml` | Local Postgres (problem 5) and Redis (problem 8) |
| `packages/chat-json` | Schema, safe parse, adapters |
| `packages/awards` | Features, deterministic awards, Jev, templates, fairness |
| `packages/shared` | Roast level, error codes, slug, session status enums shared by web and worker |
| `apps/web` | UI + route handlers + Drizzle |
| `apps/worker` | Ceremony queue, Magic Hour, ffmpeg |
| `fixtures/` | Synthetic JSON only |
| `apps/web/src/security/` | Rate limit, origin check, HTML escape, log redaction |

## Problem order

| # | Problem | Depends on | Parallel agents inside the problem | User can test |
|---|---------|------------|--------------------------------------|---------------|
| 0 | Workspace, secret hygiene, runnable shell | — | 1 agent | `http://localhost:3000` placeholder |
| 1 | Safe canonical JSON parser | 0 | 1 implementer + 1 security tests | Vitest malicious-JSON suite |
| 2 | Platform adapters | 1 | 3 adapter agents, then 1 detector | Fixture tests |
| 3 | Feature store and code awards | 2 | 2 feature agents, then 1 award agent | Golden feature vectors |
| 4 | Jev awards, fairness, tone safety | 3 | 1 client agent + 1 copy agent, then integrator | Mocked Jev, no API key |
| 5 | Session API, authz, rate limits | 4 | 1 schema agent, then 3 route agents + 1 security agent | curl against local API |
| 6 | Upload → awards preview UI | 5 | 3 page agents after shared shell | Browser flow with sample JSON |
| 7 | Share page, deletion, consent | 6 | 1 share agent + 1 retention agent | Unlisted link, raw file gone |
| 8 | Ceremony worker | 7 | 1 job-state agent, then 3 pipeline agents + 1 security agent | MP4 or slideshow fallback |
| 9 | Ceremony UI and delivery | 8 | 1 UI agent | Watch, download, copy link |
| 10 | Launch hardening | 9 | 1 security agent + 1 product-copy agent | Full threat checklist |

Out of scope for all problems: payments, user accounts, WhatsApp converter, Messenger multi-file merge, public discover feed, native apps, background music, per-subject opt-out portal, date-range picker for 2M-message chats.

---

### Problem 0: Workspace, secret hygiene, runnable shell

**Why first:** Every later package imports from this workspace. The secret rules have to exist before any API key is typed.

**Agents:** one agent. Subproblems are sequential because each edits the root.

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `.gitleaks.toml`, `apps/web/package.json`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/web/app/globals.css`, `packages/chat-json/package.json`, `packages/awards/package.json`, `packages/shared/package.json`, `packages/shared/src/index.ts`

**Produces:**
- Workspace scripts: `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm secrets:scan`
- `packages/shared` exports `RoastLevel`, `SessionStatus`, `ApiErrorCode`

```typescript
export type RoastLevel = "gentle" | "medium" | "spicy";

export type SessionStatus =
  | "created"
  | "uploaded"
  | "mapping"
  | "analyzing"
  | "preview"
  | "rendering"
  | "complete"
  | "failed";

export type ApiErrorCode =
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_SHAPE"
  | "MALICIOUS_CONTENT"
  | "TOO_MANY_MESSAGES"
  | "PARSE_TIMEOUT"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "CONSENT_REQUIRED"
  | "NOT_FOUND"
  | "INVALID_INPUT";
```

- [ ] **Step 1: Root workspace**

`package.json` private, `"packageManager": "pnpm@9"`, scripts:

- `dev`: `pnpm --filter @kudos/web dev`
- `test`: `pnpm -r test`
- `typecheck`: `pnpm -r typecheck`
- `secrets:scan`: `gitleaks detect --source . --no-git --redact --config .gitleaks.toml`

`pnpm-workspace.yaml` packages: `apps/*`, `packages/*`.

`tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `target` ES2022, `moduleResolution` bundler.

- [ ] **Step 2: Ignore secrets and local data**

`.gitignore` must include `.env`, `.env.*`, `!.env.example`, `.data/`, `node_modules/`, `.next/`, `dist/`, `*.mp4`, `*.pem`, `coverage/`.

`.env.example` keys, all empty:

```
DATABASE_URL=
SESSION_SECRET=
TYPESAFE_API_KEY=
MAGIC_HOUR_API_KEY=
MAGIC_HOUR_WEBHOOK_SECRET=
OBJECT_STORE_DIR=.data
```

`.gitleaks.toml` extends the default rules and allowlists only `.env.example` empty assignments.

- [ ] **Step 3: Shared enums and a placeholder page**

`apps/web` is Next.js 15, React 19, TypeScript. `app/page.tsx` renders the headline “Your group chat deserves a standing ovation.” and the trust line “Free demo · Raw file deleted after analysis · You control sharing.” No upload control yet.

`packages/chat-json` and `packages/awards` export an empty `src/index.ts` and a Vitest script that runs zero tests successfully (`passWithNoTests: true`) so `pnpm test` is green.

- [ ] **Step 4: Verify**

Run: `pnpm install && pnpm typecheck && pnpm test && pnpm secrets:scan`
Expected: typecheck clean, tests green, gitleaks reports no leaks.

Run: `pnpm dev`
Expected: `http://localhost:3000` shows the headline.

- [ ] **Step 5: Stagger commits, then stop**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json pnpm-lock.yaml
git commit -m "scaffold pnpm workspace"

git add .gitignore .env.example .gitleaks.toml
git commit -m "ignore secrets and local chat data"

git add packages apps
git commit -m "add placeholder web shell and shared types"
```

Do not push.

**Security gate:** `git status` shows no `.env`. `pnpm secrets:scan` is clean. `.env.example` contains no live key material.

**User test:** Open `http://localhost:3000`. Confirm the headline. Confirm `git check-ignore -v .env` matches `.gitignore`.

---

### Problem 1: Safe canonical JSON parser

**Why now:** Adapters, awards, and the upload endpoint all consume one safe parse result. Malicious JSON is rejected here, not in the UI.

**Agents:** sequential. One implementer writes the parser. One security subagent writes the malicious fixtures and tests first, then the implementer makes them pass. They share `packages/chat-json`, so they do not edit the same files at the same time: security agent owns `src/parse.test.ts` and `fixtures/malicious/`; implementer owns `src/parse.ts` and `src/types.ts`.

**Files:**
- Create: `packages/chat-json/src/types.ts`, `packages/chat-json/src/limits.ts`, `packages/chat-json/src/parse.ts`, `packages/chat-json/src/parse.test.ts`, `packages/chat-json/src/schema/kudos-v1.json`, `fixtures/sample-apartment-4b.json`, `fixtures/malicious/*.json`

**Consumes:** `ApiErrorCode` from `@kudos/shared` for the error codes that overlap.

**Produces:**

```typescript
export type FormatDetected = "kudos_v1" | "telegram" | "messenger" | "discord" | "generic";

export type CanonicalMessage = {
  id: string;
  ts: string;
  authorId: string;
  text: string;
  type: "message" | "system";
  reactions?: { emoji: string; count: number }[];
  replyToId?: string;
};

export type CanonicalChat = {
  kudosVersion: "1";
  chat: {
    title: string;
    platform: "kudos" | "telegram" | "messenger" | "discord" | "unknown";
    exportedAt: string | null;
  };
  members: { id: string; displayName: string }[];
  messages: CanonicalMessage[];
  warnings: string[];
};

export type ParseFailure = {
  ok: false;
  code: "FILE_TOO_LARGE" | "UNSUPPORTED_SHAPE" | "MALICIOUS_CONTENT" | "TOO_MANY_MESSAGES" | "PARSE_TIMEOUT";
  message: string;
};

export type ParseSuccess = { ok: true; formatDetected: FormatDetected; chat: CanonicalChat };

export function parseChatJson(bytes: Buffer): ParseSuccess | ParseFailure;
```

`parseChatJson` in this problem accepts **Kudos v1 only**. Other shapes return `UNSUPPORTED_SHAPE`. Adapters arrive in problem 2. Detection order is reserved:

1. `kudos_version` → `kudos_v1`
2. else `UNSUPPORTED_SHAPE` until problem 2

- [ ] **Step 1: Security tests (failing)**

`fixtures/sample-apartment-4b.json` is synthetic: title `Apartment 4B`, 6 members (`Alex`, `Sam`, `Jordan`, `Riley`, `Morgan`, `Casey`), about 800 messages, no real names or phone numbers. Include late-night messages, links, double texts, `lol` replies, and one logistics poll so later award tests have signal.

Tests in `parse.test.ts`:

| Case | Input | Expected code |
|------|--------|----------------|
| Valid sample | `sample-apartment-4b.json` | `ok: true`, `formatDetected: "kudos_v1"`, 6 members |
| Oversize | Buffer length 50 * 1024 * 1024 + 1 | `FILE_TOO_LARGE` before `JSON.parse` |
| Proto | `{"__proto__": {"admin": true}, "kudos_version":"1", ...}` | `MALICIOUS_CONTENT` |
| Constructor key | object with key `constructor` | `MALICIOUS_CONTENT` |
| Prototype key | object with key `prototype` | `MALICIOUS_CONTENT` |
| Depth | 33 nested objects | `MALICIOUS_CONTENT` |
| Key cardinality | one object with 10,001 keys | `MALICIOUS_CONTENT` |
| Message cardinality | `messages` length 500,001 | `TOO_MANY_MESSAGES` |
| Script | message text `hello <script>alert(1)</script>` | `MALICIOUS_CONTENT` |
| HTML | message text `hello <b>x</b>` | `ok: true`, stored text `hello x`, warning present |
| Null byte | text containing `\u0000` | stripped, still ok if otherwise valid |
| Long text | 10,001 chars | truncated to 10,000, warning `truncated` |
| Unknown shape | `{"foo":1}` | `UNSUPPORTED_SHAPE` |
| Not JSON | `not json` | `MALICIOUS_CONTENT` or `UNSUPPORTED_SHAPE` (pick `UNSUPPORTED_SHAPE` for syntax errors that are not oversize) |

Run: `pnpm --filter @kudos/chat-json test`
Expected: FAIL, `parseChatJson` missing.

- [ ] **Step 2: Implement**

`limits.ts` exports the numeric caps from Global Constraints.

`parse.ts`:

- If `bytes.length` exceeds 50 MB, return `FILE_TOO_LARGE` without parsing.
- Walk with a reviver that throws on forbidden keys.
- Track depth during the walk; depth > 32 throws `MALICIOUS_CONTENT`.
- Reject objects with more than 10,000 keys.
- `JSON.parse` only. No `eval`, no `Function`.
- Validate Kudos v1 with Zod: `kudos_version === "1"`, unique message ids, ISO timestamps, `author_id` string. Missing `members` is allowed; create members from distinct `author_id` using the id as `displayName`.
- Truncate `text` to 10,000 chars and push a warning.
- Strip `\u0000`. Strip tags with a conservative stripper (remove `<[^>]*>`). If the raw text matches `/<script/i`, return `MALICIOUS_CONTENT` instead of stripping.
- Distinct authors > 100 → `MALICIOUS_CONTENT`.
- Wrap the walk in a 30s deadline. Exceeding it returns `PARSE_TIMEOUT`.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @kudos/chat-json test && pnpm --filter @kudos/chat-json typecheck`
Expected: PASS.

- [ ] **Step 4: Stagger commits, then stop**

```bash
git add fixtures/sample-apartment-4b.json packages/chat-json/src/schema packages/chat-json/src/types.ts packages/chat-json/src/limits.ts
git commit -m "add kudos chat json v1 types and sample"

git add packages/chat-json/src/parse.test.ts fixtures/malicious
git commit -m "add malicious json parser tests"

git add packages/chat-json/src/parse.ts packages/chat-json/src/index.ts
git commit -m "reject unsafe json before awards"
```

**Security gate:** Re-read `parse.ts` for `eval`, `Function(`, `require(`, and child_process. None may appear. Confirm oversize is rejected from `byteLength` before parse. Confirm fixture files contain no real phone numbers, emails, or tokens (`pnpm secrets:scan`).

**User test:** `pnpm --filter @kudos/chat-json test`. Dev server from problem 0 still serves the placeholder at `http://localhost:3000` (parser is not on the page yet).

---

### Problem 2: Platform adapters

**Why now:** The sample file is not how real users arrive. Telegram, Messenger, and Discord must become the same `CanonicalChat` before any stats exist.

**Agents (parallel after the interface stub exists):**

| Agent | Owns | Does not touch |
|-------|------|----------------|
| Telegram | `src/adapters/telegram.ts`, `src/adapters/telegram.test.ts`, `fixtures/telegram-snippet.json` | other adapters |
| Messenger | `src/adapters/messenger.ts`, `src/adapters/messenger.test.ts`, `fixtures/messenger-snippet.json` | other adapters |
| Discord | `src/adapters/discord.ts`, `src/adapters/discord.test.ts`, `fixtures/discord-snippet.json` | other adapters |

Then one integrator writes `src/detect.ts` and changes `parseChatJson` to call it. Integrator starts only after the three adapter PRs of work are in the tree (same session, after the parallel agents finish).

**Consumes:** `CanonicalChat`, `parseChatJson` from problem 1.

**Produces:**

```typescript
export function adaptTelegram(root: unknown): CanonicalChat;
export function adaptMessenger(root: unknown): CanonicalChat;
export function adaptDiscord(root: unknown): CanonicalChat;

export function detectFormat(root: unknown): FormatDetected | null;
```

Detection order, first match wins:

1. Root object has `kudos_version` → `kudos_v1` (existing path)
2. `messages[].from_id` and `date_unixtime` → `telegram`
3. `messages[].sender_name` and `timestamp_ms` → `messenger`
4. `messages[].author.name` or `messages[].author.id` → `discord`
5. `messages[]` with `sender` and `timestamp` → `generic` (map sender → author, timestamp → ts). If that shape is absent, `null` → `UNSUPPORTED_SHAPE`

- [ ] **Step 1: Adapter contracts**

Telegram: `name` → chat title, `from_id` → author id, `from` → display name, `date_unixtime` seconds → ISO UTC, `text` string or array of strings/objects (join string parts, drop non-text entities), `type: "service"` → `system`.

Messenger: `title` or folder-less fallback `Messenger chat`, `participants[].name` → members, `sender_name` → author, `timestamp_ms` → ISO, `content` → text (missing content → `""`), reactions `[{reaction, actor}]` → grouped `{emoji, count}`. Sort messages ascending by timestamp (Messenger files are often newest-first).

Discord (DiscordChatExporter): `channel.name` or `guild.name` → title, `author.id` → author id, `author.name` → display name, `timestamp` ISO passthrough, `content` → text, `attachments` increment nothing in the canonical message (media count is a later feature via a `type` or empty marker). If an attachment exists and content is empty, text stays `""` and the adapter sets message `type: "message"` plus a warning the feature store can see: store `mediaHint: true` on the message.

Add optional `mediaHint?: boolean` to `CanonicalMessage` in `types.ts` before adapters start, so the three agents share it.

- [ ] **Step 2: Tests per adapter**

Each snippet is synthetic and under 20 messages.

- Telegram text-array message becomes one string.
- Messenger newest-first input comes out oldest-first.
- Discord author object maps to `authorId`.
- A Telegram file still passes the problem 1 malicious-key tests (reviver runs before adapt).
- `parseChatJson` on each snippet returns the matching `formatDetected`.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @kudos/chat-json test`
Expected: PASS, including problem 1 tests.

- [ ] **Step 4: Stagger commits, then stop**

```bash
git add packages/chat-json/src/types.ts
git commit -m "add media hint on canonical messages"

git add packages/chat-json/src/adapters/telegram.ts packages/chat-json/src/adapters/telegram.test.ts fixtures/telegram-snippet.json
git commit -m "normalize telegram result json"

git add packages/chat-json/src/adapters/messenger.ts packages/chat-json/src/adapters/messenger.test.ts fixtures/messenger-snippet.json
git commit -m "normalize messenger message json"

git add packages/chat-json/src/adapters/discord.ts packages/chat-json/src/adapters/discord.test.ts fixtures/discord-snippet.json
git commit -m "normalize discord chat exporter json"

git add packages/chat-json/src/detect.ts packages/chat-json/src/parse.ts
git commit -m "detect chat export format before parse"
```

**Security gate:** Adapters must not fetch URLs found in the JSON. Grep adapter files for `fetch(`, `http.request`, `axios`. Expected: no matches. Attachment `url` fields are ignored, not downloaded.

**User test:** `pnpm --filter @kudos/chat-json test`. Placeholder site remains at `http://localhost:3000`.

---

### Problem 3: Feature store and deterministic awards

**Why now:** Code awards do not need Jev, the database, or the UI. This is the math the rest of the product is not allowed to reimplement ad hoc.

**Agents:**

| Agent | Owns | Parallel? |
|-------|------|-----------|
| Volume/time | `src/features/volume.ts`, `src/features/time.ts` | yes, after `MemberFeatures` type lands |
| Social | `src/features/social.ts` (laugh, drama, replies, mentions, reactions) | yes, same wave |
| Awards | `src/deterministic.ts`, `src/catalog.ts` | no, starts after `buildFeatureStore` is exported |

Parent writes `src/features/types.ts` and `src/features/index.ts` stubs first, commits nothing until tests pass, then lets the two feature agents fill the files they own.

**Consumes:** `CanonicalChat`.

**Produces:**

```typescript
export type MemberFeatures = {
  memberId: string;
  displayName: string;
  msgCount: number;
  charCount: number;
  wordCount: number;
  activeDays: number;
  medianResponseSec: number | null;
  replySampleCount: number;
  lateNightShare: number;
  earlyBirdShare: number;
  linkCount: number;
  mediaCount: number;
  reactionReceived: number;
  laughProxy: number;
  dramaProxy: number;
  capsLockRate: number;
  doubleTextScore: number;
  mentionCount: number;
  emojiDensity: number;
  exemplars: {
    funny: string[];
    drama: string[];
    wholesome: string[];
    lateNight: string[];
    links: string[];
  };
};

export type FeatureStore = {
  featureVersion: "1";
  members: MemberFeatures[];
  messageCount: number;
  memberCount: number;
  dateRange: { start: string; end: string } | null;
};

export function buildFeatureStore(chat: CanonicalChat, timeZone: string): FeatureStore;

export type AwardId =
  | "most_messages" | "least_messages" | "fastest_replier" | "slowest_replier"
  | "late_night_texter" | "early_bird" | "link_lord" | "double_texter"
  | "caps_champion" | "emoji_overload" | "meme_dealer" | "funniest"
  | "hype_person" | "drama_starter" | "peacemaker" | "planner"
  | "chaos_gremlin" | "heart_of_group";

export type AwardDraft = {
  awardId: AwardId;
  title: string;
  winnerMemberId: string;
  runnerUpMemberId?: string;
  source: "code";
  margin: number;
  receipts: string[];
};

export function assignDeterministicAwards(store: FeatureStore): AwardDraft[];
```

Titles match `docs/03-awards-system.md` (The Human Notification, Ghost of the Year, and the rest of the code rows).

Deterministic IDs this problem assigns: `most_messages`, `least_messages`, `fastest_replier`, `slowest_replier`, `late_night_texter`, `early_bird`, `link_lord`, `double_texter`, `caps_champion`, `emoji_overload`, `meme_dealer`, `hype_person`. Subjective IDs are omitted until problem 4.

Rules:

- Ignore `type: "system"` in counts.
- `mediaCount` adds 1 when `mediaHint` is true.
- Timezone argument defaults to `UTC` for tests.
- Late night is local hours 0–4. Early bird is local hours 5–8.
- Reply samples: next message by a different author within 7 days. Median only if `replySampleCount >= 30`; otherwise the reply awards are skipped.
- Negative awards (`least_messages`, `slowest_replier`) skip members with `< 20` messages and `< 2%` of `messageCount`.
- Link award skipped if group `linkCount < 10`. Caps award skipped if the winner has `< 20` messages.
- Tie-break: higher `wordCount`, then lexicographic `memberId`.
- `margin` is the absolute gap between first and second on the primary metric (0 if only one eligible member).
- Exemplars: max 5 strings, each truncated to 160 characters. Funny exemplars prefer text that is followed within 5 minutes by a reply matching `/lol|lmao|haha|😂|💀/i`.
- `laugh_proxy`: count those reply hits caused by the author’s messages.
- `drama_proxy`: a burst is ≥ 8 messages in 30 minutes; a member scores if they sent ≥ 3 of them.
- `heart` graph stats are not required yet. `replyEdges` can wait for problem 4; add `replyEdges: { fromId: string; toId: string; count: number }[]` on `FeatureStore` now so problem 4 does not reshape the type.

- [ ] **Step 1: Tests**

Build a 40-message synthetic chat in the test file (not a new fixture of a real export) where Alex has the most messages, Jordan has the fewest among active members, Sam double-texts, Riley sends three links. Assert winners and that exemplars never exceed 160 chars or 5 items.

Second test: a member with 1 message is not Ghost of the Year when another low-but-active member exists.

- [ ] **Step 2: Implement feature modules and `assignDeterministicAwards`**

- [ ] **Step 3: Verify**

Run: `pnpm --filter @kudos/awards test && pnpm --filter @kudos/chat-json test`
Expected: PASS.

- [ ] **Step 4: Stagger commits, then stop**

```bash
git add packages/awards/src/features/types.ts packages/awards/src/catalog.ts
git commit -m "define award catalog and feature types"

git add packages/awards/src/features/volume.ts packages/awards/src/features/time.ts
git commit -m "count message volume and time of day"

git add packages/awards/src/features/social.ts
git commit -m "score replies laughs and drama"

git add packages/awards/src/features/index.ts packages/awards/src/deterministic.ts packages/awards/src/deterministic.test.ts
git commit -m "assign deterministic awards from features"
```

**Security gate:** Feature code must not log `text` or exemplars. Grep for `console.` in `packages/awards`. Expected: no message-body logging. Exemplar truncation test passes.

**User test:** `pnpm --filter @kudos/awards test`. Site still the placeholder at `http://localhost:3000`.

---

### Problem 4: Jev awards, fairness, and tone safety

**Why now:** Subjective awards and the max-4 rule have to be correct before any endpoint stores them. Tests use a recorded Jev response so this problem does not call the network and does not need `TYPESAFE_API_KEY`.

**Agents (parallel after types):**

| Agent | Owns |
|-------|------|
| Jev | `src/jev/client.ts`, `src/jev/questions.ts`, `src/jev/state.ts`, `src/jev/client.test.ts` |
| Copy | `src/copy/templates.ts`, `src/copy/blocklist.ts`, `src/copy/render.ts`, `src/copy/render.test.ts` |

Integrator then writes `src/analyze.ts`, which joins deterministic drafts, Jev answers, fairness, and copy.

**Consumes:** `FeatureStore`, `AwardDraft`, `AwardId`, `RoastLevel`.

**Produces:**

```typescript
export type AwardResult = {
  awardId: AwardId;
  title: string;
  winnerMemberId: string;
  runnerUpMemberId?: string;
  source: "code" | "jev";
  receipts: string[];
  presentationLine: string;
  exemplarQuote?: string;
  jev?: { questionId: string; confidence?: number };
};

export type JevClient = {
  decide(input: {
    model: "jev-1.13.0";
    state: unknown;
    questions: Record<string, unknown>;
  }): Promise<{ answers: Record<string, { type: string; choice?: string; noul?: number; confidence?: number }>; usage: { input_tokens: number } }>;
};

export function buildJevState(store: FeatureStore, roastLevel: RoastLevel): unknown;

export function analyzeChat(input: {
  store: FeatureStore;
  roastLevel: RoastLevel;
  jev: JevClient;
}): Promise<{ awards: AwardResult[]; inputTokens: number; jevModel: "jev-1.13.0" }>;
```

`HttpJevClient` reads `process.env.TYPESAFE_API_KEY` and POSTs `https://api.typesafe.ai/v1/systemone`. Tests inject a fake `JevClient`. If the key is missing, `HttpJevClient` throws `JEV_NOT_CONFIGURED` and never sends a request. No fallback that logs the state.

Subjective awards: `funniest`, `drama_starter`, `peacemaker`, `planner`, `chaos_gremlin`, `heart_of_group`. `meme_dealer` stays on code unless the top two `mediaCount` values tie, in which case ask `meme_dealer_winner`.

Shortlists: top 3 by the matching stat, or all members if fewer than 3. `funniest` shortlist is top 3 `laughProxy`. If `funniest_confidence_gate.noul < 0.55`, ignore the choice and use max `laughProxy`.

Fairness, applied after both layers:

1. If any member has more than 4 awards, reassign the lowest-confidence Jev award to its `runnerUpMemberId` when that runner-up would still have ≤ 4.
2. If still over 4, reassign the deterministic award with the smallest `margin` to its runner-up under the same cap.
3. Repeat until every member has ≤ 4 or no legal runner-up remains. Dropping an award is not allowed if any eligible runner-up exists.

Copy: three template strings per award per roast level. Pick with a stable hash of `awardId + winnerMemberId + roastLevel` so the same input always renders the same line. No Jev prose.

Blocklist: if an exemplar or rendered line matches the crisis/sexual-minor/slur patterns in `blocklist.ts`, omit `exemplarQuote` and suppress that award’s spicy line in favor of the gentle line. If the winner’s exemplars are only crisis text, skip the subjective award rather than roast it. Patterns live in code as case-insensitive substrings the product doc already forbids (diagnosis terms, body insults, slurs, minor sexual terms, “kill yourself”). Tests use obvious synthetic strings, not a catalog of slurs pasted in full; one representative token per category is enough and the token list stays in `blocklist.ts`.

State builder: include stats and truncated exemplars only. Assert `JSON.stringify(state).includes` is false for a message that was not selected as an exemplar. Cap serialized state by dropping exemplar categories until under 80,000 characters (stand-in for the 20k token budget in tests).

- [ ] **Step 1: Fake-Jev test**

Given a store where Alex leads `laughProxy`, fake answers pick Alex for funniest with confidence 0.8 and noul 0.9. Expect Alex, source `jev`. Second test: noul 0.4 falls back to the code leader. Third test: give one member 6 code awards by using a tiny group and stubbed drafts, then expect ≤ 4 after `analyzeChat`. Fourth test: exemplar `I want to kill myself` never appears on an award and does not use a spicy line.

- [ ] **Step 2: Implement client, templates, `analyzeChat`**

On `max_tokens_exceeded` (HTTP 400 body containing that string), rebuild state with exemplars removed and retry once. A second failure throws. Tests cover the retry with a fake client that fails once.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @kudos/awards test`
Expected: PASS, and no test reads `TYPESAFE_API_KEY`.

- [ ] **Step 4: Stagger commits, then stop**

```bash
git add packages/awards/src/jev
git commit -m "call jev with compact state only"

git add packages/awards/src/copy
git commit -m "render roast lines from templates"

git add packages/awards/src/analyze.ts packages/awards/src/analyze.test.ts
git commit -m "cap awards at four per person"
```

**Security gate:** `HttpJevClient` must not `console.log` the request body or the API key. Grep `packages/awards` for `TYPESAFE_API_KEY` and confirm it appears only as `process.env.TYPESAFE_API_KEY` inside the client. `pnpm secrets:scan` clean.

**User test:** `pnpm --filter @kudos/awards test`. No network. Placeholder remains at `http://localhost:3000`.

---

### Problem 5: Session API, authz, and rate limits

**Why now:** This is the first code that accepts a request from the internet. Awards are already a pure function, so the API’s job is sessions, ownership, limits, and storage — not new judging rules.

**Agents:**

1. Schema agent first (blocks the others): `docker-compose.yml` Postgres 16, Drizzle schema, migration, `ObjectStore` interface, local disk implementation.
2. Then parallel:

| Agent | Routes |
|-------|--------|
| Session | `POST /api/sessions`, `GET /api/sessions/:id`, `DELETE /api/sessions/:id` |
| Upload | `POST /api/sessions/:id/upload` |
| Settings | `PATCH /api/sessions/:id`, `POST /api/sessions/:id/analyze` |
| Security | `src/security/rate-limit.ts`, `src/security/origin.ts`, `src/security/session-cookie.ts`, and `app/api/**/*.test.ts` |

Security agent writes failing route tests first; route agents implement against them. They must not edit the same route file.

**Consumes:** `parseChatJson`, `buildFeatureStore`, `analyzeChat`, `AwardResult`.

**Produces:** Drizzle tables `sessions`, `members`, `uploads`, `analyses`, `awards`, `rate_limit_buckets`.

Cookie `kudos_sid`: 32 random bytes, base64url. Store only `sha256` on `sessions.owner_token_hash`. Flags: `httpOnly`, `sameSite: "lax"`, `path: "/"`, `secure` when `NODE_ENV=production`. The cookie value is the capability for every session created by that browser. A session row is visible only when the hash matches.

Slug: 16 random bytes, base64url, unique. Not used for owner routes.

Endpoints (same-origin `/api`, matching `docs/07-api-and-data-model.md`):

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/sessions` | sets cookie | 30 / hour / IP |
| POST | `/api/sessions/:id/upload` | cookie | multipart field `file` or `application/json`. 5 / hour / IP. Runs `parseChatJson`. Does not store raw bytes. Stores member rows, counts, warnings, feature-store JSON. Status `mapping`. |
| PATCH | `/api/sessions/:id` | cookie | `roastLevel`, `groupTitle`, member `displayName` / `excluded` / merge via `exportKey` kept, `consent: true` sets `consentAt` |
| POST | `/api/sessions/:id/analyze` | cookie | Requires `consentAt`. Runs `analyzeChat` in-process. Status `preview`. Idempotent if analysis exists. Body `{ regenerate: true }` allowed twice, then `RATE_LIMITED`. |
| GET | `/api/sessions/:id` | cookie | Owner DTO including awards. No raw messages. |
| DELETE | `/api/sessions/:id` | cookie | Deletes rows and `.data/sessions/:id` |

`Jev` on analyze uses `HttpJevClient`. Tests inject a fake via `setJevClientForTests`.

Rate-limit table: `(bucket, ip_hash, window_start, count)`. IP stored as sha256 with `SESSION_SECRET` as pepper, not raw IP. Return `429` body `{ code: "RATE_LIMITED" }`.

Origin check: mutating requests must have `Origin` host equal to the `Host` header, or no `Origin` (non-browser). Mismatch → `403` `{ code: "UNAUTHORIZED" }`.

Wrong or missing cookie on an owner route → `404` `{ code: "NOT_FOUND" }` so session ids are not confirmed to strangers.

Upload calls `parseChatJson` and maps its `code` to HTTP 400. It does not write the file into `.data`. Feature store JSON is the persisted artifact.

Member merge on PATCH: `{ "merge": [["memberA", "memberB"]] }` keeps `memberA`, sums counts, sets B `excluded: true`. Both ids must belong to the session.

Analyze refuses when fewer than 2 members have `excluded: false`.

Logs: a single helper `logEvent(name, fields)` deletes keys `text`, `exemplar`, `body`, `authorization`, `cookie`. Route handlers use it instead of `console.log` of the request.

- [ ] **Step 1: Compose and schema**

`docker-compose.yml` service `postgres` on port `5432`, database `kudos`, user/password only in compose for local dev (`kudos` / `kudos`), documented as local-only in `.env.example` `DATABASE_URL=postgres://kudos:kudos@localhost:5432/kudos`.

- [ ] **Step 2: Security tests**

Use Vitest + Next request helpers (or `app` `fetch` against a test server). Cases:

- Create session, upload sample, patch consent, analyze with fake Jev, GET returns 18 or fewer awards and no message archive.
- GET with no cookie → 404.
- GET with another browser’s cookie → 404.
- Upload 6 times in one window from one IP → 6th is 429.
- POST with `Origin: https://evil.example` → 403.
- Upload of the `__proto__` fixture → 400 `MALICIOUS_CONTENT`.
- Analyze without consent → 400 `CONSENT_REQUIRED`.
- Regenerate 3rd time → 429.

- [ ] **Step 3: Implement routes**

- [ ] **Step 4: Verify**

Run: `docker compose up -d postgres && pnpm --filter @kudos/web test && pnpm secrets:scan`
Expected: PASS, no leaks.

- [ ] **Step 5: Stagger commits, then stop**

```bash
git add docker-compose.yml packages/shared apps/web/drizzle apps/web/src/db
git commit -m "add postgres session schema"

git add apps/web/src/storage apps/web/src/security
git commit -m "add cookie auth and rate limits"

git add apps/web/app/api/sessions apps/web/src/session
git commit -m "add session upload and analyze api"

git add apps/web/app/api/**/*.test.ts
git commit -m "test session ownership and upload limits"
```

Adjust paths to the files that actually exist; do not commit `.data/` or `.env`.

**Security gate:**

- Every mutating route calls the origin check and the rate limiter.
- Owner reads compare `owner_token_hash`.
- Raw upload bytes are not inserted into Postgres (no `bytea` column, no `raw_json` column).
- `pnpm secrets:scan` clean.
- Response JSON for GET does not include a `messages` array. Add an assertion.

**User test:**

```bash
docker compose up -d postgres
pnpm --filter @kudos/web dev
```

`http://localhost:3000` is still the placeholder. Exercise the API:

```bash
curl -c /tmp/kudos.ck -H 'Origin: http://localhost:3000' -H 'Host: localhost:3000' -X POST http://localhost:3000/api/sessions
curl -b /tmp/kudos.ck -H 'Origin: http://localhost:3000' -H 'Host: localhost:3000' -F file=@fixtures/sample-apartment-4b.json http://localhost:3000/api/sessions/<id>/upload
```

Expect `formatDetected: "kudos_v1"` and six members. A second terminal without the cookie gets 404 on GET.

---

### Problem 6: Upload to awards preview UI

**Why now:** The API works. This problem is the wow loop through preview, still without video spend.

**Agents (parallel after the app shell):**

| Agent | Pages |
|-------|--------|
| Marketing | `app/page.tsx`, `app/export/page.tsx`, `app/export/telegram/page.tsx`, `app/export/messenger/page.tsx`, `app/export/discord/page.tsx` |
| Setup | `app/session/[id]/upload/page.tsx`, `app/session/[id]/setup/page.tsx` |
| Preview | `app/session/[id]/preview/page.tsx`, `components/award-card.tsx` |

Parent first adds `components/site-header.tsx`, the roast dial component, and a typed `lib/api.ts` client. Client calls same-origin `/api` with `credentials: "include"`.

**Consumes:** problem 5 endpoints.

UI requirements from `docs/02-user-flows.md`:

- Landing CTA “Upload JSON” starts `POST /api/sessions` and routes to `/session/[id]/upload`. Secondary link “How do I get JSON?” goes to `/export`.
- Export hub states Telegram Desktop JSON `result.json`, Messenger single `message_1.json`, DiscordChatExporter JSON, and “Kudos AI doesn’t connect to Discord.”
- Upload page: file input `accept="application/json,.json"`. Client warns above 25 MB and still lets the server decide. Show server `code` messages verbatim from the doc’s error table.
- Setup: roast dial default medium; member list with message counts; editable display name; exclude toggle; merge control (select two, confirm); consent checkbox with the two sentences from doc 02. Block continue until consent is checked and at least 2 members remain.
- Preview: grid of award cards (title, winner, one receipt, one line). Button “Regenerate” calls analyze with `regenerate: true` and disables after the API returns `RATE_LIMITED`. Button “Generate ceremony” is visible and disabled with copy “Ceremony rendering arrives in the next build.” Do not call a ceremony endpoint.
- Progress copy while analyze runs: “Reading your chaos…”, then “Deliberating with the judges…”.
- Mobile width 390 and desktop 1280 both usable: one column on small screens, cards wrap.

- [ ] **Step 1: Client helpers and shell**
- [ ] **Step 2: Parallel pages**
- [ ] **Step 3: Verify in the browser**

Run `pnpm --filter @kudos/web dev`. Walk landing → sample file → medium roast → consent → preview. Confirm an award card names a winner from the sample. Confirm regenerate updates the page. Confirm a file containing `<script` shows the safety error and no card.

- [ ] **Step 4: Stagger commits, then stop**

```bash
git add apps/web/app/page.tsx apps/web/app/export apps/web/components/site-header.tsx
git commit -m "add landing and export guides"

git add apps/web/app/session apps/web/lib/api.ts apps/web/components/roast-dial.tsx
git commit -m "add upload mapping and roast setup"

git add apps/web/components/award-card.tsx
git commit -m "preview awards before the ceremony"
```

**Security gate:** View source / DOM of the preview page and confirm message text is rendered as text nodes (React text), not `dangerouslySetInnerHTML`. Grep `apps/web` for `dangerouslySetInnerHTML`. Expected: no matches. Cookie is not read from JavaScript (`document.cookie` must not appear).

**User test:** Use the sample on `http://localhost:3000`. Also try an export-guide page and the malicious fixture (expect the safety message). Check a 390px-wide window: no horizontal scroll on the preview grid.

---

### Problem 7: Share page, consent, and retention

**Why now:** Preview is private to the owner cookie. Publishing and deletion are a separate trust boundary.

**Agents (parallel):**

| Agent | Owns |
|-------|------|
| Share | `app/s/[slug]/page.tsx`, `GET /api/s/:slug`, OG metadata |
| Retention | delete-on-parse timestamp job, `expires_at` sweep, quote toggle |

**Consumes:** session rows and awards. No ceremony video yet. Share page shows awards and the line “The stage lights are next.”

**Produces:**

- `GET /api/s/:slug` returns `groupTitle`, awards without `exemplarQuote`, `watermark: "Kudos AI"`, `videoUrl: null`. Unknown slug → 404.
- HTML page sets `<meta name="robots" content="noindex, nofollow">`.
- Owner PATCH `{ "publishQuotes": true }` is stored, but the public API still omits quotes until a later explicit flag `quotesPublic: true`. Default both false. This problem’s public API **always omits quotes**. The toggle can exist in the owner UI as off and disabled with helper text “Quotes stay off on the public link.”
- `sessions.raw_deleted_at` set at the end of upload because raw bytes were never stored. A test asserts the upload response path did not create a file under `.data/uploads`.
- `POST /api/sessions/:id/publish` requires consent and sets status to stay `preview` (video-less publish). Share URL `/s/{slug}`.
- Sweep function `deleteExpiredSessions(now)` removes sessions whose `expiresAt` is past and their `.data/sessions/:id` directory. Test with a session expired yesterday.

Share page escapes all names and lines as text. Report control is a button that POSTs `/api/s/:slug/report` with `{ reason: string }` max 500 chars, rate limited 5 / hour / IP, storing only slug, reason, and time. It does not email anyone yet.

- [ ] **Step 1: Tests for public DTO, noindex, report limit, expiry delete**
- [ ] **Step 2: Implement**
- [ ] **Step 3: Verify**

Browser: from preview, publish, open the share URL in a private window (no cookie). Awards visible, quotes absent, video absent.

- [ ] **Step 4: Stagger commits, then stop**

```bash
git add apps/web/app/s apps/web/app/api/s
git commit -m "add unlisted awards share page"

git add apps/web/src/retention apps/web/app/api/sessions
git commit -m "expire sessions and keep quotes off the public link"
```

**Security gate:** Public JSON fixture test fails if any key named `exemplarQuote`, `text`, or `messages` is present. Report route is rate limited. Share route does not check the owner cookie and does not accept the session uuid.

**User test:** Publish the sample session. Open `http://localhost:3000/s/<slug>` in a private window. View page source and find `noindex`. `curl` the public API and confirm quotes are absent.

---

### Problem 8: Ceremony worker

**Why now:** Share already works if video fails. This problem spends Magic Hour credits, so it is isolated, capped, and fallback-first.

**Agents:**

1. Job-state agent first: Redis in `docker-compose.yml`, `apps/worker`, BullMQ queue `ceremony`, tables `ceremonies` and `ceremony_jobs`, state machine `pending → tts_batch → mh_clips_running → concatenating → uploading → complete | failed`.
2. Then parallel:

| Agent | Owns |
|-------|------|
| Script | `apps/worker/src/script.ts` beat sheet from `AwardResult[]` |
| Magic Hour | `apps/worker/src/magic-hour.ts` create/poll client |
| FFmpeg | `apps/worker/src/concat.ts` and slideshow fallback |
| Webhook security | `apps/web/app/api/webhooks/magic-hour/route.ts` |

**Consumes:** awards, avatars on `ObjectStore`, `MAGIC_HOUR_API_KEY`, `MAGIC_HOUR_WEBHOOK_SECRET`.

**Produces:**

```typescript
export type CeremonyStatus =
  | "pending" | "tts_batch" | "mh_clips_running" | "concatenating"
  | "uploading" | "complete" | "failed";

export function buildScript(input: {
  groupTitle: string;
  roastLevel: RoastLevel;
  awards: AwardResult[];
  members: { id: string; displayName: string }[];
}): { lines: { id: string; text: string; memberId?: string }[]; headlineAwardIds: AwardId[] };
```

Headline six, skipping any missing award: `most_messages`, `funniest`, `least_messages`, `late_night_texter`, `drama_starter`, `heart_of_group`. Remaining awards become one speed-round line.

`POST /api/sessions/:id/ceremony` (owner cookie, consent required, analysis present): 3 / day / IP, returns `202` `{ ceremonyId, status: "rendering" }`. Enqueues BullMQ. Idempotent if a ceremony is `pending` or running.

`GET /api/sessions/:id/status` owner-only: `{ status, progress, stage }`. Progress is `jobsComplete / jobsTotal`.

Webhook `POST /api/webhooks/magic-hour`:

- Read raw body.
- Verify HMAC SHA-256 hex signature header `x-magic-hour-signature` against `MAGIC_HOUR_WEBHOOK_SECRET`. Missing secret in production → 503 and do not process. In test, set the secret.
- Constant-time compare.
- Unknown project id → 200 with no write (do not create rows from a webhook).
- On complete, worker copies bytes into `ObjectStore` key `sessions/:id/final.mp4`. Do not persist the Magic Hour download URL as the user-facing URL.
- User-facing URL is `GET /api/sessions/:id/video` (owner) or `GET /api/s/:slug/video` (public), which streams from `ObjectStore` after checking publish state.

Fallback: if Magic Hour returns `insufficient_credits`, or two clip retries fail, or the job exceeds 15 minutes, render a slideshow MP4 with ffmpeg (one still per award, Ken Burns optional, end card “Made with Kudos AI”) and set `fallbackUsed: true`. Tests run the slideshow path with a fake Magic Hour client that always fails. ffmpeg must exist in CI or the test skips only when `ffmpeg` is absent and `CI` is unset; in CI the image/docs must install ffmpeg.

TTS and video prompts pass `blocklist.ts` before send. A blocked line is replaced with the gentle template. Prompts for text-to-video are the fixed strings from doc 04 (no member names in the image prompt).

Avatar upload (this problem, small, security-relevant): `POST /api/sessions/:id/members/:memberId/avatar` owner-only, JPEG/PNG, max 2 MB, sniffed magic bytes not the client content-type alone. Stored at `sessions/:id/avatars/:memberId`. Reject SVG. No remote URL field.

Concurrency caps inside the worker: TTS 10, Magic Hour video 3, concat 1 per ceremony.

- [ ] **Step 1: State machine and queue tests with fake providers**
- [ ] **Step 2: Parallel script, client, ffmpeg, webhook**
- [ ] **Step 3: Verify**

`pnpm --filter @kudos/worker test` and webhook tests in web. Slideshow test writes an MP4 under a temp dir and asserts non-zero size. Signature test: flipped bit in the HMAC → 401 and no status change.

- [ ] **Step 4: Stagger commits, then stop**

```bash
git add docker-compose.yml apps/worker/src/queue.ts apps/web/drizzle
git commit -m "queue ceremony jobs"

git add apps/worker/src/script.ts apps/worker/src/script.test.ts
git commit -m "build the ceremony script from awards"

git add apps/worker/src/magic-hour.ts apps/worker/src/concat.ts
git commit -m "render ceremony clips or a slideshow fallback"

git add apps/web/app/api/webhooks apps/web/app/api/sessions/[id]/ceremony
git commit -m "accept signed magic hour webhooks"
```

**Security gate:**

- Webhook test rejects a bad signature.
- Worker never `fetch`es a URL that came from the chat JSON. Avatar fetch URLs, if any, are built only from `ObjectStore` keys.
- `MAGIC_HOUR_API_KEY` is not logged.
- Ceremony route is rate limited and cookie-gated.
- SVG and non-image bytes are rejected.
- `pnpm secrets:scan` clean.

**User test:** With Docker Postgres and Redis up, `pnpm --filter @kudos/web dev` and `pnpm --filter @kudos/worker dev`. Start a ceremony with the fake provider env `CEREMONY_PROVIDER=fallback` (no Magic Hour spend). Poll status until `complete`. `curl -I` the video route and expect `200` and `video/mp4`. A bad webhook signature returns 401. UI button may still be the disabled one from problem 6; API is the test surface until problem 9. App URL: `http://localhost:3000`.

---

### Problem 9: Ceremony UI and delivery

**Why now:** The worker can finish a video. This problem only wires the button, progress, and player.

**Agents:** one UI agent. The surface is a single session flow; splitting pages would fight over `preview/page.tsx`.

**Files:**
- Modify: `app/session/[id]/preview/page.tsx`, `app/s/[slug]/page.tsx`
- Create: `components/ceremony-player.tsx`, `app/session/[id]/ceremony/page.tsx`

**Consumes:** `POST /api/sessions/:id/ceremony`, `GET /api/sessions/:id/status`, video routes.

Behavior:

- “Generate ceremony” calls the endpoint and routes to `/session/[id]/ceremony`.
- Page polls status every 3s. Copy: “Rolling the red carpet…” plus the stage name.
- On `complete`, show a 9:16 `<video controls>` whose `src` is the owner video route. Buttons: “Download MP4” (`download` attribute), “Copy link” (clipboard of the absolute `/s/{slug}` URL).
- If `fallbackUsed`, show “The stage lights glitched—we still have your kudos.”
- Public share page shows the same player when `videoUrl` is the public video route, otherwise the awards list alone.
- Suggested share sentence from doc 02, with the winner of `funniest` interpolated, rendered as text.

- [ ] **Step 1: Browser pass with `CEREMONY_PROVIDER=fallback`**
- [ ] **Step 2: Stagger commit, then stop**

```bash
git add apps/web/app/session apps/web/app/s apps/web/components/ceremony-player.tsx
git commit -m "play and share the ceremony video"
```

**Security gate:** Player `src` is a same-origin path. Grep the new component for `http://` and `https://` user-controlled URLs. Expected: none. Copy-link copies the slug URL only.

**User test:** From preview, generate, wait, play, download, copy link, open the link in a private window, confirm the video or the fallback message. `http://localhost:3000`.

---

### Problem 10: Launch hardening

**Why last:** It audits the finished surface. It does not add product scope.

**Agents (parallel):**

| Agent | Owns |
|-------|------|
| Security | threat tests, header review, dependency audit, secret scan in CI |
| Copy | `app/privacy/page.tsx`, `app/terms/page.tsx`, in-app 16+ line, consent text review against doc 06 |

Security work:

- Add `middleware.ts` security headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, a Content-Security-Policy that allows self scripts and same-origin media only.
- Confirm every route in `app/api` is in a table in `apps/web/src/security/routes.md` with auth and rate limit. The test reads the route filesystem and fails if a `route.ts` is missing from the table or if the table marks a public route that still returns awards for a session uuid.
- `pnpm audit --prod` recorded in the test output. Fail the problem on critical advisories that have a fix.
- Log redaction test: passing a payload with `text` and `authorization` through `logEvent` yields neither.
- IDOR script: create two sessions, cross cookies, expect 404.
- Upload bomb tests from problem 1 still pass through the HTTP route, not only the unit parser.
- GitHub Actions workflow `.github/workflows/ci.yml`: `pnpm test`, `pnpm typecheck`, `pnpm secrets:scan` on pull requests. No secrets in the workflow file.

Copy work:

- Privacy page states: raw file not kept, 30-day session, 7-day video, Jev and Magic Hour receive compact text and avatars, no sale of data, contact for deletion is delete-in-product plus a `mailto:` placeholder `privacy@kudos.ai` only as displayed text (no mailbox integration).
- Terms: user must have permission to upload, 16+, no official chat-app affiliation.
- Footer link from landing and share page.

- [ ] **Step 1: Route inventory test and headers test**
- [ ] **Step 2: Privacy and terms pages**
- [ ] **Step 3: Verify**

`pnpm test && pnpm typecheck && pnpm secrets:scan`. Browser: landing footer opens privacy. Response headers on `/` include `nosniff` and `no-referrer`.

- [ ] **Step 4: Stagger commits, then stop**

```bash
git add apps/web/src/security .github/workflows/ci.yml apps/web/middleware.ts
git commit -m "lock down headers secrets and route auth"

git add apps/web/app/privacy apps/web/app/terms apps/web/components/site-header.tsx
git commit -m "add privacy and terms for the demo"
```

Do not push.

**Security gate:** This problem is the gate. All items above are green.

**User test:** Re-run the sample flow once. Confirm privacy page, `noindex` on a share URL, 404 on a foreign session id, and a malicious JSON upload error. Dev server: `http://localhost:3000`.

---

## Spec coverage

| Spec | Problem |
|------|---------|
| JSON-only upload, 50 MB, malicious JSON | 1, 5 |
| Telegram, Messenger, Discord, Kudos v1 | 2 |
| Feature store, 18 awards, receipts | 3, 4 |
| Jev pinned model, compact state, no prose | 4 |
| Roast dial, max 4 awards, template copy | 4, 6 |
| Session API and entities | 5 |
| Cookie auth, rate limits, CSRF origin check | 5, 8, 10 |
| Landing, export guides, mapping, consent | 6 |
| Preview and regenerate cap | 5, 6 |
| Unlisted share, noindex, quotes hidden | 7 |
| Raw JSON not retained, TTL | 5, 7 |
| Avatars, user-upload only | 8 |
| Magic Hour, webhook signature, ffmpeg, fallback | 8 |
| Player, download, copy link, watermark | 8, 9 |
| Report button | 7 |
| Privacy copy, 16+, secret scanning | 0, 10 |
| Payments, accounts, WhatsApp, multi-file Messenger | Out of scope |

## Self-review

- No task depends on a type that an earlier problem does not produce. `mediaHint` and `replyEdges` are introduced in the problem that first needs them.
- Public share never returns exemplars. Owner GET may return one receipt string already rendered by the template engine.
- Ceremony spend cannot happen before problem 8, and problem 8 defaults the local test path to the slideshow so a reviewer does not need Magic Hour credits.
