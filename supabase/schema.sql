
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  "firstName" text,
  "lastName" text,
  email text,
  "phoneNumber" text,
  "idNumber" text,
  location text,
  role text not null default 'resident',
  "organizationName" text,
  "responderType" text,
  "serviceType" text,
  "wardName" text,
  province_id uuid,
  city_id uuid,
  suburb_id uuid,
  zone_id uuid,
  ward_id uuid,
  permissions jsonb not null default '{}'::jsonb,
  language text not null default 'en',
  "createdAt" timestamptz not null default now(),
  "isMockUser" boolean not null default false
);

alter table public.users add column if not exists "wardName" text;
alter table public.users add column if not exists "serviceType" text;
alter table public.users add column if not exists "responderType" text;
alter table public.users add column if not exists province_id uuid;
alter table public.users add column if not exists city_id uuid;
alter table public.users add column if not exists suburb_id uuid;
alter table public.users add column if not exists zone_id uuid;
alter table public.users add column if not exists ward_id uuid;

alter table public.users enable row level security;

create schema if not exists private;

create or replace function private.current_user_ward_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select users.ward_id
  from public.users
  where users.id = auth.uid();
$$;

revoke all on function private.current_user_ward_id() from public;
grant usage on schema private to authenticated;
grant execute on function private.current_user_ward_id() to authenticated;

drop policy if exists "Users can read their own profile" on public.users;
create policy "Users can read their own profile"
on public.users
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users can read ward CPF member profiles" on public.users;
create policy "Users can read ward CPF member profiles"
on public.users
for select
to authenticated
using (
  role in ('community_protection_service', 'emergency_responder')
  and ward_id is not null
  and ward_id = private.current_user_ward_id()
);

drop policy if exists "Users can create their own profile" on public.users;
create policy "Users can create their own profile"
on public.users
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create or replace function public.prevent_self_provisioned_responder_accounts()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' and new.role in ('community_protection_service', 'emergency_responder') then
    raise exception 'CPF accounts must be provisioned by an administrator';
  end if;

  if tg_op = 'UPDATE'
    and new.role is distinct from old.role
    and new.role in ('community_protection_service', 'emergency_responder')
  then
    raise exception 'CPF accounts must be provisioned by an administrator';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_self_provisioned_responder_accounts() from public;

drop trigger if exists prevent_self_provisioned_responder_accounts on public.users;
create trigger prevent_self_provisioned_responder_accounts
before insert or update on public.users
for each row execute function public.prevent_self_provisioned_responder_accounts();

create table if not exists public.pinpoints (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  label text not null,
  "digitalAddress" text not null,
  latitude double precision not null,
  longitude double precision not null,
  "mapsUrl" text,
  "qrPayload" text,
  "createdAt" timestamptz not null default now()
);

alter table public.pinpoints enable row level security;

drop policy if exists "Users can read their own pinpoints" on public.pinpoints;
create policy "Users can read their own pinpoints"
on public.pinpoints
for select
to authenticated
using ("userId" = auth.uid());

drop policy if exists "Users can create their own pinpoints" on public.pinpoints;
create policy "Users can create their own pinpoints"
on public.pinpoints
for insert
to authenticated
with check ("userId" = auth.uid());

drop policy if exists "Users can update their own pinpoints" on public.pinpoints;
create policy "Users can update their own pinpoints"
on public.pinpoints
for update
to authenticated
using ("userId" = auth.uid())
with check ("userId" = auth.uid());

drop policy if exists "Users can delete their own pinpoints" on public.pinpoints;
create policy "Users can delete their own pinpoints"
on public.pinpoints
for delete
to authenticated
using ("userId" = auth.uid());

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  description text not null,
  "createdBy" uuid references auth.users(id) on delete set null,
  "createdByName" text,
  "createdAt" timestamptz not null default now(),
  status text not null default 'approved',
  priority text not null default 'normal',
  "sourceReportId" uuid,
  "archivedAt" timestamptz,
  "archivedBy" uuid references auth.users(id) on delete set null
);

alter table public.posts add column if not exists "archivedAt" timestamptz;
alter table public.posts add column if not exists "archivedBy" uuid references auth.users(id) on delete set null;
alter table public.posts add column if not exists ward_id uuid;
alter table public.posts add column if not exists suburb_id uuid;

alter table public.posts enable row level security;

