# Project Progress

**App**: Pinch A Penny #144 — Auto Debit Parser  
**URL**: https://pinch-a-penny-auto-debit.vercel.app  
**Current commit**: `e3aacdf2`  
**Last updated**: 2026-06-20

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
- [x] Multi-PDF carry-forward chains are resolved oldest-to-newest (example: `6/04/26 → 6/08/26 → 6/11/26 → 6/15/26`)
- [x] Report date matching normalizes leading-zero differences (`6/8/26` matches `6/08/26`)

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
- [x] Positive PDFs absorb the full negative-report chain, not just the immediate prerequisite
- [x] Negative PDFs never generate their own JE — absorbed into the positive PDF's JE
- [x] `GET /api/qbo/preview/[id]` — builds JE payload, persists to `qbo_pushes`
  - Carry-forward (RU) rows excluded; replaced by actual prerequisite-chain lines
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
- [x] Upload PDFs → assign accounts via mappings → preview JE → confirm balanced
  - Production preview for upload `87d5e65e-ff63-4632-b520-e56910cd6d24` generated 33 JE lines
  - Prior chain included: `6/04/26`, `6/08/26`, `6/11/26`
  - Debits: `$33,601.65`; Credits: `$33,601.65`; Difference: `$0.00`
  - Carry-forward placeholder lines included: `0`
- [x] Push to QBO sandbox
  - QBO Transaction ID: `145`
  - Intuit TID: `1-6a36d711-0db4d72f5f46f29a27ec75e1`
  - Environment: `sandbox`
  - AP Vendor created/used in sandbox: `Pinch A Penny #144` (`Vendor` ID `58`)
- [x] Verify transaction appears in QBO sandbox company
  - Fetched JE `145` back from QBO sandbox successfully
  - Debits: `$33,601.65`; Credits: `$33,601.65`; Difference: `$0.00`
  - Balancing AP line has Vendor entity `Pinch A Penny #144`
- [ ] Answer remaining Intuit compliance questions

### Deployment Handoff
- [ ] Deploy the local QBO proposal persistence fix
  - Run `vercel login`, then `vercel --prod --yes`; or fix `.git` ACL and push `master` if Vercel Git integration is preferred.
  - Changed files waiting locally include `app/api/qbo/preview/[id]/route.ts`, `app/api/qbo/push/[id]/route.ts`, `app/api/qbo/vendors/route.ts`, `lib/report-chain.ts`, `lib/report-dates.ts`, and related report/upload/settings UI/API updates.
  - Local fix written: preview now explicitly updates the latest existing `qbo_pushes` row or inserts one, and push reads the latest proposal via `maybeSingle()`.
  - Local AP vendor support written: Settings can save `ap_vendor`; preview attaches Vendor entity when the balancing account is Accounts Payable; push blocks AP pushes without a vendor.
  - Verification already run locally: `npx tsc --noEmit --types jest` passed; `npm test -- --runInBand` passed (27/27).
  - Still not deployed: Vercel CLI token is invalid / requires login, and Git commit/push is blocked by a Windows ACL deny on `.git` preventing creation of `.git/index.lock`.

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
