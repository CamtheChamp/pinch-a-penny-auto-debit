-- Pinch A Penny Auto Debit: initial schema

create table if not exists pdf_uploads (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  uploaded_at timestamptz not null default now(),
  raw_text text,
  parse_errors jsonb default '[]',
  status text not null default 'pending'
    check (status in ('pending','parsed','approved','pushed','error'))
);

create table if not exists report_headers (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references pdf_uploads(id) on delete cascade,
  report_number text,
  run_date text,
  run_time text,
  customer_name text,
  page_number int
);

create table if not exists line_items (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references pdf_uploads(id) on delete cascade,
  sort_order int not null default 0,
  customer_number text,
  remarks text,
  doc_type text,
  doc_number text,
  payment_term text,
  invoice_date text,
  due_date text,
  discount_due_date text,
  open_amount numeric(12,2),
  discount_available numeric(12,2),
  net_amount_due numeric(12,2),
  raw_text text,
  row_category text,
  is_carry_forward boolean default false,
  warnings jsonb default '[]',
  -- Accounting overrides
  qbo_account_id text,
  qbo_account_name text,
  qbo_class_id text,
  qbo_memo text,
  treatment text default 'needs_review'
    check (treatment in ('expense','credit','carry_forward','ignore','needs_review'))
);

create table if not exists customer_totals (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references pdf_uploads(id) on delete cascade unique,
  open_amount numeric(12,2),
  discount_available numeric(12,2),
  net_amount_due numeric(12,2),
  raw_text text,
  -- Validation results
  open_amount_match boolean,
  discount_match boolean,
  net_amount_match boolean,
  open_amount_diff numeric(12,4),
  discount_diff numeric(12,4),
  net_amount_diff numeric(12,4)
);

create table if not exists accounting_mappings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  match_type text not null default 'contains'
    check (match_type in ('exact','contains','regex')),
  match_field text not null default 'remarks'
    check (match_field in ('remarks','doc_type','doc_number')),
  match_value text not null,
  qbo_account_name text,
  qbo_account_id text,
  qbo_class_id text,
  qbo_location_id text,
  default_memo text,
  treatment text not null default 'needs_review'
    check (treatment in ('expense','credit','carry_forward','ignore','needs_review')),
  priority int not null default 0
);

-- Seed default mappings
insert into accounting_mappings (match_type, match_field, match_value, qbo_account_name, treatment, default_memo, priority)
values
  ('exact',    'doc_type',  'RU',        null,                    'carry_forward', 'Unapplied D.D. carry-forward',       100),
  ('contains', 'remarks',   'UNAPPLIED', null,                    'carry_forward', 'Unapplied D.D. carry-forward',        90),
  ('contains', 'remarks',   'ADV/FF',    null,                    'needs_review',  'Advertising/Franchise Fee — map me',  80),
  ('exact',    'doc_type',  'RI',        null,                    'needs_review',  'RI row — map me',                     70),
  ('exact',    'doc_type',  'SO',        null,                    'needs_review',  'Sales Order — map me',                60),
  ('exact',    'doc_type',  'RM',        null,                    'credit',        'Rebate/Credit',                       50),
  ('exact',    'doc_type',  'SR',        null,                    'needs_review',  'Sales Return — map me',               40)
on conflict do nothing;

create table if not exists qbo_connections (
  id uuid primary key default gen_random_uuid(),
  realm_id text unique,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  environment text not null default 'sandbox'
    check (environment in ('sandbox','production')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references pdf_uploads(id) on delete set null,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists qbo_pushes (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references pdf_uploads(id) on delete cascade,
  environment text not null,
  proposed_payload jsonb,
  qbo_response jsonb,
  qbo_transaction_id text,
  status text not null default 'pending'
    check (status in ('pending','pushed','error')),
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