drop policy if exists "Authenticated users can read posts" on public.posts;
create policy "Authenticated users can read posts"
on public.posts
for select
to authenticated
using (
  coalesce(status, 'approved') <> 'archived'
  or exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and users.role in ('community_leader', 'leader')
  )
);

drop policy if exists "Authenticated users can create posts" on public.posts;
create policy "Authenticated users can create posts"
on public.posts
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update posts" on public.posts;
drop policy if exists "Community leaders can update posts" on public.posts;
create policy "Community leaders can update posts"
on public.posts
for update
to authenticated
using (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and users.role in ('community_leader', 'leader')
  )
)
with check (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and users.role in ('community_leader', 'leader')
  )
);

drop policy if exists "Authenticated users can delete posts" on public.posts;
drop policy if exists "Only community leaders can delete posts" on public.posts;
create policy "Only community leaders can delete posts"
on public.posts
for delete
to authenticated
using (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and users.role in ('community_leader', 'leader')
  )
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid references auth.users(id) on delete set null,
  "submittedBy" uuid not null references auth.users(id) on delete cascade,
  "reportType" text not null,
  "crimeCategory" text,
  "otherCategory" text,
  description text not null,
  "photoUrls" text[] not null default array[]::text[],
  location jsonb,
  anonymous boolean not null default false,
  status text not null default 'pending_review',
  "createdAt" timestamptz not null default now(),
  "approvedAt" timestamptz,
  "approvedBy" uuid references auth.users(id) on delete set null,
  "dispatchedServices" text[] not null default array[]::text[]
);

alter table public.reports add column if not exists "crimeCategory" text;
alter table public.reports add column if not exists "otherCategory" text;
alter table public.reports add column if not exists ward_id uuid;
alter table public.reports add column if not exists suburb_id uuid;

alter table public.reports enable row level security;

drop policy if exists "Authenticated users can read reports" on public.reports;
create policy "Authenticated users can read reports"
on public.reports
for select
to authenticated
using (true);

drop policy if exists "Users can create reports" on public.reports;
create policy "Users can create reports"
on public.reports
for insert
to authenticated
with check ("submittedBy" = auth.uid());

drop policy if exists "Authenticated users can update reports" on public.reports;
create policy "Authenticated users can update reports"
on public.reports
for update
to authenticated
using (true)
with check (true);

create table if not exists public.emergency_dispatches (
  id uuid primary key default gen_random_uuid(),
  "reportId" uuid references public.reports(id) on delete cascade,
  "serviceType" text not null,
  "reportType" text,
  description text,
  location jsonb,
  "dispatchedAt" timestamptz not null default now(),
  "dispatchedBy" uuid references auth.users(id) on delete set null,
  status text not null default 'pending',
  acknowledged boolean not null default false,
  "responderId" uuid references auth.users(id) on delete set null,
  "pendingAt" timestamptz,
  "en_routeAt" timestamptz,
  "on_sceneAt" timestamptz,
  "resolvedAt" timestamptz
);

alter table public.emergency_dispatches enable row level security;
alter table public.emergency_dispatches add column if not exists ward_id uuid;
alter table public.emergency_dispatches add column if not exists suburb_id uuid;

drop policy if exists "Authenticated users can read dispatches" on public.emergency_dispatches;
create policy "Authenticated users can read dispatches"
on public.emergency_dispatches
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can create dispatches" on public.emergency_dispatches;
create policy "Authenticated users can create dispatches"
on public.emergency_dispatches
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update dispatches" on public.emergency_dispatches;
create policy "Authenticated users can update dispatches"
on public.emergency_dispatches
for update
to authenticated
using (true)
with check (true);

create table if not exists public.cps_duty_sessions (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  "memberName" text,
  ward_id uuid,
  "wardName" text,
  "clockedInAt" timestamptz not null default now(),
  "clockedOffAt" timestamptz,
  status text not null default 'on_duty'
);

alter table public.cps_duty_sessions enable row level security;

drop policy if exists "CPS members can read ward duty sessions" on public.cps_duty_sessions;
create policy "CPS members can read ward duty sessions"
on public.cps_duty_sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and users.role in ('community_protection_service', 'emergency_responder')
      and users.ward_id = cps_duty_sessions.ward_id
  )
);

