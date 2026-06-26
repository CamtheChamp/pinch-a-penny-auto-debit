-- app_settings still had its original single-column primary key (key alone),
-- which blocks ANY second tenant from ever saving a setting whose key the
-- first tenant already used (e.g. "bank_account") — a real multi-tenant bug,
-- not just a migration-005 nice-to-have. Safe to apply now because every
-- existing row already has a non-null user_id (post-backfill).
alter table app_settings drop constraint if exists app_settings_pkey;
alter table app_settings alter column user_id set not null;
alter table app_settings drop constraint if exists app_settings_user_key_unique;
alter table app_settings add primary key (user_id, key);
