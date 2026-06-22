-- Seed each new tenant with their own copy of the default accounting
-- mapping rules (same 7 rows as the original global seed in 001_initial.sql),
-- scoped to their user_id. Implemented as a trigger on auth.users so it
-- happens exactly once, atomically, regardless of which path provisions
-- the user.

create or replace function public.seed_default_mappings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounting_mappings
    (user_id, match_type, match_field, match_value, qbo_account_name, treatment, default_memo, priority)
  values
    (new.id, 'exact',    'doc_type',  'RU',        null, 'carry_forward', 'Unapplied D.D. carry-forward',       100),
    (new.id, 'contains', 'remarks',   'UNAPPLIED', null, 'carry_forward', 'Unapplied D.D. carry-forward',        90),
    (new.id, 'contains', 'remarks',   'ADV/FF',    null, 'include',       'Advertising/Franchise Fee — map me',  80),
    (new.id, 'exact',    'doc_type',  'RI',        null, 'include',       'RI row — map me',                     70),
    (new.id, 'exact',    'doc_type',  'SO',        null, 'include',       'Sales Order — map me',                60),
    (new.id, 'exact',    'doc_type',  'RM',        null, 'include',       'Rebate/Credit',                       50),
    (new.id, 'exact',    'doc_type',  'SR',        null, 'include',       'Sales Return — map me',               40);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seed_mappings on auth.users;
create trigger on_auth_user_created_seed_mappings
  after insert on auth.users
  for each row execute function public.seed_default_mappings();

-- This function is only meant to run as a trigger (it references the `new`
-- pseudo-record, which only exists in a trigger context). Revoke direct API
-- callability so it can't be invoked via PostgREST RPC by anon/authenticated.
revoke execute on function public.seed_default_mappings() from anon, authenticated, public;
