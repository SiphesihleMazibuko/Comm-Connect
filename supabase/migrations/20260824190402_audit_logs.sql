

create schema if not exists private;

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  table_schema text not null,
  table_name text not null,
  record_id text,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id uuid,
  actor_email text,
  old_record jsonb,
  new_record jsonb,
  changed_fields text[],
  request_id text,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create index if not exists audit_logs_table_record_idx
on public.audit_logs (table_schema, table_name, record_id);

create index if not exists audit_logs_actor_created_idx
on public.audit_logs (actor_id, created_at desc);

create index if not exists audit_logs_created_idx
on public.audit_logs (created_at desc);

create index if not exists audit_logs_changed_fields_idx
on public.audit_logs using gin (changed_fields);

drop policy if exists "Community leaders can read audit logs" on public.audit_logs;
create policy "Community leaders can read audit logs"
on public.audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.users
    where users.id = (select auth.uid())
      and users.role in ('community_leader', 'leader')
  )
);

revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

create or replace function private.audit_changed_fields(old_row jsonb, new_row jsonb)
returns text[]
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(array_agg(key order by key), array[]::text[])
  from (
    select key
    from jsonb_each(old_row)
    where old_row -> key is distinct from new_row -> key

    union

    select key
    from jsonb_each(new_row)
    where old_row -> key is distinct from new_row -> key
  ) changed;
$$;

create or replace function private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  old_row jsonb;
  new_row jsonb;
  audit_record_id text;
begin
  if tg_table_schema = 'public' and tg_table_name = 'audit_logs' then
    return coalesce(new, old);
  end if;

  old_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  audit_record_id := coalesce(new_row ->> 'id', old_row ->> 'id');

  insert into public.audit_logs (
    table_schema,
    table_name,
    record_id,
    operation,
    actor_id,
    actor_email,
    old_record,
    new_record,
    changed_fields,
    request_id
  )
  values (
    tg_table_schema,
    tg_table_name,
    audit_record_id,
    tg_op,
    auth.uid(),
    nullif(current_setting('request.jwt.claim.email', true), ''),
    old_row,
    new_row,
    case
      when tg_op = 'UPDATE' then private.audit_changed_fields(old_row, new_row)
      else null
    end,
    nullif(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id', '')
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_changed_fields(jsonb, jsonb) from public;
revoke all on function private.write_audit_log() from public;

drop trigger if exists audit_users_changes on public.users;
create trigger audit_users_changes
after insert or update or delete on public.users
for each row execute function private.write_audit_log();

drop trigger if exists audit_pinpoints_changes on public.pinpoints;
create trigger audit_pinpoints_changes
after insert or update or delete on public.pinpoints
for each row execute function private.write_audit_log();

drop trigger if exists audit_posts_changes on public.posts;
create trigger audit_posts_changes
after insert or update or delete on public.posts
for each row execute function private.write_audit_log();

drop trigger if exists audit_reports_changes on public.reports;
create trigger audit_reports_changes
after insert or update or delete on public.reports
for each row execute function private.write_audit_log();

drop trigger if exists audit_emergency_dispatches_changes on public.emergency_dispatches;
create trigger audit_emergency_dispatches_changes
after insert or update or delete on public.emergency_dispatches
for each row execute function private.write_audit_log();

drop trigger if exists audit_cps_duty_sessions_changes on public.cps_duty_sessions;
create trigger audit_cps_duty_sessions_changes
after insert or update or delete on public.cps_duty_sessions
for each row execute function private.write_audit_log();

drop trigger if exists audit_emergency_requests_changes on public."emergencyRequests";
create trigger audit_emergency_requests_changes
after insert or update or delete on public."emergencyRequests"
for each row execute function private.write_audit_log();

do $$
begin
  if to_regclass('public.emergency_contacts') is not null then
    drop trigger if exists audit_emergency_contacts_changes on public.emergency_contacts;
    create trigger audit_emergency_contacts_changes
    after insert or update or delete on public.emergency_contacts
    for each row execute function private.write_audit_log();
  end if;
end;
$$;

notify pgrst, 'reload schema';
