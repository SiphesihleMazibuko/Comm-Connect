create table if not exists public.walk_requests (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references auth.users(id) on delete cascade,
  resident_ward_id uuid,
  start_label text not null,
  start_latitude double precision not null check (start_latitude between -90 and 90),
  start_longitude double precision not null check (start_longitude between -180 and 180),
  destination_label text not null,
  destination_latitude double precision not null check (destination_latitude between -90 and 90),
  destination_longitude double precision not null check (destination_longitude between -180 and 180),
  notes text,
  emergency_contact_ids uuid[] not null default '{}',
  declined_member_ids uuid[] not null default '{}',
  assigned_member_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted','member_on_way','in_progress','completed','cancelled','declined')),
  cancellation_reason text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists walk_requests_resident_idx on public.walk_requests(resident_id, created_at desc);
create index if not exists walk_requests_ward_status_idx on public.walk_requests(resident_ward_id, status, created_at);
create index if not exists walk_requests_assigned_status_idx on public.walk_requests(assigned_member_id, status);
create unique index if not exists walk_one_active_request_per_resident on public.walk_requests(resident_id)
  where status in ('pending','accepted','member_on_way','in_progress');
create unique index if not exists walk_one_active_assignment_per_member on public.walk_requests(assigned_member_id)
  where assigned_member_id is not null and status in ('accepted','member_on_way','in_progress');

create table if not exists public.walk_locations (
  id bigint generated always as identity primary key,
  walk_id uuid not null references public.walk_requests(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy double precision,
  recorded_at timestamptz not null default now()
);
create index if not exists walk_locations_walk_time_idx on public.walk_locations(walk_id, recorded_at desc);

create or replace function public.purge_expired_walk_locations()
returns integer language plpgsql security definer set search_path = public
as $$
declare removed integer;
begin
  delete from public.walk_locations where recorded_at < now() - interval '24 hours';
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.purge_expired_walk_locations() from public, anon, authenticated;

alter table public.walk_requests enable row level security;
alter table public.walk_locations enable row level security;
revoke all on public.walk_requests, public.walk_locations from anon, authenticated;
grant select on public.walk_requests, public.walk_locations to authenticated;

drop policy if exists "Walk participants can read requests" on public.walk_requests;
create policy "Walk participants can read requests" on public.walk_requests for select to authenticated using (
  resident_id = (select auth.uid()) or assigned_member_id = (select auth.uid()) or (
  status = 'pending' and not ((select auth.uid()) = any(coalesce(declined_member_ids, '{}'))) and exists (
      select 1 from public.users u join public.cps_duty_sessions d on d."userId" = u.id
      where u.id = auth.uid() and u.role in ('community_protection_service','emergency_responder')
        and u."approvalStatus" = 'approved' and u.ward_id = resident_ward_id
        and d.ward_id = u.ward_id and d."clockedOffAt" is null and d.status = 'on_duty'
    )
  )
);
drop policy if exists "Walk participants can read live locations" on public.walk_locations;
create policy "Walk participants can read live locations" on public.walk_locations for select to authenticated using (
  exists(select 1 from public.walk_requests w where w.id = walk_id and (w.resident_id = (select auth.uid()) or w.assigned_member_id = (select auth.uid())))
);

create or replace function public.walk_eligible_members(p_ward_id uuid)
returns table(member_id uuid, member_name text, ward_name text, avatar_url text)
language sql stable security definer set search_path = public
as $$
  select u.id, concat_ws(' ', u."firstName", u."lastName"), coalesce(u."wardName", d."wardName"), null::text
  from public.users u join public.cps_duty_sessions d on d."userId" = u.id
  where auth.uid() is not null and exists (
    select 1 from public.users caller where caller.id=auth.uid() and caller.ward_id=p_ward_id
      and ((caller.role='resident') or (caller.role in ('community_protection_service','emergency_responder') and caller."approvalStatus"='approved'))
  ) and u.role in ('community_protection_service','emergency_responder')
    and u."approvalStatus" = 'approved' and u.ward_id = p_ward_id
    and d.ward_id = p_ward_id and d."clockedOffAt" is null and d.status = 'on_duty'
    and not exists(select 1 from public.walk_requests w where w.assigned_member_id = u.id and w.status in ('accepted','member_on_way','in_progress'))
  group by u.id, u."firstName", u."lastName", u."wardName", d."wardName";
$$;
revoke all on function public.walk_eligible_members(uuid) from public, anon, authenticated;
grant execute on function public.walk_eligible_members(uuid) to authenticated;

create or replace function public.create_walk_request(
  p_start_label text, p_start_latitude double precision, p_start_longitude double precision,
  p_destination_label text, p_destination_latitude double precision, p_destination_longitude double precision,
  p_notes text default null, p_emergency_contact_ids uuid[] default '{}'
) returns public.walk_requests
language plpgsql security definer set search_path = public
as $$
declare v_user public.users%rowtype; v_request public.walk_requests%rowtype;
begin
  select * into v_user from public.users where id = auth.uid() and role = 'resident';
  if not found then raise exception 'Only resident accounts can request a walk'; end if;
  if coalesce(trim(p_start_label),'') = '' or coalesce(trim(p_destination_label),'') = ''
    or p_start_latitude not between -90 and 90 or p_start_longitude not between -180 and 180
    or p_destination_latitude not between -90 and 90 or p_destination_longitude not between -180 and 180 then
    raise exception 'Valid start and destination details are required';
  end if;
  if exists(select 1 from unnest(coalesce(p_emergency_contact_ids,'{}')) cid where not exists(
    select 1 from public.emergency_contacts c where c.id = cid and c."userId" = auth.uid()
  )) then raise exception 'Emergency contact selection is invalid'; end if;
  if exists(select 1 from public.walk_requests where resident_id = auth.uid() and status in ('pending','accepted','member_on_way','in_progress')) then
    raise exception 'You already have an active walk request'; end if;
  insert into public.walk_requests(resident_id,resident_ward_id,start_label,start_latitude,start_longitude,destination_label,destination_latitude,destination_longitude,notes,emergency_contact_ids)
  values(auth.uid(),v_user.ward_id,trim(p_start_label),p_start_latitude,p_start_longitude,trim(p_destination_label),p_destination_latitude,p_destination_longitude,nullif(trim(p_notes),''),coalesce(p_emergency_contact_ids,'{}')) returning * into v_request;
  return v_request;
end;
$$;

create or replace function public.respond_to_walk(p_walk_id uuid, p_accept boolean)
returns public.walk_requests language plpgsql security definer set search_path = public
as $$
declare v_walk public.walk_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  select * into v_walk from public.walk_requests where id=p_walk_id for update;
  if not found or v_walk.status <> 'pending' then raise exception 'This request is no longer available'; end if;
  if auth.uid() = any(v_walk.declined_member_ids) then raise exception 'You have already declined this request'; end if;
  if not exists(select 1 from public.users u join public.cps_duty_sessions d on d."userId"=u.id where u.id=auth.uid()
    and u.role in ('community_protection_service','emergency_responder') and u."approvalStatus"='approved'
    and u.ward_id=v_walk.resident_ward_id and d.ward_id=u.ward_id and d."clockedOffAt" is null and d.status='on_duty') then
    raise exception 'You are not eligible for this ward request'; end if;
  if p_accept and exists(select 1 from public.walk_requests where assigned_member_id=auth.uid() and status in ('accepted','member_on_way','in_progress')) then raise exception 'Complete your current walk first'; end if;
  if p_accept then
    update public.walk_requests set status='accepted', assigned_member_id=auth.uid(), accepted_at=now(), updated_at=now()
      where id=p_walk_id returning * into v_walk;
  else
    update public.walk_requests set declined_member_ids=array_append(declined_member_ids,auth.uid()), updated_at=now()
      where id=p_walk_id returning * into v_walk;
    if not exists(select 1 from public.users u join public.cps_duty_sessions d on d."userId"=u.id
      where u.role in ('community_protection_service','emergency_responder') and u."approvalStatus"='approved'
        and u.ward_id=v_walk.resident_ward_id and d.ward_id=u.ward_id and d."clockedOffAt" is null and d.status='on_duty'
        and not (u.id=any(v_walk.declined_member_ids))) then
      update public.walk_requests set status='declined',updated_at=now() where id=p_walk_id returning * into v_walk;
    end if;
  end if;
  return v_walk;
end;
$$;

create or replace function public.transition_walk(p_walk_id uuid, p_status text, p_reason text default null)
returns public.walk_requests language plpgsql security definer set search_path = public
as $$
declare v_walk public.walk_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  select * into v_walk from public.walk_requests where id=p_walk_id for update;
  if not found then raise exception 'Walk not found'; end if;
  if auth.uid()=v_walk.resident_id and p_status='cancelled' and v_walk.status in ('pending','accepted','member_on_way','in_progress') then
    update public.walk_requests set status='cancelled',cancellation_reason=nullif(trim(p_reason),''),updated_at=now() where id=p_walk_id returning * into v_walk; return v_walk;
  end if;
  if auth.uid()<>v_walk.assigned_member_id then raise exception 'Only the assigned CPF member can update this walk'; end if;
  if p_status='member_on_way' and v_walk.status='accepted' then update public.walk_requests set status=p_status,updated_at=now() where id=p_walk_id;
  elsif p_status='in_progress' and v_walk.status in ('accepted','member_on_way') then update public.walk_requests set status=p_status,started_at=now(),updated_at=now() where id=p_walk_id;
  elsif p_status in ('completed','cancelled') and v_walk.status in ('accepted','member_on_way','in_progress') then update public.walk_requests set status=p_status,completed_at=case when p_status='completed' then now() else completed_at end,cancellation_reason=nullif(trim(p_reason),''),updated_at=now() where id=p_walk_id;
  else raise exception 'Invalid walk status transition'; end if;
  select * into v_walk from public.walk_requests where id=p_walk_id; return v_walk;
end;
$$;

create or replace function public.update_walk_location(p_walk_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy double precision default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'Invalid coordinates'; end if;
  if not exists(select 1 from public.walk_requests where id=p_walk_id and assigned_member_id=auth.uid() and status in ('member_on_way','in_progress')) then raise exception 'Live location is only available to the assigned member during an active walk'; end if;
  insert into public.walk_locations(walk_id,member_id,latitude,longitude,accuracy) values(p_walk_id,auth.uid(),p_latitude,p_longitude,p_accuracy);
  perform public.purge_expired_walk_locations();
end;
$$;

revoke all on function public.create_walk_request(text,double precision,double precision,text,double precision,double precision,text,uuid[]) from public, anon, authenticated;
revoke all on function public.respond_to_walk(uuid,boolean) from public, anon, authenticated;
revoke all on function public.transition_walk(uuid,text,text) from public, anon, authenticated;
revoke all on function public.update_walk_location(uuid,double precision,double precision,double precision) from public, anon, authenticated;
grant execute on function public.create_walk_request(text,double precision,double precision,text,double precision,double precision,text,uuid[]) to authenticated;
grant execute on function public.respond_to_walk(uuid,boolean) to authenticated;
grant execute on function public.transition_walk(uuid,text,text) to authenticated;
grant execute on function public.update_walk_location(uuid,double precision,double precision,double precision) to authenticated;

create or replace function public.walk_assigned_member(p_walk_id uuid)
returns table(member_name text, ward_name text)
language sql stable security definer set search_path = public
as $$
  select concat_ws(' ',u."firstName",u."lastName"), coalesce(u."wardName",w.resident_ward_id::text)
  from public.walk_requests w join public.users u on u.id=w.assigned_member_id
  where w.id=p_walk_id and (w.resident_id=auth.uid() or w.assigned_member_id=auth.uid())
    and w.assigned_member_id is not null;
$$;
revoke all on function public.walk_assigned_member(uuid) from public, anon, authenticated;
grant execute on function public.walk_assigned_member(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.walk_requests;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.walk_locations;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$
declare job_present boolean; schedule_result bigint;
begin
  if to_regnamespace('cron') is not null then
    execute 'select exists(select 1 from cron.job where jobname = $1)'
      into job_present using 'walk-location-retention';
    if not job_present then
      execute 'select cron.schedule($1, $2, $3)'
        into schedule_result
        using 'walk-location-retention', '*/15 * * * *', 'select public.purge_expired_walk_locations()';
    end if;
  end if;
end $$;
notify pgrst, 'reload schema';
