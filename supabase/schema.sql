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
  permissions jsonb not null default '{}'::jsonb,
  language text not null default 'en',
  "createdAt" timestamptz not null default now(),
  "isMockUser" boolean not null default false
);

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
grant select, insert, update on public."emergencyRequests" to authenticated;

notify pgrst, 'reload schema';
