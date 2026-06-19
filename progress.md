# Project Progress

**App**: Pinch A Penny #144 — Auto Debit Parser  
**URL**: https://pinch-a-penny-auto-debit.vercel.app  
**Current commit**: `b9bd9e18`  
**Last updated**: 2026-06-19

---

## Completed

### Infrastructure
- [x] Next.js 16 App Router + TypeScript + Tailwind CSS v4
- [x] Supabase project connected (CamtheChamp's Project, `qonhadvvgfegdituotbw`)
- [x] Full DB schema applied — 9 tables, RLS disabled on all
- [x] Deployed to Vercel production
- [x] Version number displayed in navbar (`NEXT_PUBLIC_APP_VERSION`)

### PDF Parsing
- [x] `lib/pdf-extract.ts` — PDF text extraction via `unpdf` (serverless-safe)
- [x] `lib/parser.ts` — Full token-based parser with 27/27 tests passing
  - 2-amount rows (RM/RU/RI) vs 3-amount rows (SO/SR) correctly distinguished
  - Trailing-minus negatives (`2,229.98-` → `-2229.98`)
  - `0/00/00` and blank values → `null`
  - Carry-forward prerequisite date extraction from RU remarks
- [x] Duplicate upload detection — blocks re-upload of same report number + run date, links to existing
- [x] Upload API (`POST /api/upload`) — extract → parse → deduplicate → insert all records → resolve waiting prerequisites
- [x] Reports list page (`/reports`) — shows net amount due, open amount, validation badge, status
- [x] Report detail page (`/reports/[id]`) — editable line items, prerequisite banner, validation status

### Prerequisite Enforcement
- [x] RU rows with "unapplied D.D. M-D-YY" require the referenced PDF to be uploaded first
- [x] Upload blocked from JE approval if prerequisite not met (red banner)
- [x] Retroactive resolution — uploading an older PDF automatically unlocks waiting reports

### Accounting Mappings
- [x] Mappings page (`/mappings`) — full CRUD with QBO account picker (live fetch from QBO)
- [x] `accounting_mappings` table — match by field/type/value, priority ordering
- [x] Auto-assignment on upload — `findMapping()` sets account + treatment on every new line item
- [x] Treatment simplified to 3 values: `include`, `carry_forward`, `ignore`
  - Debit/Credit direction is sign-driven (positive net → Debit, negative → Credit)
  - Carry-forward rows auto-assigned `carry_forward` on upload, shown as static label (no picker)

### QBO OAuth 2.0
- [x] `/api/qbo/connect` — initiates OAuth with CSRF state cookie
- [x] `/api/qbo/callback` — validates CSRF, exchanges code for tokens, stores in DB
- [x] `/api/qbo/status` — returns current connection status
- [x] `/api/qbo/disconnect` — removes connection
- [x] `lib/qbo-auth.ts` — `getValidAccessToken()` with automatic token refresh
- [x] Settings page (`/settings`) — connection status, connect/reconnect/disconnect buttons
- [x] QBO connected and tested with sandbox credentials

### QBO Journal Entry
- [x] Single JE per bank charge — positive PDFs absorb their prerequisite (negative) PDF's lines
- [x] Negative PDFs never generate their own JE — absorbed into the positive PDF's JE
- [x] `GET /api/qbo/preview/[id]` — builds JE payload, persists to `qbo_pushes`
  - Carry-forward (RU) row excluded; replaced by actual prerequisite lines
  - Lines from prior report tinted purple in preview, balancing line tinted blue
  - Description = remarks from PDF row
  - Balancing line auto-fills with saved Bank / AP account
- [x] QBO-style JE preview table (Account, Debits, Credits, Description, totals footer with balance check)
- [x] `POST /api/qbo/push/[id]` — submits JE to QBO sandbox
  - Blocks if any included row missing QBO account
  - Captures `intuit_tid` from response headers
  - Updates `qbo_pushes` status + `qbo_transaction_id`
  - Logs to `audit_logs`
- [x] Push button on report page with sandbox confirmation dialog
- [x] Push result banner (QBO Transaction ID + intuit_tid)

### Account Picker
- [x] `app/components/AccountPicker.tsx` — searchable dropdown, live QBO account fetch
- [x] Used on report detail page (per-line account assignment)
- [x] Used on mappings page (per-rule account assignment)
- [x] Used on settings page (Bank / AP account for balancing line)

### App Settings
- [x] `app_settings` table — key/value store for global config
- [x] Bank / AP Account setting — saved once in Settings, auto-applied to JE balancing line
- [x] `/api/settings` GET + PUT

### Compliance Pages
- [x] `/eula` — End-User License Agreement (for Intuit Developer Portal)
- [x] `/privacy` — Privacy Policy (for Intuit Developer Portal)

### Intuit Developer Portal
- [x] App created, email verified
- [x] EULA + Privacy Policy URLs submitted
- [x] Host domain + redirect URLs submitted
- [x] App details questionnaire answered
- [ ] Authorization & Authentication compliance — in progress (needs sandbox push test to answer Q1)
- [ ] Error Handling section — not started
- [ ] Security section — not started

---

## In Progress / TODO

### Sandbox End-to-End Test
- [ ] Upload PDFs → assign accounts via mappings → preview JE → confirm balanced → push to sandbox
- [ ] Verify transaction appears in QBO sandbox company
- [ ] Answer remaining Intuit compliance questions

### Production QBO
- [ ] Enable production flag — only after bookkeeper verifies sandbox test
- [ ] Intuit production credentials (separate from sandbox keys)
- [ ] Token encryption at rest (currently stored plaintext in Supabase)

### Audit Log Page
- [ ] `/audit` route exists; UI not built yet

### Nice-to-Have
- [ ] Token refresh test (verify auto-refresh works after 1-hour expiry)
- [ ] Email/notification on push failure
- [ ] Bulk upload parallelization

---

## Database Schema (9 tables)

| Table | Purpose |
|-------|---------|
| `pdf_uploads` | One row per uploaded PDF; prerequisite linkage, status |
| `report_headers` | Header fields (report number, run_date, customer name) |
| `line_items` | One row per parsed line; treatment, QBO account, memo |
| `customer_totals` | Footer totals + validation flags |
| `accounting_mappings` | Auto-assign rules (match field/type/value → treatment + account) |
| `qbo_connections` | OAuth tokens (realm_id, access/refresh tokens, expiry) |
| `qbo_pushes` | Proposed and submitted JE payloads with QBO response |
| `audit_logs` | Event log (upload, push, error) |
| `app_settings` | Global key/value config (e.g. bank_account) |

---

## Environment Variables (Vercel Production)

| Variable | Status |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ set |
| `NEXT_PUBLIC_APP_VERSION` | ✅ set |
| `NEXT_PUBLIC_APP_URL` | ✅ set |
| `QBO_CLIENT_ID` | ✅ set (sandbox) |
| `QBO_CLIENT_SECRET` | ✅ set (sandbox) |
| `QBO_REDIRECT_URI` | ✅ set |
| `QBO_ENVIRONMENT` | ✅ set (`sandbox`) |
