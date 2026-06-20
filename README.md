# PennyWise Ledger

Internal tool for Pinch A Penny Pool Patio & Spa Store #144. Parses "R03989 Preauthorized Debit" PDF reports and prepares QuickBooks Online Journal Entries for review.

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
| `/reports/[id]` | Review a parsed report, edit mappings, preview/push QBO sandbox Journal Entry |
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

> Production posting is **disabled by default**. QBO posting must stay sandbox-only until explicitly approved.

1. Create an app at [developer.intuit.com](https://developer.intuit.com)
2. Add OAuth 2.0 credentials to `.env.local`
3. Use `/settings` to connect or reconnect QuickBooks Online sandbox
4. Set the Bank / AP balancing account in `/settings`
5. Preview the Journal Entry from `/reports/[id]`
6. Push to QBO sandbox only after manual review

## Current QBO Handoff

- [x] QBO OAuth 2.0 callback + token refresh implemented in `app/api/qbo/`
- [x] Sandbox JE preview implemented in `GET /api/qbo/preview/[id]`
- [x] Sandbox push route implemented in `POST /api/qbo/push/[id]`
- [x] Full carry-forward chain preview is balanced for sample chain:
  - `6/04/26 -> 6/08/26 -> 6/11/26 -> 6/15/26`
  - Debits `$33,601.65`; Credits `$33,601.65`; Difference `$0.00`
- [x] QBO sandbox push completed for the 6/15/26 bank-charge report
  - QBO Transaction ID `145`
  - Intuit TID `1-6a36d711-0db4d72f5f46f29a27ec75e1`
  - Verified back from QBO sandbox with Debits `$33,601.65`; Credits `$33,601.65`
- [ ] Deploy local fix for preview proposal persistence before the next push
  - Symptom: Push can show "No proposed Journal Entry found. Generate a preview first."
  - Cause: preview used `upsert(... onConflict: 'upload_id')`, but `qbo_pushes.upload_id` is not unique.
  - Local fix: preview now updates the latest existing proposal or inserts one; push reads the latest proposal row.
- [ ] Deploy local AP vendor support
  - QBO requires a Vendor entity when the balancing account is Accounts Payable.
  - Sandbox vendor created: `Pinch A Penny #144` (`Vendor` ID `58`)
  - Local fix: Settings can save `ap_vendor`; preview attaches it to AP balancing lines; push blocks AP pushes without it.
- [ ] Encrypt OAuth tokens stored in `qbo_connections` table
- [ ] Enable production flag after end-to-end sandbox test

## Parser Notes

- Two-amount rows (RM, RU, RI) are parsed as `(open_amount, net_amount_due)` — the discount column is blank for these rows
- Three-amount rows (SO, SR) are parsed as `(open_amount, discount_available, net_amount_due)`
- Trailing-minus amounts like `2,229.98-` are correctly parsed as negative
- `0/00/00` discount due dates are treated as null
- Carry-forward rows (`RU` doc type, or remarks containing "unapplied D.D.") are excluded from the JE and replaced by actual rows from the referenced prior PDF chain
- Report date matching normalizes leading-zero differences, so `6/8/26` and `6/08/26` resolve to the same prerequisite date
