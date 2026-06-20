-- app_settings: global key/value config (bank_account, ap_vendor,
-- discount_adjustment_enabled, discount_inventory_account, discount_expense_account, ...)
-- This table already exists live in Supabase; this migration documents it for
-- disaster-recovery / schema parity and is a no-op against the live database.
create table if not exists app_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);
