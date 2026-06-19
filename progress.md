# Project Progress

**App**: Pinch A Penny #144 — Auto Debit Parser  
**URL**: https://pinch-a-penny-auto-debit.vercel.app  
**Current version**: v1.0.3 (commit `2b1cb57`)  
**Last updated**: 2026-06-19

---

## Completed

### Infrastructure
- [x] Next.js 16 App Router + TypeScript + Tailwind CSS v4
- [x] Supabase project connected (CamtheChamp's Project, `qonhadvvgfegdituotbw`)
- [x] Full DB schema applied (8 tables, RLS disabled on all)
- [x] Deployed to Vercel production
- [x] Version number displayed in navbar (`NEXT_PUBLIC_APP_VERSION`)

### PDF Parsing
- [x] `lib/pdf-extract.ts` — PDF text extraction via `unpdf` (serverless-safe)
- [x] `lib/parser.ts` — Full token-based parser with 27/27 tests passing
  - 2-amount rows (RM/RU/RI) vs 3-amount rows (SO/SR) correctly distinguished
  - Trailing-minus negatives (`2,229.98-` → `-2229.98`)
  - `0/00/00` and blank values → `null`
  - Carry-forward prerequisite date extraction from RU remarks
- [x] Upload API (`POST /api/upload`) — extract → parse → insert all records → resolve waiting prerequisites
- [x] Reports list page (`/reports`)
- [x] Report detail page (`/reports/[id]`) — editable line items, prerequisite banner, validation status

### Prerequisite Enforcement
- [x] RU rows with "unapplied D.D. M-D-YY" require the referenced PDF to be uploaded first
- [x] Upload blocked from JE approval if prerequisite not met (red banner)
- [x] Retroactive resolution — uploading an older PDF automatically unlocks waiting reports

### QBO Journal Entry Preview
- [x] `POST /api/qbo/preview/[id]` — builds JE payload (debit positive, credit negative, balancing line)
- [x] Blocks if prerequisite not met or validation fails
- [x] Persists proposed payload to `qbo_pushes` table

### QBO OAuth 2.0
- [x] `/api/qbo/connect` — initiates OAuth with CSRF state cookie
- [x] `/api/qbo/callback` — validates CSRF, exchanges code for tokens, stores in DB
- [x] `/api/qbo/status` — returns current connection status
- [x] `/api/qbo/disconnect` — removes connection
- [x] `lib/qbo-auth.ts` — `getValidAccessToken()` with automatic token refresh
- [x] Settings page (`/settings`) — shows connection status, connect/reconnect/disconnect buttons

### Compliance Pages
- [x] `/eula` — End-User License Agreement (for Intuit Developer Portal)
- [x] `/privacy` — Privacy Policy (for Intuit Developer Portal)

### Intuit Developer Portal Progress
- [x] App created at developer.intuit.com
- [x] Email verified
- [x] EULA + Privacy Policy URLs submitted
- [x] Host domain + Launch/Disconnect/Connect URLs submitted
- [x] App details questionnaire answered
- [ ] Authorization & Authentication compliance questions — **in progress**
  - Need sandbox test to answer Q1 honestly
- [ ] API Usage section — not started
- [ ] Error Handling section — not started
- [ ] Security section — not started

---

## In Progress

### Sandbox OAuth Test
- Env vars (`QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`, `QBO_ENVIRONMENT`, `NEXT_PUBLIC_APP_URL`) not yet set on Vercel — waiting for Intuit sandbox credentials from developer portal
- Once set: test connect → disconnect → reconnect flow, then answer compliance Q1 "Yes"

---

## Not Started / TODO

### QBO Push (actual submission)
- [ ] `POST /api/qbo/push/[id]` — submit JE to QBO using `getValidAccessToken()`
- [ ] Sandbox guard — must check `environment === 'sandbox'` before allowing push
- [ ] "Push to QBO Sandbox" button on report review page
- [ ] Display QBO transaction ID / response after successful push
- [ ] End-to-end sandbox test with a real PDF upload → JE push

### Production QBO
- [ ] Enable production flag — only after sandbox test is verified with bookkeeper
- [ ] Intuit production credentials (separate from sandbox keys)
- [ ] Token encryption at rest (currently stored plaintext in Supabase)

### Account Mappings
- [ ] Mappings UI (`/mappings`) — currently scaffolded but incomplete
- [ ] Fill in actual QBO account IDs for each mapping rule once sandbox is connected
- [ ] Map ADV/FF, RI, SO, SR rows to correct QBO accounts

### Audit Log
- [ ] Audit log page (`/audit`) — route exists, UI not built

### Nice-to-Have
- [ ] Token refresh test (verify auto-refresh works after 1-hour expiry)
- [ ] Email/notification on push failure
- [ ] Bulk upload — currently sequential, could parallelize

---

## Known Issues / Decisions

| Issue | Resolution |
|-------|-----------|
| pdfjs-dist v6 crashes serverless | Switched to `unpdf` |
| pdf-parse@1 reads test files at init | Switched to `unpdf` |
| Supabase RLS blocks anon inserts | RLS disabled on all tables |
| Vercel dynamic IPs (no static IP) | Using Vercel edge IPs for Intuit compliance form; revisit for prod |
| `NEXT_PUBLIC_APP_VERSION` must be manually bumped | Document in CLAUDE.md — update before each prod deploy |

---

## Environment Variables (Vercel Production)

| Variable | Status | Value |
|----------|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ set | CamtheChamp's Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ set | CamtheChamp's anon key |
| `NEXT_PUBLIC_APP_VERSION` | ✅ set | `1.0.3-e93abf14` |
| `NEXT_PUBLIC_APP_URL` | ❌ not set | needs `https://pinch-a-penny-auto-debit.vercel.app` |
| `QBO_CLIENT_ID` | ❌ not set | waiting for Intuit sandbox credentials |
| `QBO_CLIENT_SECRET` | ❌ not set | waiting for Intuit sandbox credentials |
| `QBO_REDIRECT_URI` | ❌ not set | `https://pinch-a-penny-auto-debit.vercel.app/api/qbo/callback` |
| `QBO_ENVIRONMENT` | ❌ not set | `sandbox` |
