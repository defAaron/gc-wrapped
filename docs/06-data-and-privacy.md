# 06 — Data & privacy

**Kudos AI** processes **other people’s messages** and optionally **their likeness**. This doc is opinionated for the demo MVP; **not legal advice**—counsel before public launch.

---

## Core commitments (demo)

| Commitment | Implementation |
|------------|----------------|
| **Delete raw JSON fast** | Raw upload bytes deleted within **15 minutes** of successful parse (or on failure within **1 hour**) |
| **Minimize retention** | Store normalized stats + award results, not full message archive |
| **No training on your chat** | TypeSafe: no training on Input ([Privacy Policy](https://typesafe.ai/legal/privacy-policy)); Magic Hour: per their terms |
| **User controls sharing** | Unlisted slug; uploader consent checkbox |
| **Free demo** | No selling data; no ad targeting from chat content |

---

## Consent model

### Roles

| Role | Description |
|------|-------------|
| **Uploader** | Person who uploads JSON |
| **Subject** | Anyone named in messages or awards |
| **Viewer** | Anyone with share link |

### Demo MVP (pragmatic)

1. **Uploader attestation** (required): they have permission to analyze and share, or removed non-consenting members ([02](./02-user-flows.md)).
2. **No per-subject opt-in** before analysis at demo—**risk accepted** for friends-and-family demo with counsel review before scale.
3. **Before public link:** uploader confirms again on “Publish ceremony.”
4. **v2:** opt-out URL in share page footer; DSR email.

### Non-consenting members

| Situation | Product behavior |
|-----------|------------------|
| Excluded in mapping | Not in awards/video |
| Request removal post-publish | Manual support + slug revoke (demo) |
| Minor in chat | **Block ceremony publish** if detected age signals in export metadata (weak); uploader must exclude minors |

---

## What we store

| Data | Stored? | TTL (demo) |
|------|---------|------------|
| Raw uploaded JSON | **No** (transient disk during parse only) | ≤15 min |
| Normalized messages (full text) | **No** at MVP | — |
| Per-member aggregates + exemplars (≤5 quotes/member) | **Yes** | Session TTL **30 days** |
| Award results + receipts | **Yes** | 30 days |
| Avatars (user upload) | **Yes** | 30 days |
| Final MP4 | **Yes** | 7 days |
| IP + user-agent (rate limits) | **Yes** | 90 days |
| Jev request/response bodies | **No** in logs; token counts only | — |

**Exemplar quotes** on share page: optional toggle “hide message quotes” (default **on** for demo privacy).

---

## What we send to third parties

### TypeSafe (Jev)

| Field | Sent |
|-------|------|
| Compact `state` JSON (stats + truncated exemplars) | Yes |
| Full chat log | **No** |
| PII | Display names only; no phone numbers if stripped in normalize |

**Policies:**

- No training on Input (TypeSafe Privacy Policy).
- **Telemetry** may still be derived per MCA—assume metadata processing until enterprise **ZDR** ([sales@typesafe.ai](mailto:sales@typesafe.ai)).
- **Production:** `api.typesafe.ai` with BAA/DPA if we ever handle regulated data (not demo scope).

### Magic Hour

| Field | Sent |
|-------|------|
| TTS text (award lines) | Yes |
| Avatar images (URLs) | Yes |
| Prompts for text-to-video | Yes (no PII in prompts) |

Download URLs from MH are ephemeral; we re-host on our bucket.

---

## Security of uploads

See [02](./02-user-flows.md#upload-validation--security). Additional notes:

- **Malicious JSON** is an availability/integrity risk, not RCE, if we never `eval` and run parsers in isolated workers.
- **XSS:** sanitize before any HTML render on share page.
- **SSRF:** avatar URLs must be our bucket only, not user-supplied remote URLs in JSON.

---

## Content moderation

| Stage | Action |
|-------|--------|
| Ingest | Strip scripts; block obvious malware patterns |
| Analysis | Crisis keyword gate suppresses roasts |
| Share | Report button; manual hide |
| Video | Provider safety + our prompt templates |

**Prohibited:** sexual content involving minors, hate, threats—**terminate session** and do not publish.

---

## Minors

- Product is **16+** positioning (honor system).
- Do not market to children.
- If group is clearly school-aged from names/context, show warning; counsel for COPPA if US under-13 data possible.

---

## Legal considerations (checklist)

| Area | Note |
|------|------|
| **GDPR** (EU subjects) | Lawful basis likely **legitimate interest** or **consent**—weak for group chats; **consent + exclusion** safer. DSR: delete session by id. |
| **CCPA** | Privacy policy + do not sell; limit retention. |
| **Platform ToS** | Discord/third-party exports: user responsibility; we don’t scrape. |
| **Copyright** | Messages are user-generated; quotes in awards may be fair use/de minimis—minimize verbatim quotes on public page. |
| **Likeness** | Talking-photo = **biometric-adjacent**; require uploader-uploaded avatars with permission; no scraping. |
| **Defamation** | Roast tone guidelines; no factual crime accusations. |

---

## Data Processing Agreement (future)

Before B2B or paid launch: DPA with TypeSafe and Magic Hour; subprocessors list; EU SCCs if needed.

---

## Incident response (demo)

1. Revoke slug.
2. Delete session row + R2 objects.
3. Rotate API keys if leak suspected.
4. Notify users if breach affects stored avatars/awards.

---

## Assumptions & open questions

| # | Item |
|---|------|
| 1 | **Assumption:** 30-day session TTL acceptable for demo. |
| 2 | **Assumption:** Storing 5 exemplar strings/member is necessary for receipts—could hash-only in stricter mode. |
| 3 | **Open:** Legal review before Product Hunt / paid ads. |
| 4 | **Open:** Enterprise ZDR with TypeSafe before processing sensitive corporate chats. |
