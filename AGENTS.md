# PennyWise Ledger — AGENTS.md

Multi-tenant SaaS tool that parses "R03989 Preauthorized Debit" PDF reports and prepares
QuickBooks Online Journal Entries. Each signed-in account is a fully isolated tenant —
own uploads, mapping rules, settings, and QuickBooks connection, invisible to every
other account. Originally built as a single-store internal tool for Pinch A Penny Pool
Patio & Spa Store #144; that store's data now lives under its own account like any other.

---

## Stack

- **Framework**: Next.js 16 (App Router), TypeScript, React 19
- **Styling**: Tailwind CSS v4 — use `@import "tailwindcss"` in globals.css, `@tailwindcss/postcss` in postcss.config.mjs. Theme colors/fonts/radius overridden via `@theme` in `app/globals.css` (Fluent/SharePoint-style palette) — change the look by editing those tokens, not per-component classes.
- **Auth**: Supabase Auth, Google OAuth provider, via `@supabase/ssr`. Invite-only — enforced by an `ALLOWED_EMAILS` allowlist checked in `app/auth/callback/route.ts`.
- **Database**: Supabase (Postgres) — project "CamtheChamp's Project" (`qonhadvvgfegdituotbw`), region us-west-2. RLS **enabled** on all 9 tables.
- **ORM**: `@supabase/supabase-js`, accessed via per-request clients in `lib/supabase-server.ts` (server) / `lib/supabase-browser.ts` (browser) — see Multi-Tenancy section below.
- **PDF extraction**: `unpdf` (serverless-safe pdfjs wrapper — NOT pdf-parse, NOT pdfjs-dist directly)
- **Testing**: Jest + ts-jest, config in `jest.config.js` (CommonJS — ts-node not installed)
- **Deployment**: Vercel (project: pinch-a-penny-auto-debit, org: cameron-white-s-projects)

---

## Critical Rules

### Multi-tenancy (read this before touching any DB query)
Every user-scoped table has a `user_id` column, NOT NULL, with an RLS policy gating select/insert/update/delete on `user_id = auth.uid()`. RLS is the backstop — application code must **also** explicitly filter:
- Every `select` needs `.eq('user_id', user.id)`.
- Every `insert`/`upsert` needs `user_id: user.id` in the row.
- Resolve the user first: `const supabase = await getServerSupabase(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })`.

The highest-risk spot for a missed filter is anything that looks up a record by something OTHER than its own id (e.g. matching a report by run date, or a QBO connection by realm) — those are exactly the queries that silently leak across tenants if the `user_id` filter is forgotten. `lib/report-chain.ts`'s `findUploadIdByRunDate` and everything in `lib/qbo-auth.ts` are the two places this bit us during the original migration; both now take/use a `userId` parameter explicitly.

New users are seeded with their own copy of the 7 default `accounting_mappings` rows via a Postgres trigger (`seed_default_mappings()`, migration 004) on `auth.users` insert — not application code. If a Google identity already existed in this Supabase project (e.g. from a different app sharing the same project), no insert fires and no seed happens; backfill manually if that occurs.

### Safety
**Never flip `QBO_ENVIRONMENT` to `production` or push real transactions without explicit approval.** `QBO_ENVIRONMENT` is a single global deployment-level setting (not per-tenant) — every tenant's OAuth connection hits whichever Intuit API host this deployment is configured for, but each still connects their own distinct `realm_id`/company. The preview/push flow requires:
1. Validation passes
2. Prerequisite PDF uploaded (if carry-forward row exists)
3. All included line items have a QBO account assigned
4. Manual "Push to QuickBooks" (or "Re-push") button click

Re-pushing an already-pushed report **edits the existing QuickBooks Journal Entry in place** (fetches the current `SyncToken`, submits an update) rather than creating a duplicate transaction.

