# Pinch A Penny Auto Debit Parser — CLAUDE.md

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
3. Manual "Push to QBO" button click

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
| `app/api/upload/route.ts` | POST: extract PDF → parse → detect prerequisites → insert all records |
| `app/api/reports/[id]/route.ts` | GET: full report detail with prerequisite status |
| `app/api/qbo/connect/route.ts` | GET: initiates OAuth, sets CSRF state cookie |
| `app/api/qbo/callback/route.ts` | GET: validates CSRF, exchanges code, stores tokens |
| `app/api/qbo/status/route.ts` | GET: returns connection status from qbo_connections |
| `app/api/qbo/disconnect/route.ts` | POST: deletes all qbo_connections rows |
| `app/api/qbo/preview/[id]/route.ts` | POST: builds Journal Entry payload, persists to qbo_pushes |
| `app/page.tsx` | Upload page — drag & drop, shows error detail on failure |
| `app/reports/[id]/page.tsx` | Report review — editable line items, prerequisite banner, JE preview |
| `app/settings/page.tsx` | QBO connection status, connect/reconnect/disconnect buttons |

---

## Parser Logic

### Row types
- **RM / RU / RI** — 2-amount rows: `(open_amount, net_amount_due)`. Discount column is blank/absent in PDF.
- **SO / SR** — 3-amount rows: `(open_amount, discount_available, net_amount_due)`.
- `collectAmounts(tokens)` counts actual token amounts to determine which case applies.

### Carry-forward prerequisite chain
- RU rows contain remarks like `"unapplied D.D. 6-11-26"`.
- `extractPriorReportDate()` parses this to `"6/11/26"`.
- Upload route checks if a report with that `run_date` already exists in DB.
- If not, the upload is saved but marked `prerequisite_met: false`.
- When the older report is later uploaded, all waiting reports are retroactively resolved.

### Amount parsing
- `1,648.50` → `1648.50`
- `2,229.98-` → `-2229.98` (trailing minus = negative)
- blank / `0/00/00` → `null`

### Journal Entry mapping
- Positive `net_amount_due` → `PostingType: "Debit"`
- Negative `net_amount_due` → `PostingType: "Credit"`
- Balancing line added as Credit to bank/AP for total net

---

## Database Schema (Supabase)

RLS is **disabled** on all tables (single-user internal tool, anon key only).

| Table | Purpose |
|-------|---------|
| `pdf_uploads` | One row per uploaded PDF; tracks status and prerequisite linkage |
| `report_headers` | Header fields (report number, run_date, customer name) |
| `line_items` | One row per parsed line; stores accounting overrides (treatment, qbo_account_id, memo) |
| `customer_totals` | Footer totals + validation results (open/discount/net match flags) |
| `accounting_mappings` | Rules for auto-assigning treatment/account to line items |
| `qbo_connections` | OAuth tokens (realm_id, access_token, refresh_token, expires_at, refresh_expires_at) |
| `qbo_pushes` | Proposed and submitted JE payloads with QBO response |
| `audit_logs` | Event log (upload, push, error) |

The `qbo_connections` table was created via MCP migration (not in the local SQL file) with columns:
`realm_id, access_token, refresh_token, expires_at, refresh_expires_at, environment`

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
