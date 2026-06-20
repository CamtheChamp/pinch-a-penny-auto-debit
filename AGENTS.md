# PennyWise Ledger — AGENTS.md

Internal tool for Pinch A Penny Pool Patio & Spa Store #144.
Parses "R03989 Preauthorized Debit" PDF reports and prepares QuickBooks Online Journal Entries.

---

## Stack

- **Framework**: Next.js 16 (App Router), TypeScript, React 19
- **Styling**: Tailwind CSS v4 — use `@import "tailwindcss"` in globals.css, `@tailwindcss/postcss` in postcss.config.mjs. Never use the old `tailwindcss` PostCSS plugin.
- **Database**: Supabase (Postgres) — project "CamtheChamp's Project" (`qonhadvvgfegdituotbw`), region us-west-2
- **ORM**: `@supabase/supabase-js` via lazy proxy client in `lib/db.ts`
- **PDF extraction**: `unpdf` (serverless-safe pdfjs wrapper — NOT pdf-parse, NOT pdfjs-dist directly)
- **Testing**: Jest + ts-jest, config in `jest.config.js` (CommonJS — ts-node not installed)
- **Deployment**: Vercel (project: pinch-a-penny-auto-debit, org: cameron-white-s-projects)

---

## Critical Rules

### Safety
**Never build anything that automatically posts to production QuickBooks without manual approval.**
All QBO posting must be sandbox-only until explicitly enabled. The preview/push flow requires:
1. Validation passes
2. Prerequisite PDF uploaded (if carry-forward row exists)
3. All included line items have a QBO account assigned
4. Manual "Push to QBO" button click

### Supabase client
Always use the lazy proxy from `lib/db.ts` — never instantiate `createClient` directly in route files. The proxy prevents build-time crashes when env vars are absent.

```ts
import { db } from '@/lib/db'
```

### API routes
Every API route must have `export const dynamic = 'force-dynamic'` to prevent build-time evaluation.

### Environment variables
- `NEXT_PUBLIC_APP_VERSION` — baked at build time, shown in navbar. Update on Vercel before each prod deploy.
- `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET` — Intuit OAuth credentials (sandbox keys currently)
- `QBO_REDIRECT_URI` — must be `https://pinch-a-penny-auto-debit.vercel.app/api/qbo/callback`
- `QBO_ENVIRONMENT` — `sandbox` (do not change to `production` without explicit approval)
- `NEXT_PUBLIC_APP_URL` — `https://pinch-a-penny-auto-debit.vercel.app`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — CamtheChamp's Project

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/parser.ts` | Core PDF text parser — fully tested, 27/27 tests pass |
| `lib/pdf-extract.ts` | PDF text extraction via `unpdf` |
| `lib/db.ts` | Lazy Supabase proxy client |
| `lib/qbo-auth.ts` | `getValidAccessToken()` — checks expiry, auto-refreshes, throws `QboAuthError` |
| `lib/report-chain.ts` | Resolves full carry-forward prerequisite chains across multiple PDFs |
| `lib/report-dates.ts` | Normalizes report dates so `6/8/26` matches `6/08/26` |
| `app/components/AccountPicker.tsx` | Searchable QBO account dropdown — used on report, mappings, and settings pages |
| `app/api/upload/route.ts` | POST: extract → deduplicate → parse → insert records + auto-assign mappings |
| `app/api/reports/[id]/route.ts` | GET: full report detail with prerequisite + appliedToReport status |
| `app/api/mappings/route.ts` | GET/POST: accounting mapping rules |
| `app/api/mappings/[id]/route.ts` | PUT/DELETE: update or remove a mapping rule |
| `app/api/settings/route.ts` | GET all / PUT upsert: global app settings (e.g. bank_account) |
| `app/api/qbo/connect/route.ts` | GET: initiates OAuth, sets CSRF state cookie |
| `app/api/qbo/callback/route.ts` | GET: validates CSRF, exchanges code, stores tokens |
| `app/api/qbo/status/route.ts` | GET: returns connection status from qbo_connections |
| `app/api/qbo/disconnect/route.ts` | POST: deletes all qbo_connections rows |
| `app/api/qbo/accounts/route.ts` | GET: fetches live chart of accounts from QBO API |
| `app/api/qbo/preview/[id]/route.ts` | GET: builds JE payload (merges prereq lines), persists to qbo_pushes |
| `app/api/qbo/push/[id]/route.ts` | POST: submits proposed JE to QBO sandbox, captures intuit_tid |
| `app/page.tsx` | Upload page — drag & drop, duplicate detection, error detail |
| `app/reports/page.tsx` | Reports list — net amount due, validation badge, status |
| `app/reports/[id]/page.tsx` | Report detail — editable line items, JE preview table, push button |
| `app/mappings/page.tsx` | Mapping rules CRUD with live QBO account picker |
| `app/settings/page.tsx` | QBO connection + Bank/AP account setting |

---

## Parser Logic

### Row types
- **RM / RU / RI** — 2-amount rows: `(open_amount, net_amount_due)`. Discount column is blank/absent in PDF.
- **SO / SR** — 3-amount rows: `(open_amount, discount_available, net_amount_due)`.
- `collectAmounts(tokens)` counts actual token amounts to determine which case applies.

### Carry-forward prerequisite chain
- RU rows contain remarks like `"unapplied D.D. 6-11-26"`.
- `extractPriorReportDate()` parses this to `"6/11/26"`.
- `normalizeReportDate()` handles leading-zero differences (`6/8/26` vs `6/08/26`).
- Upload route checks if a report with that `run_date` already exists in DB.
- If not, the upload is saved but `prerequisite_upload_id` is null (unresolved).
- When the older report is later uploaded, all waiting reports are retroactively resolved.
- Carry-forward rows are auto-assigned `treatment = 'carry_forward'` on upload regardless of mappings.
- JE preview walks the full chain oldest-to-newest, not just the immediate prerequisite.

### Amount parsing
- `1,648.50` → `1648.50`
- `2,229.98-` → `-2229.98` (trailing minus = negative)
- blank / `0/00/00` → `null`

### Treatment values
- `include` — row enters the Journal Entry (debit/credit determined by sign of net_amount_due)
- `carry_forward` — placeholder RU row; excluded from JE, replaced by prerequisite PDF lines
- `ignore` — row excluded from JE entirely

### Journal Entry logic
- **Single JE per bank charge**: positive-net PDFs generate the JE; negative-net PDFs are absorbed
- Positive PDF's carry-forward RU row is excluded and replaced by real lines from every prerequisite PDF in the chain
- `PostingType`: positive `net_amount_due` → `"Debit"`, negative → `"Credit"`
- Balancing line Credits (or Debits) the Bank/AP account stored in `app_settings` key `bank_account`
- JE Description = raw remarks from the PDF row
- `intuit_tid` captured from QBO response headers for support tracing

### Current handoff (2026-06-20)
- Full carry-forward preview has been verified balanced for the production sample chain: `6/04/26 → 6/08/26 → 6/11/26 → 6/15/26`.
- Verified preview totals: Debits `$33,601.65`, Credits `$33,601.65`, Difference `$0.00`, with zero carry-forward placeholder lines included.
- QBO sandbox push succeeded for the 6/15/26 bank-charge report.
  - QBO Transaction ID: `145`
  - Intuit TID: `1-6a36d711-0db4d72f5f46f29a27ec75e1`
  - Verified back from QBO sandbox: Debits `$33,601.65`, Credits `$33,601.65`, Difference `$0.00`
  - AP balancing line used Vendor `Pinch A Penny #144` (`Vendor` ID `58`)
