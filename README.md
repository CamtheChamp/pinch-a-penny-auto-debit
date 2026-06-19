# Pinch A Penny #144 — Auto Debit Parser

Parses "R03989 Preauthorized Debit" PDF reports and prepares QuickBooks Online entries for review.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. In the Supabase dashboard, open the SQL Editor and run `supabase/migrations/001_initial.sql`
3. Copy `.env.local.example` to `.env.local` and fill in your project URL and API key

```bash
cp .env.local.example .env.local
```

### 3. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Pages

| Path | Description |
|------|-------------|
| `/` | Upload Preauthorized Debit PDFs |
| `/reports` | List of parsed reports |
| `/reports/[id]` | Review a parsed report, edit mappings, preview QBO payload |
| `/mappings` | Configure accounting mapping rules |
| `/settings` | QuickBooks Online connection settings |
| `/audit` | Audit log of all events |

## Running Tests

```bash
npm test
```

Tests cover the parser module against all 4 sample PDFs:
- Amount parsing (positive, trailing-minus negative, blank, date rejection)
- Date parsing
- Header extraction
- Line item counts per PDF
- Doc type detection (SO, RM, RU, RI, SR)
- Carry-forward row detection
- Total validation for all 4 PDFs

## QuickBooks Online Setup (Sandbox)

> Production posting is **disabled by default** until the transaction type is confirmed.

1. Create an app at [developer.intuit.com](https://developer.intuit.com)
2. Add OAuth 2.0 credentials to `.env.local`
3. Implement `GET /api/qbo/auth` (redirect to Intuit) and `GET /api/qbo/callback` (exchange code for tokens)
4. Use `POST /api/qbo/push/[id]` (to be built) to push sandbox entries after approval

## TODO — Production QBO Checklist

- [ ] Confirm transaction type with bookkeeper: JournalEntry / Expense / Check / bank-feed match
- [ ] Implement QBO OAuth 2.0 callback + token refresh in `app/api/qbo/`
- [ ] Implement `POST /api/qbo/push/[id]` with sandbox/production guard
- [ ] Add "Push to QBO Sandbox" button on report review page
- [ ] Encrypt OAuth tokens stored in `qbo_connections` table
- [ ] Enable production flag after end-to-end sandbox test
- [ ] Fill in QBO account IDs in accounting mappings (requires bookkeeper input)

## Parser Notes

- Two-amount rows (RM, RU, RI) are parsed as `(open_amount, net_amount_due)` — the discount column is blank for these rows
- Three-amount rows (SO, SR) are parsed as `(open_amount, discount_available, net_amount_due)`
- Trailing-minus amounts like `2,229.98-` are correctly parsed as negative
- `0/00/00` discount due dates are treated as null
- Carry-forward rows (`RU` doc type, or remarks containing "unapplied D.D.") are flagged and should not be posted without special accounting treatment
