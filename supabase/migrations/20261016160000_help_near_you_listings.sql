create table if not exists public.help_listings (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  category text not null check (length(trim(category)) between 2 and 80),
  description text not null check (length(trim(description)) between 5 and 3000),
  contact_phone text not null check (length(trim(contact_phone)) between 5 and 40),
  email text,
  whatsapp_available boolean not null default false,
  whatsapp_phone text,
  office_name text,
  office_address text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  office_hours text,
  image_url text,
  additional_instructions text,
  eligibility_requirements text,
  ward_id uuid not null references public.wards(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'published' check (status in ('published', 'unpublished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint help_listings_whatsapp_number_required check (not whatsapp_available or nullif(trim(whatsapp_phone), '') is not null),
  constraint help_listings_coordinates_pair check ((latitude is null) = (longitude is null))
);

create index if not exists help_listings_ward_status_created_idx
  on public.help_listings (ward_id, status, created_at desc);
create index if not exists help_listings_created_by_idx
  on public.help_listings (created_by);

alter table public.help_listings enable row level security;

grant select, insert, update, delete on public.help_listings to authenticated;
revoke all on public.help_listings from anon;

drop policy if exists "Ward residents and listing leaders can read help listings" on public.help_listings;
create policy "Ward residents and listing leaders can read help listings"
  on public.help_listings for select to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u."approvalStatus" = 'approved'
        and (
          (u.role = 'resident' and u.ward_id = help_listings.ward_id and help_listings.status = 'published')
          or (u.role in ('community_leader', 'leader') and u.ward_id = help_listings.ward_id and help_listings.created_by = (select auth.uid()))
        )
    )
  );

drop policy if exists "Approved ward leaders can create help listings" on public.help_listings;
create policy "Approved ward leaders can create help listings"
  on public.help_listings for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u."approvalStatus" = 'approved'
        and u.role in ('community_leader', 'leader')
        and u.ward_id = help_listings.ward_id
    )
  );

drop policy if exists "Approved ward leaders can update their help listings" on public.help_listings;
create policy "Approved ward leaders can update their help listings"
  on public.help_listings for update to authenticated
  using (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u."approvalStatus" = 'approved'
        and u.role in ('community_leader', 'leader')
        and u.ward_id = help_listings.ward_id
    )
  )
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u."approvalStatus" = 'approved'
        and u.role in ('community_leader', 'leader')
        and u.ward_id = help_listings.ward_id
    )
  );

drop policy if exists "Approved ward leaders can delete their help listings" on public.help_listings;
create policy "Approved ward leaders can delete their help listings"
  on public.help_listings for delete to authenticated
  using (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u."approvalStatus" = 'approved'
        and u.role in ('community_leader', 'leader')
        and u.ward_id = help_listings.ward_id
    )
  );
