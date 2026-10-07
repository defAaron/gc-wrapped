# 08 — Roadmap & risks

Phased delivery, risks, and unit economics for **Kudos AI** (demo MVP → launch).

---

## Phased milestones

### Phase 0 — Docs & schema (current)

- [x] Product docs
- [ ] Kudos JSON v1 JSON Schema in repo
- [ ] Synthetic `sample-apartment-4b.json`

### Phase 1 — Parse & awards (weeks 1–2)

- JSON validator + adapters (Telegram, Messenger, Discord DCE, Kudos v1)
- Feature store + deterministic awards
- Jev integration (pinned model, roast dial)
- CLI or API-only preview (no video)

**Exit:** Upload → awards JSON in <90s for 30k msgs.

### Phase 2 — Web demo (weeks 2–3)

- Landing + upload + mapping + roast dial + preview UI
- Session storage + delete raw upload
- Share page (awards only)

**Exit:** Friend can run sample file end-to-end in browser.

### Phase 3 — Ceremony (weeks 3–5)

- Magic Hour TTS + talking photo + text-to-video
- ffmpeg concat worker + webhooks
- Fallback slideshow
- Rate limits

**Exit:** MP4 + link share in group chat.

### Phase 4 — Hardening (week 5+)

- Legal review, privacy policy, terms
- Report flow, `noindex`, monitoring
- Optional: Messenger multi-file merge, WhatsApp converter

---

## Open questions

| Topic | Question |
|-------|----------|
| Quotes on share page | Default hidden vs shown |
| Music | Licensed bed track or voice-only |
| Accounts | Anonymous sessions vs magic link save |
| Domains | `kudos.ai` vs staging |

---

## Technical risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Magic Hour cost spike on viral day | Med | High | IP caps, queue, 720p cap, slideshow fallback |
| Jev `max_tokens_exceeded` on large groups | Med | Med | Aggressive state compaction; map-reduce |
| ffmpeg worker ops burden | Med | Med | Managed container; health checks |
| Malicious JSON DoS | Med | Med | Limits, worker isolation, rate limits |
| Talking-photo likeness complaints | Low | High | User-upload avatars only; consent copy |
| Discord ToS narrative | Low | Med | User-export disclaimer |
| TypeSafe telemetry / retention concerns | Med | Med | Minimize state; enterprise ZDR later |

---

## Business / product risks

| Risk | Mitigation |
|------|------------|
| “Cruel roast” backlash | Tone guide + gentle default + report |
| Non-consenting friend published | Consent + exclude + delete |
| Free demo unsustainable | Rate limits; monetize post-validation |
| Trademark “Kudos” | Clear “Kudos AI” + trademark search |

---

## Unit economics (demo: free to user)

**Per successful ceremony** (6 talking photos + 2 TTV + TTS, order-of-magnitude):

| Cost item | Estimate USD |
|-----------|----------------|
| Jev (analysis) | $0.01–0.05 |
| Magic Hour credits | **$0.50–2.50** (plan-dependent; log actual `credits_charged`) |
| Infra (R2, Neon, worker minute) | $0.05–0.15 |
| **Total** | **~$0.60–2.70** |

**Demo budget assumption:** **$200/mo** infra + API ≈ **75–300 ceremonies/mo** before hard caps.

### Pricing options (post-demo, not active)

| Model | Price | Notes |
|-------|-------|-------|
| Free preview + $6.99 video | Matches earlier Wrapped pattern | |
| $4.99 one-shot | Simple | |
| Creator subscription | $14.99/mo | Unlimited with fair use |

---

## Success criteria for “demo done”

1. Sample JSON → awards preview without human help.
2. Real Telegram JSON → same.
3. Ceremony completes OR fallback within 15 min.
4. Raw upload deleted; privacy copy on site.
5. One real group chat shared back into chat (dogfood).

---

## Assumptions & open questions

| # | Item |
|---|------|
| 1 | **Confirmed:** No user pricing in demo; internal cost caps only. |
| 2 | **Assumption:** 3 ceremonies/day/IP is enough for demo abuse prevention. |
| 3 | **Open:** Fundraise / credits partnership with Magic Hour for launch burst. |