### Supabase clients
- **User-facing routes/pages**: `import { getServerSupabase } from '@/lib/supabase-server'` — constructs a **fresh** client per call from `next/headers` cookies. Never cache it at module scope (Vercel Fluid Compute reuses function instances across concurrent requests; a cached authenticated client would leak sessions between users).
- **Client components** (login button, sign-out): `import { getBrowserSupabase } from '@/lib/supabase-browser'`.
- **`lib/db.ts`** (service-role client, bypasses RLS): kept only as a future admin/system escape hatch. No user-facing route should import it — grep for `from '@/lib/db'` after any change and confirm it stays empty.

### API routes
Every API route must have `export const dynamic = 'force-dynamic'` to prevent build-time evaluation.

### Environment variables
- `NEXT_PUBLIC_APP_VERSION` — baked at build time, shown in navbar. Update on Vercel before each prod deploy.
- `ALLOWED_EMAILS` — comma-separated allowlist for Google sign-in. Falls back to `pcameronwhite@gmail.com` if unset (fail-safe, not a feature to rely on).
- `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET` — this app's own registered OAuth client with Intuit, shared across all tenants (each tenant still authorizes their own distinct QuickBooks company through it).
- `QBO_REDIRECT_URI` — must be `https://pinch-a-penny-auto-debit.vercel.app/api/qbo/callback`
- `QBO_ENVIRONMENT` — `sandbox` or `production`, global for the deployment (see Safety above)
- `NEXT_PUBLIC_APP_URL` — `https://pinch-a-penny-auto-debit.vercel.app`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — CamtheChamp's Project (anon key only — RLS does the enforcement, no service-role key needed for any user-facing path)

