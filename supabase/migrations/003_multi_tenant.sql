-- Multi-tenant conversion, step 1: additive, nullable, zero risk to live data.
-- user_id columns are added NULLABLE here on purpose — they are backfilled
-- by hand after the owner's first login, then locked down to NOT NULL (and
-- RLS enabled) in migration 005. Do not add NOT NULL or RLS in this file.

alter table pdf_uploads        add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table report_headers     add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table line_items         add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table customer_totals    add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table accounting_mappings add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table qbo_connections    add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table audit_logs         add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table qbo_pushes         add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table app_settings       add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_pdf_uploads_user_id        on pdf_uploads(user_id);
create index if not exists idx_report_headers_user_id     on report_headers(user_id);
create index if not exists idx_line_items_user_id         on line_items(user_id);
create index if not exists idx_customer_totals_user_id    on customer_totals(user_id);
create index if not exists idx_accounting_mappings_user_id on accounting_mappings(user_id);
create index if not exists idx_qbo_connections_user_id    on qbo_connections(user_id);
create index if not exists idx_audit_logs_user_id         on audit_logs(user_id);
create index if not exists idx_qbo_pushes_user_id         on qbo_pushes(user_id);
create index if not exists idx_app_settings_user_id       on app_settings(user_id);

-- One QBO connection per tenant, not one globally.
alter table qbo_connections drop constraint if exists qbo_connections_realm_id_key;
alter table qbo_connections add constraint qbo_connections_user_id_key unique (user_id);

-- app_settings primary key stays as-is (key only) until migration 005 — a
-- composite (user_id, key) primary key would force NOT NULL immediately,
-- which would break before backfill happens. Add a plain (nullable-safe)
-- unique constraint now so the app's upsert (onConflict: 'user_id,key')
-- works immediately on deploy, ahead of the eventual PK swap in 005.
alter table app_settings add constraint app_settings_user_key_unique unique (user_id, key);
