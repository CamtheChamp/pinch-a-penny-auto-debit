-- Run only after confirming zero NULL user_id rows remain in every
-- user-scoped table (the manual backfill step). Locks tenant isolation in
-- at the database level via RLS, on top of the existing application-level
-- user_id filters (defense in depth, not a replacement for either layer).

alter table pdf_uploads        alter column user_id set not null;
alter table report_headers     alter column user_id set not null;
alter table line_items         alter column user_id set not null;
alter table customer_totals    alter column user_id set not null;
alter table accounting_mappings alter column user_id set not null;
alter table qbo_connections    alter column user_id set not null;
alter table audit_logs         alter column user_id set not null;
alter table qbo_pushes         alter column user_id set not null;
-- app_settings.user_id was already set NOT NULL in migration 006 (applied
-- ahead of this one, out of order, to fix a live multi-tenant bug).

alter table pdf_uploads        enable row level security;
alter table report_headers     enable row level security;
alter table line_items         enable row level security;
alter table customer_totals    enable row level security;
alter table accounting_mappings enable row level security;
alter table qbo_connections    enable row level security;
alter table audit_logs         enable row level security;
alter table qbo_pushes         enable row level security;
alter table app_settings       enable row level security;

create policy tenant_isolation_select on pdf_uploads for select using (user_id = auth.uid());
create policy tenant_isolation_insert on pdf_uploads for insert with check (user_id = auth.uid());
create policy tenant_isolation_update on pdf_uploads for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tenant_isolation_delete on pdf_uploads for delete using (user_id = auth.uid());

create policy tenant_isolation_select on report_headers for select using (user_id = auth.uid());
create policy tenant_isolation_insert on report_headers for insert with check (user_id = auth.uid());
create policy tenant_isolation_update on report_headers for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tenant_isolation_delete on report_headers for delete using (user_id = auth.uid());

create policy tenant_isolation_select on line_items for select using (user_id = auth.uid());
create policy tenant_isolation_insert on line_items for insert with check (user_id = auth.uid());
create policy tenant_isolation_update on line_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tenant_isolation_delete on line_items for delete using (user_id = auth.uid());

create policy tenant_isolation_select on customer_totals for select using (user_id = auth.uid());
create policy tenant_isolation_insert on customer_totals for insert with check (user_id = auth.uid());
create policy tenant_isolation_update on customer_totals for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tenant_isolation_delete on customer_totals for delete using (user_id = auth.uid());

create policy tenant_isolation_select on accounting_mappings for select using (user_id = auth.uid());
create policy tenant_isolation_insert on accounting_mappings for insert with check (user_id = auth.uid());
create policy tenant_isolation_update on accounting_mappings for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tenant_isolation_delete on accounting_mappings for delete using (user_id = auth.uid());

create policy tenant_isolation_select on qbo_connections for select using (user_id = auth.uid());
create policy tenant_isolation_insert on qbo_connections for insert with check (user_id = auth.uid());
create policy tenant_isolation_update on qbo_connections for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tenant_isolation_delete on qbo_connections for delete using (user_id = auth.uid());

create policy tenant_isolation_select on audit_logs for select using (user_id = auth.uid());
create policy tenant_isolation_insert on audit_logs for insert with check (user_id = auth.uid());
create policy tenant_isolation_update on audit_logs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tenant_isolation_delete on audit_logs for delete using (user_id = auth.uid());

create policy tenant_isolation_select on qbo_pushes for select using (user_id = auth.uid());
create policy tenant_isolation_insert on qbo_pushes for insert with check (user_id = auth.uid());
create policy tenant_isolation_update on qbo_pushes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tenant_isolation_delete on qbo_pushes for delete using (user_id = auth.uid());

create policy tenant_isolation_select on app_settings for select using (user_id = auth.uid());
create policy tenant_isolation_insert on app_settings for insert with check (user_id = auth.uid());
create policy tenant_isolation_update on app_settings for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tenant_isolation_delete on app_settings for delete using (user_id = auth.uid());
