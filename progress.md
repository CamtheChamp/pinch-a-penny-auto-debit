# Project Progress

**App**: PennyWise Ledger — multi-tenant SaaS (originally built for Pinch A Penny #144, now generalized)
**URL**: https://pinch-a-penny-auto-debit.vercel.app
**Current commit**: `abf853ce`
**Last updated**: 2026-06-28

---

## Completed

### Core (PDF parsing, mappings, QBO sandbox JE flow)
- Next.js 16 App Router + TypeScript + Tailwind CSS v4
- `lib/parser.ts` — full token-based parser, 27/27 tests passing, including a fixed bug where sub-dollar amounts without a leading zero (`.48-`) were silently dropped
- Upload → dedupe → parse → auto-assign mappings → carry-forward prerequisite chain resolution
- Reports list + detail pages, accounting mapping rules CRUD (inline-editable), Settings page, Audit log with filter chips
- QBO OAuth, JE preview/push, AP vendor support, unique `DocNumber` (report number + run date)
- Optional discount adjustment (Debit Inventory / Credit Discount Expense), toggle + 2 account settings
- **Re-push**: pushing an already-pushed report now edits the existing QuickBooks JE in place (fetches current `SyncToken`) instead of creating a duplicate or blocking with a 409
- **Delete report**: available on both the reports list and detail page, cascades to line items/totals/pushes, confirms before deleting

### Rebrand + redesign
- Renamed from "Pinch A Penny Auto Debit Parser" to **PennyWise Ledger** (penny-themed, avoids reusing the Pinch A Penny trademark phrase) — only the tool's own branding changed; the real store name stays visible wherever it reflects actual data
- Fluent UI / SharePoint-style redesign: left nav rail, Microsoft blue + Fluent neutral palette (via `app/globals.css` `@theme` token overrides — no per-component rewrites needed), Segoe UI typography

### Multi-tenant SaaS conversion (the big one)
- Google sign-in via Supabase Auth + `@supabase/ssr`, gated by `middleware.ts`, restricted to an `ALLOWED_EMAILS` allowlist
- Every table (`pdf_uploads`, `report_headers`, `line_items`, `customer_totals`, `accounting_mappings`, `qbo_connections`, `audit_logs`, `qbo_pushes`, `app_settings`) got a `user_id` column — NOT NULL, RLS-enforced, with matching application-level filters in every route (defense in depth)
- Per-user QuickBooks connections (`qbo_connections` now `UNIQUE(user_id)`, not `realm_id`)
- New users auto-seeded with their own copy of the 7 default mapping rules via a Postgres trigger on `auth.users` insert
- Rollout completed end-to-end on production data: owner (`pcameronwhite@gmail.com`) backfilled to own all pre-existing data; second account (`crawfordandwhite@gmail.com`) authorized, then seeded with a **copy** (not move) of the owner's mappings/settings/historical reports as a starting point — both accounts verified fully isolated via direct RLS simulation (each sees only their own rows; unrelated/anon roles see zero)
- EULA + Privacy Policy rewritten to reflect the multi-tenant model (per-account isolation, invite-only, each account's own QuickBooks connection)

### Compliance Pages
- `/eula`, `/privacy` — submitted to Intuit Developer Portal, since updated for the multi-tenant model

### Intuit Developer Portal
- App created, email verified, EULA/Privacy/redirect URLs submitted, app questionnaire answered
- [ ] Registered app name in the portal still says "Auto Debit Upload" — optionally rename to match "PennyWise Ledger"
- [ ] Error Handling / Security questionnaire sections — not started

---

## In Progress / TODO

### Production QBO readiness
- [x] Production QBO connected and in active use (owner's real Pinch A Penny #144 company)
- [ ] Token encryption at rest (currently stored plaintext in Supabase — same as before the multi-tenant conversion, not newly introduced, but still open)
- [ ] Second account (`crawfordandwhite@gmail.com`) needs to connect its own QuickBooks company — the copied bank/AP/discount account settings reference the owner's QBO account IDs and won't resolve correctly until they do

### Nice-to-have
- [ ] Token refresh test (verify auto-refresh works after 1-hour expiry)
- [ ] Email/notification on push failure
- [ ] Bulk upload parallelization
- [ ] Repo/Vercel project name still `pinch-a-penny-auto-debit` — cosmetic only, not renamed (would require coordinating a repo rename + remote URL change)

---

## Database Schema (9 tables, all RLS-enabled)

| Table | Purpose |
|-------|---------|
| `pdf_uploads` | One row per uploaded PDF; prerequisite linkage, status — per-user |
| `report_headers` | Header fields (report number, run_date, customer name) — per-user |
| `line_items` | One row per parsed line; treatment, QBO account, memo — per-user |
| `customer_totals` | Footer totals + validation flags — per-user |
| `accounting_mappings` | Auto-assign rules — per-user, seeded with defaults on signup |
| `qbo_connections` | OAuth tokens — per-user, `UNIQUE(user_id)` |
| `qbo_pushes` | Proposed and submitted JE payloads with QBO response — per-user |
| `audit_logs` | Event log (upload, manual_edit, qbo_push/repush success/error, report_deleted) — per-user |
| `app_settings` | Per-user key/value config (`bank_account`, `ap_vendor`, discount settings) — composite PK `(user_id, key)` |

Migrations: `001_initial.sql` → `002_app_settings.sql` → `003_multi_tenant.sql` (nullable `user_id` everywhere) → `004_mapping_seed_trigger.sql` → `006_app_settings_composite_pk.sql` (applied ahead of `005` to fix a live multi-tenant bug) → `005_enable_rls.sql` (NOT NULL + RLS, applied last after manual backfill).

---

## Environment Variables (Vercel Production)

| Variable | Status |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ set |
| `NEXT_PUBLIC_APP_VERSION` | ✅ set (bump before every deploy) |
| `NEXT_PUBLIC_APP_URL` | ✅ set |
| `ALLOWED_EMAILS` | ✅ set (`pcameronwhite@gmail.com,crawfordandwhite@gmail.com`) |
| `QBO_CLIENT_ID` | ✅ set |
| `QBO_CLIENT_SECRET` | ✅ set |
| `QBO_REDIRECT_URI` | ✅ set |
| `QBO_ENVIRONMENT` | ✅ set (`production`) |

**Supabase dashboard config** (manual, not env vars): Google OAuth provider enabled under Authentication → Providers, with this app's `/auth/callback` URL added to Authentication → URL Configuration → Redirect URLs. Note: this Supabase project is shared with another unrelated app (`camthechamp.github.io/stronglifts-5x5-tracker`) — the Redirect URLs allowlist has entries for both; the single "Site URL" field is just the fallback and points at the other app, which is fine as long as redirects always match an allowlist entry.