drop policy if exists "CPS members can clock themselves in" on public.cps_duty_sessions;
create policy "CPS members can clock themselves in"
on public.cps_duty_sessions
for insert
to authenticated
with check (
  "userId" = auth.uid()
  and exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and users.role in ('community_protection_service', 'emergency_responder')
      and users.ward_id = cps_duty_sessions.ward_id
  )
);

drop policy if exists "CPS members can update their own duty session" on public.cps_duty_sessions;
create policy "CPS members can update their own duty session"
on public.cps_duty_sessions
for update
to authenticated
using ("userId" = auth.uid())
with check ("userId" = auth.uid());

create table if not exists public."emergencyRequests" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid references auth.users(id) on delete set null,
  "userName" text,
  "userPhone" text,
  "emergencyType" text not null,
  description text,
  "contactDetails" text,
  location jsonb,
  status text not null default 'pending',
  "createdAt" timestamptz not null default now(),
  "responderId" uuid references auth.users(id) on delete set null,
  "responderName" text,
  "respondedAt" timestamptz,
  "completedAt" timestamptz,
  "responderNotes" text
);

alter table public."emergencyRequests" enable row level security;
alter table public."emergencyRequests" add column if not exists ward_id uuid;
alter table public."emergencyRequests" add column if not exists suburb_id uuid;

drop policy if exists "Authenticated users can read emergency requests" on public."emergencyRequests";
create policy "Authenticated users can read emergency requests"
on public."emergencyRequests"
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can create emergency requests" on public."emergencyRequests";
create policy "Authenticated users can create emergency requests"
on public."emergencyRequests"
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update emergency requests" on public."emergencyRequests";
create policy "Authenticated users can update emergency requests"
on public."emergencyRequests"
for update
to authenticated
using (true)
with check (true);

create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references auth.users(id) on delete cascade,
  name text not null,
  relationship text,
  phone text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

alter table public.emergency_contacts enable row level security;

create index if not exists emergency_contacts_user_idx
on public.emergency_contacts ("userId", "createdAt");

drop policy if exists "Users can read their own emergency contacts" on public.emergency_contacts;
create policy "Users can read their own emergency contacts"
on public.emergency_contacts
for select
to authenticated
using ("userId" = (select auth.uid()));

drop policy if exists "Users can create their own emergency contacts" on public.emergency_contacts;
create policy "Users can create their own emergency contacts"
on public.emergency_contacts
for insert
to authenticated
with check ("userId" = (select auth.uid()));

drop policy if exists "Users can update their own emergency contacts" on public.emergency_contacts;
create policy "Users can update their own emergency contacts"
on public.emergency_contacts
for update
to authenticated
using ("userId" = (select auth.uid()))
with check ("userId" = (select auth.uid()));

drop policy if exists "Users can delete their own emergency contacts" on public.emergency_contacts;
create policy "Users can delete their own emergency contacts"
on public.emergency_contacts
for delete
to authenticated
using ("userId" = (select auth.uid()));

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.users to authenticated;
grant select, insert, update, delete on public.pinpoints to authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, insert, update on public.emergency_dispatches to authenticated;
grant select, insert, update on public.cps_duty_sessions to authenticated;
grant select, insert, update on public."emergencyRequests" to authenticated;
grant select, insert, update, delete on public.emergency_contacts to authenticated;

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  table_schema text not null,
  table_name text not null,
  record_id text,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id uuid,
  actor_email text,
  actor_display_name text,
  record_label text,
  action_summary text,
  old_record jsonb,
  new_record jsonb,
  changed_fields text[],
  change_details jsonb not null default '[]'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

alter table public.audit_logs add column if not exists actor_display_name text;
alter table public.audit_logs add column if not exists record_label text;
alter table public.audit_logs add column if not exists action_summary text;
alter table public.audit_logs add column if not exists change_details jsonb not null default '[]'::jsonb;

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
    from jsonb_each(coalesce(old_row, '{}'::jsonb))
    where coalesce(old_row, '{}'::jsonb) -> key is distinct from coalesce(new_row, '{}'::jsonb) -> key

    union

    select key
    from jsonb_each(coalesce(new_row, '{}'::jsonb))
    where coalesce(old_row, '{}'::jsonb) -> key is distinct from coalesce(new_row, '{}'::jsonb) -> key
  ) changed;
$$;

create or replace function private.audit_change_details(old_row jsonb, new_row jsonb)
returns jsonb
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'field',
        key,
        'oldValue',
        coalesce(old_row, '{}'::jsonb) -> key,
        'newValue',
        coalesce(new_row, '{}'::jsonb) -> key
      )
      order by key
    ),
    '[]'::jsonb
  )
  from unnest(private.audit_changed_fields(old_row, new_row)) as fields(key);
