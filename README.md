# PennyWise Ledger

Multi-tenant SaaS tool that parses "R03989 Preauthorized Debit" PDF reports and prepares QuickBooks Online Journal Entries for review. Each signed-in account's uploads, mapping rules, settings, and QuickBooks connection are fully isolated from every other account. Originally built for Pinch A Penny Pool Patio & Spa Store #144 — that data now lives under its own account like any other.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. In the Supabase dashboard, open the SQL Editor and run the migrations in `supabase/migrations/` in order (`001` through `006`)
3. Under Authentication → Providers, enable Google (Client ID/Secret from Google Cloud Console; that client's authorized redirect URI must be `https://<your-project-ref>.supabase.co/auth/v1/callback`)
4. Under Authentication → URL Configuration → Redirect URLs, add `<your-app-url>/auth/callback`
5. Copy `.env.local.example` to `.env.local` and fill in your project URL, anon key, and `ALLOWED_EMAILS`

```bash
cp .env.local.example .env.local
```

### 3. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login` to sign in with an allowlisted Google account.

## Pages

| Path | Description |
|------|-------------|
| `/login` | Google sign-in |
| `/` | Upload Preauthorized Debit PDFs |
| `/reports` | List of parsed reports, with push/re-push and delete |
| `/reports/[id]` | Review a parsed report, edit mappings, preview/push/re-push the QBO Journal Entry, delete |
| `/mappings` | Configure accounting mapping rules (inline-editable) |
| `/settings` | QuickBooks Online connection, Bank/AP account, AP vendor, discount adjustment |
| `/audit` | Audit log of all events, filterable by type |
| `/eula`, `/privacy` | Public compliance pages (for the Intuit Developer Portal) |

## Running Tests

```bash
npm test
```

Tests cover the parser module against all 4 sample PDFs:
- Amount parsing (positive, trailing-minus negative, sub-dollar without leading zero, blank, date rejection)
- Date parsing
- Header extraction
- Line item counts per PDF
- Doc type detection (SO, RM, RU, RI, SR)
- Carry-forward row detection
- Total validation for all 4 PDFs

## Multi-Tenancy

Every database table has a `user_id` column enforced by Postgres RLS policies (`user_id = auth.uid()`), on top of explicit `user_id` filters in every API route — defense in depth, not either/or. New accounts are seeded with their own copy of the default mapping rules via a Postgres trigger on signup. Each account connects its own QuickBooks Online company independently; there is no shared QBO connection between accounts.

## QuickBooks Online Setup

> Pushing to **production** QuickBooks requires explicit approval — `QBO_ENVIRONMENT` is a global deployment setting, not per-tenant, so changing it affects every account's connection target.

1. Create an app at [developer.intuit.com](https://developer.intuit.com)
2. Add OAuth 2.0 credentials to your environment (shared across all tenants — each tenant still authorizes their own distinct company)
3. Sign in, then use `/settings` to connect your own QuickBooks company
4. Set the Bank / AP balancing account (and optionally the discount adjustment accounts) in `/settings`
5. Preview the Journal Entry from `/reports/[id]`
6. Push (or re-push, which edits the existing transaction in place) only after manual review

## Parser Notes

- Two-amount rows (RM, RU, RI) are parsed as `(open_amount, net_amount_due)` — the discount column is blank for these rows
- Three-amount rows (SO, SR) are parsed as `(open_amount, discount_available, net_amount_due)`
- Trailing-minus amounts like `2,229.98-` are correctly parsed as negative
- Sub-dollar amounts without a leading zero, like `.48-`, are correctly parsed as `-0.48`
- `0/00/00` discount due dates are treated as null
- Carry-forward rows (`RU` doc type, or remarks containing "unapplied D.D.") are excluded from the JE and replaced by actual rows from the referenced prior PDF chain
- Report date matching normalizes leading-zero differences, so `6/8/26` and `6/08/26` resolve to the same prerequisite date
