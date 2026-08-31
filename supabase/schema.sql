
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

drop policy if exists "Users can read their own profile" on public.users;
create policy "Users can read their own profile"
on public.users
for select
to authenticated
using (id = auth.uid());

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

drop trigger if exists audit_emergency_contacts_changes on public.emergency_contacts;
create trigger audit_emergency_contacts_changes
after insert or update or delete on public.emergency_contacts
for each row execute function private.write_audit_log();

notify pgrst, 'reload schema';