$$;

create or replace function private.audit_record_label(row_data jsonb)
returns text
language sql
stable
set search_path = pg_catalog
as $$
  select nullif(
    coalesce(
      row_data ->> 'title',
      row_data ->> 'label',
      row_data ->> 'name',
      row_data ->> 'email',
      row_data ->> 'memberName',
      row_data ->> 'emergencyType',
      row_data ->> 'reportType',
      row_data ->> 'digitalAddress',
      row_data ->> 'description',
      row_data ->> 'id'
    ),
    ''
  );
$$;

create or replace function private.audit_actor_display_name(actor uuid)
returns text
language sql
stable
set search_path = pg_catalog, public
as $$
  select nullif(
    concat_ws(
      ' ',
      nullif(users."firstName", ''),
      nullif(users."lastName", '')
    ),
    ''
  )
  from public.users
  where users.id = actor;
$$;

create or replace function private.audit_action_summary(
  table_name text,
  operation text,
  record_label text,
  changed_fields text[]
)
returns text
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  readable_table text;
  field_count integer;
  field_preview text;
  target text;
begin
  readable_table := replace(table_name, '_', ' ');
  field_count := coalesce(array_length(changed_fields, 1), 0);
  field_preview := array_to_string(changed_fields[1:3], ', ');
  target := case
    when record_label is null then readable_table
    else readable_table || ' "' || left(record_label, 80) || '"'
  end;

  if operation = 'INSERT' then
    return 'Created ' || target;
  end if;

  if operation = 'DELETE' then
    return 'Deleted ' || target;
  end if;

  if field_count = 0 then
    return 'Updated ' || target || ' without field changes';
  end if;

  if field_count = 1 then
    return 'Updated ' || target || ': ' || field_preview;
  end if;

  return 'Updated ' || target || ': ' || field_count || ' fields (' || field_preview || case when field_count > 3 then ', ...' else '' end || ')';
end;
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
  changed text[];
  details jsonb;
  audit_record_id text;
  label text;
  actor uuid;
  actor_email text;
  actor_name text;
begin
  if tg_table_schema = 'public' and tg_table_name = 'audit_logs' then
    return coalesce(new, old);
  end if;

  old_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  changed := case
    when tg_op = 'UPDATE' then private.audit_changed_fields(old_row, new_row)
    when tg_op = 'INSERT' then private.audit_changed_fields('{}'::jsonb, new_row)
    else private.audit_changed_fields(old_row, '{}'::jsonb)
  end;
  details := private.audit_change_details(
    case when tg_op = 'INSERT' then '{}'::jsonb else old_row end,
    case when tg_op = 'DELETE' then '{}'::jsonb else new_row end
  );
  audit_record_id := coalesce(new_row ->> 'id', old_row ->> 'id');
  label := private.audit_record_label(coalesce(new_row, old_row));
  actor := auth.uid();
  actor_email := nullif(current_setting('request.jwt.claim.email', true), '');
  actor_name := private.audit_actor_display_name(actor);

  insert into public.audit_logs (
    table_schema,
    table_name,
    record_id,
    operation,
    actor_id,
    actor_email,
    actor_display_name,
    record_label,
    action_summary,
    old_record,
    new_record,
    changed_fields,
    change_details,
    request_id
  )
  values (
    tg_table_schema,
    tg_table_name,
    audit_record_id,
    tg_op,
    actor,
    actor_email,
    coalesce(actor_name, actor_email),
    label,
    private.audit_action_summary(tg_table_name, tg_op, label, changed),
    old_row,
    new_row,
    changed,
    details,
    nullif(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id', '')
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_changed_fields(jsonb, jsonb) from public;
revoke all on function private.audit_change_details(jsonb, jsonb) from public;
revoke all on function private.audit_record_label(jsonb) from public;
revoke all on function private.audit_actor_display_name(uuid) from public;
revoke all on function private.audit_action_summary(text, text, text, text[]) from public;
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

drop trigger if exists audit_emergency_contacts_changes on public.emergency_contacts;
create trigger audit_emergency_contacts_changes
after insert or update or delete on public.emergency_contacts
for each row execute function private.write_audit_log();

notify pgrst, 'reload schema';
