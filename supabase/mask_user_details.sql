-- Comm-Connect user-detail masking.
-- Run this file once in the Supabase SQL Editor.

alter table public.users add column if not exists "approvalStatus" text not null default 'approved';

create or replace function public.mask_name(value text, visible_characters integer default 2)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(trim(value), '') is null then null
    else left(trim(value), greatest(1, visible_characters)) || '***'
  end
$$;

create or replace function public.mask_phone(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(trim(value), '') is null then null
    else repeat('*', greatest(length(trim(value)) - 4, 0)) || right(trim(value), 4)
  end
$$;

create or replace function public.mask_email(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(trim(value), '') is null then null
    when position('@' in value) = 0 then left(value, 2) || '***'
    else left(split_part(value, '@', 1), 2) || '***@' || split_part(value, '@', 2)
  end
$$;

create or replace function public.mask_identifier(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(trim(value), '') is null then null
    else repeat('*', greatest(length(trim(value)) - 4, 0)) || right(trim(value), 4)
  end
$$;

-- This function avoids recursive users-table RLS checks. Account promotion is
-- protected by protect_user_privileges_trigger and must be done by a trusted admin.
create or replace function public.is_approved_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'
      and "approvalStatus" = 'approved'
  )
$$;

revoke all on function public.is_approved_admin() from public;
grant execute on function public.is_approved_admin() to authenticated;

drop policy if exists "Approved admins can read user profiles" on public.users;
create policy "Approved admins can read user profiles"
on public.users
for select
to authenticated
using ((select public.is_approved_admin()));

drop view if exists public.masked_user_directory;
create view public.masked_user_directory
with (security_barrier = true)
as
select
  id,
  public.mask_name("firstName", 2) as "firstName",
  public.mask_name("lastName", 1) as "lastName",
  public.mask_phone("phoneNumber") as "phoneNumber",
  public.mask_email(email) as email,
  public.mask_identifier("idNumber") as "idNumber",
  role,
  "approvalStatus",
  ward_id,
  suburb_id,
  city_id,
  province_id
from public.users
where auth.uid() is not null;

revoke all on public.masked_user_directory from public, anon;
grant select on public.masked_user_directory to authenticated;

notify pgrst, 'reload schema';