- Local fix is written for push error `"No proposed Journal Entry found. Generate a preview first."`
  - Root cause: `qbo_pushes.upload_id` is not unique, but preview used `upsert(... onConflict: 'upload_id')`.
  - Fix: preview updates the latest existing proposal or inserts one; push reads the latest proposal via `maybeSingle()`.
- Local AP vendor support is written.
  - Settings can save `ap_vendor`.
  - Preview attaches Vendor entity when the balancing account is Accounts Payable.
  - Push blocks AP pushes without a vendor.
- Not deployed yet: Vercel CLI token is invalid/requires login, and Git commit/push is blocked by a Windows ACL deny on `.git/index.lock` creation.
- Local verification passed: `npx tsc --noEmit --types jest` and `npm test -- --runInBand` (27/27).

---

## Database Schema (Supabase)

RLS is **disabled** on all tables (single-user internal tool, anon key only).

| Table | Purpose |
|-------|---------|
| `pdf_uploads` | One row per uploaded PDF; tracks status and prerequisite linkage |
| `report_headers` | Header fields (report number, run_date, customer name) |
| `line_items` | One row per parsed line; treatment, qbo_account_id, qbo_memo |
| `customer_totals` | Footer totals + validation results (open/discount/net match flags) |
| `accounting_mappings` | Rules for auto-assigning treatment/account to line items on upload |
| `qbo_connections` | OAuth tokens (realm_id, access_token, refresh_token, expires_at, refresh_expires_at, environment) |
| `qbo_pushes` | Proposed and submitted JE payloads with QBO response + intuit_tid |
| `audit_logs` | Event log (upload, push, error) |
| `app_settings` | Global key/value config — `bank_account: {id, name}` for JE balancing line |

---

## PDF Extraction History

Three attempts before landing on `unpdf`:
1. **pdfjs-dist v6** — requires `@napi-rs/canvas` native binary; crashes in Vercel serverless
2. **pdf-parse@1** — reads its own test files at module init; 422 errors in serverless
3. **unpdf** ✅ — serverless-safe pdfjs wrapper; currently in use

---

## QBO OAuth Flow

1. User clicks "Connect" → `GET /api/qbo/connect`
2. Server generates UUID state, stores in `qbo_oauth_state` httpOnly cookie (10 min TTL)
3. Redirects to `https://appcenter.intuit.com/connect/oauth2` with state param
4. Intuit redirects back to `GET /api/qbo/callback?code=...&realmId=...&state=...`
5. Callback validates state against cookie (CSRF check), exchanges code for tokens
6. Tokens stored in `qbo_connections` (upsert on `realm_id`)
7. Redirect to `/settings?qbo=connected`

Token refresh: `getValidAccessToken()` in `lib/qbo-auth.ts` checks expiry and auto-refreshes before any API call. Throws `QboAuthError` if refresh token is expired (user must reconnect).

---

## Deployment

```bash
# Set/update env var on Vercel
vercel env rm NEXT_PUBLIC_APP_VERSION production --yes
echo "1.0.X-<sha>" | vercel env add NEXT_PUBLIC_APP_VERSION production

# Deploy to production
vercel --prod
```

Production URL: https://pinch-a-penny-auto-debit.vercel.app
