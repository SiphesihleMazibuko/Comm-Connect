-- Run this in Supabase Dashboard > SQL Editor.
-- It creates the tables required by the app.

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

-- Store ID numbers as keyed HMACs in a non-exposed schema. The trigger keeps
-- the legacy input column empty so existing profile inserts remain compatible.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.id_number_hmac_key (
  singleton boolean primary key default true check (singleton),
  secret bytea not null
);
insert into private.id_number_hmac_key (singleton, secret)
values (true, extensions.gen_random_bytes(32))
on conflict (singleton) do nothing;

create table if not exists private.user_identity_hashes (
  user_id uuid primary key references public.users(id) on delete cascade,
  id_number_hmac text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on private.id_number_hmac_key from public, anon, authenticated;
revoke all on private.user_identity_hashes from public, anon, authenticated;

create or replace function public.protect_user_id_number()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  normalized_id text;
  hmac_key bytea;
begin
  normalized_id := nullif(regexp_replace(coalesce(new."idNumber", ''), '[[:space:]]', '', 'g'), '');
  if normalized_id is not null then
    select secret into strict hmac_key
    from private.id_number_hmac_key where singleton = true;
    insert into private.user_identity_hashes (user_id, id_number_hmac, updated_at)
    values (
      new.id,
      encode(extensions.hmac(convert_to(normalized_id, 'UTF8'), hmac_key, 'sha256'), 'hex'),
      now()
    )
    on conflict (user_id) do update
      set id_number_hmac = excluded.id_number_hmac,
          updated_at = excluded.updated_at;
  end if;
  new."idNumber" := null;
  return new;
end;
$$;
revoke all on function public.protect_user_id_number() from public, anon, authenticated;
drop trigger if exists protect_user_id_number on public.users;
create trigger protect_user_id_number
before insert or update of "idNumber" on public.users
for each row execute function public.protect_user_id_number();

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

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.users to authenticated;
grant select, insert, update, delete on public.pinpoints to authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, insert, update on public.emergency_dispatches to authenticated;
grant select, insert, update on public.cps_duty_sessions to authenticated;
grant select, insert, update on public."emergencyRequests" to authenticated;

-- Security hardening: privileged roles are requests until a trusted backend/admin
-- approves them. Client-side tab visibility is not an authorization boundary.
alter table public.users add column if not exists "requestedRole" text;
alter table public.users add column if not exists "approvalStatus" text not null default 'approved';

create or replace function public.protect_user_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.role in ('community_leader', 'leader', 'community_protection_service', 'emergency_responder') then
      new."requestedRole" := new.role;
      new.role := 'resident';
      new."approvalStatus" := 'pending';
      new.permissions := coalesce(new.permissions, '{}'::jsonb) || jsonb_build_object(
        'canReviewReports', false,
        'canRespondToEmergency', false,
        'canClockInForDuty', false,
        'canSendCommunityAlerts', false
      );
    else
      new."approvalStatus" := 'approved';
    end if;
  elsif auth.role() = 'authenticated'
    and current_setting('app.signup_profile_completion_user', true) is distinct from auth.uid()::text
    and (
    new.role is distinct from old.role
    or new."requestedRole" is distinct from old."requestedRole"
    or new."approvalStatus" is distinct from old."approvalStatus"
  ) then
    raise exception 'Only an administrator may change account roles or approval status';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_user_privileges_trigger on public.users;
create trigger protect_user_privileges_trigger
before insert or update on public.users
for each row execute function public.protect_user_privileges();

-- Signup RPC verifies the session, sources phone from auth.users, and stores
-- only a keyed ID digest in the private schema.
create or replace function public.complete_my_signup_profile(p_profile jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth, extensions
as $$
declare
  caller_id uuid := auth.uid();
  requested_role text := coalesce(p_profile->>'requestedRole', 'resident');
  normalized_id text := regexp_replace(coalesce(p_profile->>'idNumber', ''), '[[:space:]]', '', 'g');
  verified_phone text;
  hmac_key bytea;
  candidate_hmac text;
  existing_hmac text;
begin
  if caller_id is null then raise exception 'Authentication is required to complete signup' using errcode = '42501'; end if;
  if requested_role not in ('resident', 'community_leader', 'community_protection_service') then raise exception 'Invalid signup role' using errcode = '22023'; end if;
  if nullif(trim(coalesce(p_profile->>'firstName', '')), '') is null
    or nullif(trim(coalesce(p_profile->>'lastName', '')), '') is null
    or nullif(trim(coalesce(p_profile->>'email', '')), '') is null then
    raise exception 'First name, last name, and email are required' using errcode = '22023';
  end if;
  if normalized_id !~ '^[0-9]{13}$' then raise exception 'A valid 13-digit ID number is required' using errcode = '22023'; end if;

  select phone into verified_phone from auth.users where id = caller_id;
  if nullif(verified_phone, '') is null then raise exception 'A verified phone number is required to complete signup' using errcode = '22023'; end if;
  select secret into strict hmac_key from private.id_number_hmac_key where singleton = true;
  candidate_hmac := encode(extensions.hmac(convert_to(normalized_id, 'UTF8'), hmac_key, 'sha256'), 'hex');
  select id_number_hmac into existing_hmac from private.user_identity_hashes where user_id = caller_id;
  if existing_hmac is not null and existing_hmac <> candidate_hmac then raise exception 'An ID number is already protected for this account' using errcode = '23505'; end if;
  perform set_config('app.signup_profile_completion_user', caller_id::text, true);
  insert into public.users (
    id, "firstName", "lastName", email, "phoneNumber", "idNumber", location,
    role, "requestedRole", "approvalStatus"
  ) values (
    caller_id, trim(p_profile->>'firstName'), trim(p_profile->>'lastName'),
    lower(trim(p_profile->>'email')), verified_phone, null,
    nullif(trim(coalesce(p_profile->>'location', '')), ''), 'resident',
    case when requested_role = 'resident' then null else requested_role end,
    case when requested_role = 'resident' then 'approved' else 'pending' end
  ) on conflict (id) do nothing;

  update public.users set
    "firstName" = trim(p_profile->>'firstName'), "lastName" = trim(p_profile->>'lastName'), email = lower(trim(p_profile->>'email')),
    "phoneNumber" = verified_phone, "idNumber" = null, location = nullif(trim(coalesce(p_profile->>'location', '')), ''),
    role = 'resident', "requestedRole" = case when requested_role = 'resident' then null else requested_role end,
    "approvalStatus" = case when requested_role = 'resident' then 'approved' else 'pending' end,
    "organizationName" = nullif(trim(coalesce(p_profile->>'organizationName', '')), ''),
    "responderType" = case when requested_role = 'community_protection_service' then 'community_protection_service' else null end,
    "serviceType" = case when requested_role = 'community_protection_service' then 'community_protection_service' else null end,
    "wardName" = case when requested_role = 'community_protection_service' then nullif(trim(coalesce(p_profile->>'wardName', '')), '') else null end,
    province_id = nullif(p_profile->>'province_id', '')::uuid, city_id = nullif(p_profile->>'city_id', '')::uuid,
    suburb_id = nullif(p_profile->>'suburb_id', '')::uuid, zone_id = nullif(p_profile->>'zone_id', '')::uuid,
    ward_id = nullif(p_profile->>'ward_id', '')::uuid,
    permissions = jsonb_build_object('locationEnabled', false, 'notificationsEnabled', false,
      'manualWardNumber', nullif(p_profile->'permissions'->>'manualWardNumber', ''),
      'pinpointAddress', p_profile->'permissions'->'pinpointAddress', 'canReportIncident', true,
      'canRequestEmergency', true, 'canReviewReports', false, 'canRespondToEmergency', false,
      'canClockInForDuty', false, 'canSendCommunityAlerts', false)
  where id = caller_id;
  if not found then raise exception 'Signup profile was not created for this account'; end if;
  insert into private.user_identity_hashes (user_id, id_number_hmac)
  values (caller_id, candidate_hmac) on conflict (user_id) do nothing;
end;
$$;
revoke all on function public.complete_my_signup_profile(jsonb) from public, anon;
grant execute on function public.complete_my_signup_profile(jsonb) to authenticated;

-- Reports can be updated by their submitter or an approved community leader.
drop policy if exists "Authenticated users can update reports" on public.reports;
create policy "Owners and leaders can update reports"
on public.reports
for update
to authenticated
using (
  "submittedBy" = auth.uid()
  or exists (
    select 1 from public.users
    where users.id = auth.uid()
      and users.role in ('community_leader', 'leader')
      and users."approvalStatus" = 'approved'
  )
)
with check (
  "submittedBy" = auth.uid()
  or exists (
    select 1 from public.users
    where users.id = auth.uid()
      and users.role in ('community_leader', 'leader')
      and users."approvalStatus" = 'approved'
  )
);

-- Only approved responder accounts may create or change dispatches.
drop policy if exists "Authenticated users can create dispatches" on public.emergency_dispatches;
create policy "Responders can create dispatches"
on public.emergency_dispatches
for insert
to authenticated
with check (
  "dispatchedBy" = auth.uid()
  and exists (
    select 1 from public.users
    where users.id = auth.uid()
      and users.role in ('community_protection_service', 'emergency_responder')
      and users."approvalStatus" = 'approved'
  )
);

drop policy if exists "Authenticated users can update dispatches" on public.emergency_dispatches;
create policy "Responders can update dispatches"
on public.emergency_dispatches
for update
to authenticated
using (
  exists (
    select 1 from public.users
    where users.id = auth.uid()
      and users.role in ('community_protection_service', 'emergency_responder')
      and users."approvalStatus" = 'approved'
  )
)
with check (
  exists (
    select 1 from public.users
    where users.id = auth.uid()
      and users.role in ('community_protection_service', 'emergency_responder')
      and users."approvalStatus" = 'approved'
  )
);

-- Masked user directory and full approved-admin access. Normal users retain
-- full access only to their own profile through the existing users RLS policy.
create or replace function public.mask_name(value text, visible_characters integer default 2)
returns text language sql immutable set search_path = public
as $$
  select case when nullif(trim(value), '') is null then null
    else left(trim(value), greatest(1, visible_characters)) || '***' end
$$;

create or replace function public.mask_phone(value text)
returns text language sql immutable set search_path = public
as $$
  select case when nullif(trim(value), '') is null then null
    else repeat('*', greatest(length(trim(value)) - 4, 0)) || right(trim(value), 4) end
$$;

create or replace function public.mask_email(value text)
returns text language sql immutable set search_path = public
as $$
  select case when nullif(trim(value), '') is null then null
    when position('@' in value) = 0 then left(value, 2) || '***'
    else left(split_part(value, '@', 1), 2) || '***@' || split_part(value, '@', 2) end
$$;

create or replace function public.mask_identifier(value text)
returns text language sql immutable set search_path = public
as $$
  select case when nullif(trim(value), '') is null then null
    else repeat('*', greatest(length(trim(value)) - 4, 0)) || right(trim(value), 4) end
$$;

create or replace function public.is_approved_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin' and "approvalStatus" = 'approved'
  )
$$;

revoke all on function public.is_approved_admin() from public;
grant execute on function public.is_approved_admin() to authenticated;

drop policy if exists "Approved admins can read user profiles" on public.users;
create policy "Approved admins can read user profiles"
on public.users for select to authenticated
using ((select public.is_approved_admin()));

grant select on public.audit_logs to authenticated;

drop policy if exists "Approved admins can read audit logs" on public.audit_logs;
create policy "Approved admins can read audit logs"
on public.audit_logs for select to authenticated
using ((select public.is_approved_admin()));

drop view if exists public.masked_user_directory;
create view public.masked_user_directory with (security_barrier = true) as
select
  id,
  public.mask_name("firstName", 2) as "firstName",
  public.mask_name("lastName", 1) as "lastName",
  public.mask_phone("phoneNumber") as "phoneNumber",
  public.mask_email(email) as email,
  public.mask_identifier("idNumber") as "idNumber",
  role, "approvalStatus", ward_id, suburb_id, city_id, province_id
from public.users
where auth.uid() is not null;

revoke all on public.masked_user_directory from public, anon;
grant select on public.masked_user_directory to authenticated;

notify pgrst, 'reload schema';