**Supabase dashboard config required** (not code, can't be automated): Authentication → Providers → Google (Client ID/Secret from Google Cloud Console, whose own redirect URI must be `https://qonhadvvgfegdituotbw.supabase.co/auth/v1/callback`) and Authentication → URL Configuration → Redirect URLs must include this app's `/auth/callback` URL.

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/parser.ts` | Core PDF text parser — fully tested, 27/27 tests pass |
| `lib/pdf-extract.ts` | PDF text extraction via `unpdf` |
| `lib/supabase-server.ts` | Per-request authenticated Supabase client (server) |
| `lib/supabase-browser.ts` | Browser Supabase client (login button, sign-out) |
| `lib/db.ts` | Service-role client — admin/system escape hatch only, not for user routes |
| `lib/qbo-auth.ts` | `getValidAccessToken(userId)` — checks expiry, auto-refreshes, throws `QboAuthError` |
| `lib/report-chain.ts` | Resolves full carry-forward prerequisite chains, scoped by `userId` |
| `lib/report-dates.ts` | Normalizes report dates so `6/8/26` matches `6/08/26` |
| `middleware.ts` | Auth gate — redirects unauthenticated requests to `/login`; public allowlist for `/login`, `/auth/callback`, `/eula`, `/privacy`, `/api/qbo/callback` |
| `app/login/page.tsx` + `GoogleSignInButton.tsx` | Sign-in page |
| `app/auth/callback/route.ts` | Exchanges OAuth code for session, enforces `ALLOWED_EMAILS` |
| `app/components/UserMenu.tsx` | Header email + sign-out |
| `app/components/NavRail.tsx` | Left nav rail (Fluent-style shell) |
| `app/components/AccountPicker.tsx` | Searchable QBO account dropdown — portal-rendered so it isn't clipped by table overflow |
| `app/components/PushToQboButton.tsx` | Reports-list quick push/re-push button |
| `app/components/DeleteReportButton.tsx` | Delete confirm + call, used on list and detail pages |
| `app/api/upload/route.ts` | POST: extract → deduplicate → parse → insert records + auto-assign mappings (all scoped to `user_id`) |
| `app/api/reports/[id]/route.ts` | GET/PATCH/DELETE: report detail, line-item edits, delete (cascades) |
| `app/api/mappings/route.ts`, `[id]/route.ts` | CRUD for accounting mapping rules |
| `app/api/settings/route.ts` | GET all / PUT upsert: per-user settings (`bank_account`, `ap_vendor`, discount settings) |
| `app/api/qbo/connect/route.ts` | GET: initiates OAuth, sets CSRF state cookie |
| `app/api/qbo/callback/route.ts` | GET: validates CSRF, exchanges code, upserts `qbo_connections` keyed by `user_id` |
| `app/api/qbo/status/route.ts`, `disconnect/route.ts` | Per-user connection status / disconnect |
| `app/api/qbo/accounts/route.ts`, `vendors/route.ts` | Live chart of accounts / vendors from QBO API (paginated past QBO's 100-row default) |
| `app/api/qbo/preview/[id]/route.ts` | GET: builds JE payload (merges prereq lines, discount adjustment), persists to `qbo_pushes` |
| `app/api/qbo/push/[id]/route.ts` | POST: submits or re-submits (edits in place) the JE to QBO, captures `intuit_tid` |
| `app/page.tsx` | Upload page — drag & drop, duplicate detection, per-file expandable line-item summary |
| `app/reports/page.tsx` | Reports list — push/re-push button, delete button |
| `app/reports/[id]/page.tsx` | Report detail — editable line items, JE preview table, push/re-push, delete |
| `app/mappings/page.tsx` | Mapping rules CRUD, inline edit of field/type/value/priority |
| `app/settings/page.tsx` | QBO connection, Bank/AP account, AP vendor, discount adjustment settings |
| `app/audit/page.tsx` | Audit log with event-type filter chips |

---

## Parser Logic

### Row types
- **RM / RU / RI** — 2-amount rows: `(open_amount, net_amount_due)`. Discount column is blank/absent in PDF.
- **SO / SR** — 3-amount rows: `(open_amount, discount_available, net_amount_due)`.
- `collectAmounts(tokens)` counts actual token amounts to determine which case applies. The amount-token regex matches sub-dollar values without a leading zero (e.g. `.48-`) — a real bug found in production where a return's discount column was silently dropped because the old regex required a digit before the decimal point.

### Carry-forward prerequisite chain
- RU rows contain remarks like `"unapplied D.D. 6-11-26"`.
- `extractPriorReportDate()` parses this to `"6/11/26"`.
- `normalizeReportDate()` handles leading-zero differences (`6/8/26` vs `6/08/26`).
- Upload route checks (scoped to the uploading user) if a report with that `run_date` already exists.
- If not, the upload is saved but `prerequisite_upload_id` is null (unresolved).
- When the older report is later uploaded, all waiting reports for that same user are retroactively resolved.
- Carry-forward rows are auto-assigned `treatment = 'carry_forward'` on upload regardless of mappings.
- JE preview walks the full chain oldest-to-newest, not just the immediate prerequisite.

### Amount parsing
- `1,648.50` → `1648.50`
- `2,229.98-` → `-2229.98` (trailing minus = negative)
- `.48-` → `-0.48` (sub-dollar, no leading zero)
- blank / `0/00/00` → `null`

### Treatment values
- `include` — row enters the Journal Entry (debit/credit determined by sign of net_amount_due)
- `carry_forward` — placeholder RU row; excluded from JE, replaced by prerequisite PDF lines
- `ignore` — row excluded from JE entirely

### Journal Entry logic
- **Single JE per bank charge**: positive-net PDFs generate the JE; negative-net PDFs are absorbed
- Positive PDF's carry-forward RU row is excluded and replaced by real lines from every prerequisite PDF in the chain
- `PostingType`: positive `net_amount_due` → `"Debit"`, negative → `"Credit"`
- `DocNumber` = `${report_number}-${YYYYMMDD}` (run date appended so repeated report numbers across different runs don't collide in QuickBooks)
- Balancing line Credits (or Debits) the Bank/AP account stored in `app_settings` key `bank_account`
- **Discount adjustment** (optional, off by default, per-user toggle in Settings): sums `discount_available` across every included line (full prerequisite chain) and, if non-zero and both accounts are configured, appends one combined Debit Inventory / Credit Discount Expense pair. Skips silently if the toggle is off or the total is zero; warns (without blocking) if enabled but accounts aren't set.
- JE Description = raw remarks from the PDF row
- `intuit_tid` captured from QBO response headers for support tracing
- **Re-push** (report already has status `pushed`): fetches the existing transaction's current `SyncToken` from QBO, then submits an update (same `Id`+`SyncToken`) instead of creating a new transaction. Audit events use `qbo_repush_success`/`qbo_repush_error` to distinguish from original pushes.

---

## Database Schema (Supabase)

RLS is **enabled** on all 9 tables; every table has a `user_id uuid not null references auth.users(id) on delete cascade` column with select/insert/update/delete policies gated on `user_id = auth.uid()`. Migrations are staged: `003` (additive, nullable) → `004` (mapping seed trigger) → `006` (app_settings composite PK fix — applied out of order to fix a live bug) → `005` (NOT NULL + RLS, applied last, after a one-time manual backfill of any pre-multi-tenant data).

| Table | Purpose |
|-------|---------|
| `pdf_uploads` | One row per uploaded PDF; tracks status and prerequisite linkage |
| `report_headers` | Header fields (report number, run_date, customer name) |
| `line_items` | One row per parsed line; treatment, qbo_account_id, qbo_memo |
| `customer_totals` | Footer totals + validation results (open/discount/net match flags) |
| `accounting_mappings` | Per-user rules for auto-assigning treatment/account to line items on upload |
| `qbo_connections` | Per-user OAuth tokens — `UNIQUE(user_id)`, not `realm_id` (one connection per tenant) |
| `qbo_pushes` | Proposed and submitted JE payloads with QBO response + intuit_tid |
| `audit_logs` | Event log (upload, manual_edit, qbo_push_*, qbo_repush_*, report_deleted) |
| `app_settings` | Per-user key/value config — composite PK `(user_id, key)` — `bank_account`, `ap_vendor`, `discount_adjustment_enabled`, `discount_inventory_account`, `discount_expense_account` |

---

## PDF Extraction History

Three attempts before landing on `unpdf`:
1. **pdfjs-dist v6** — requires `@napi-rs/canvas` native binary; crashes in Vercel serverless
2. **pdf-parse@1** — reads its own test files at module init; 422 errors in serverless
3. **unpdf** ✅ — serverless-safe pdfjs wrapper; currently in use

---

## QBO OAuth Flow (per-user)

1. User (already signed into the app) clicks "Connect" → `GET /api/qbo/connect`
2. Server generates UUID state, stores in `qbo_oauth_state` httpOnly cookie (10 min TTL)
3. Redirects to `https://appcenter.intuit.com/connect/oauth2` with state param
4. Intuit redirects back to `GET /api/qbo/callback?code=...&realmId=...&state=...` — the user's Supabase session cookie persists through this round-trip
5. Callback validates state against cookie (CSRF check), resolves the current user, exchanges code for tokens
6. Tokens upserted into `qbo_connections` keyed by `user_id` (one connection per tenant)
7. Redirect to `/settings?qbo=connected`

Token refresh: `getValidAccessToken(userId)` in `lib/qbo-auth.ts` checks expiry and auto-refreshes before any API call. Throws `QboAuthError` if refresh token is expired (user must reconnect).

---

## Deployment

```bash
# Set/update env var on Vercel
vercel env rm NEXT_PUBLIC_APP_VERSION production --yes
echo "1.X.X-<sha>" | vercel env add NEXT_PUBLIC_APP_VERSION production

# Deploy to production
vercel --prod --yes
```

Production URL: https://pinch-a-penny-auto-debit.vercel.app

See `progress.md` for the current handoff/status snapshot.
