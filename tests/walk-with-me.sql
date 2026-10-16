-- Integration smoke test for a Supabase project with at least one resident,
-- one approved CPS responder in the same ward, and an on-duty session.
-- Run after 20261016000000_walk_with_me.sql; the transaction rolls back.
begin;
do $$
declare resident_id uuid; member_id uuid; ward_id uuid;
begin
  select r.id, m.id, r.ward_id into strict resident_id, member_id, ward_id
  from public.users r
  join public.users m on m.ward_id = r.ward_id
  join public.cps_duty_sessions d on d."userId" = m.id and d.ward_id = m.ward_id
  where r.role = 'resident'
    and m.role in ('community_protection_service','emergency_responder')
    and m."approvalStatus" = 'approved'
    and r.ward_id is not null and d."clockedOffAt" is null and d.status = 'on_duty'
    and not exists(select 1 from public.walk_requests w where w.resident_id=r.id and w.status in ('pending','accepted','member_on_way','in_progress'))
    and not exists(select 1 from public.walk_requests w where w.assigned_member_id=m.id and w.status in ('accepted','member_on_way','in_progress'))
  limit 1;
  perform set_config('walk_test.resident', resident_id::text, true);
  perform set_config('walk_test.member', member_id::text, true);
  perform set_config('walk_test.ward', ward_id::text, true);
end $$;

set local role authenticated;
do $$
declare created public.walk_requests; location_count integer; v_walk_id uuid;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('walk_test.resident'), 'role', 'authenticated')::text, true);
  if not exists(select 1 from public.walk_eligible_members(current_setting('walk_test.ward')::uuid)) then
    raise exception 'Eligible on-duty member was not returned';
  end if;
  created := public.create_walk_request('Test start', -26.2041, 28.0473, 'Test destination', -26.2030, 28.0490, null, '{}');
  v_walk_id := created.id;
  if created.status <> 'pending' then raise exception 'Request did not start pending'; end if;
  perform set_config('walk_test.id', v_walk_id::text, true);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('walk_test.member'), 'role', 'authenticated')::text, true);
  created := public.respond_to_walk(v_walk_id, true);
  if created.status <> 'accepted' then raise exception 'CPF acceptance failed'; end if;
  perform public.transition_walk(v_walk_id, 'member_on_way', null);
  perform public.transition_walk(v_walk_id, 'in_progress', null);
  perform public.update_walk_location(v_walk_id, -26.2040, 28.0480, 12.0);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  begin
    perform public.update_walk_location(v_walk_id, -26.0, 28.0, null);
    raise exception 'Unauthorised actor could publish a walk location';
  exception when others then
    if sqlerrm = 'Unauthorised actor could publish a walk location' then raise; end if;
  end;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('walk_test.resident'), 'role', 'authenticated')::text, true);
  select count(*) into location_count from public.walk_locations where walk_locations.walk_id = v_walk_id;
  if location_count <> 1 then raise exception 'Resident could not read authorized live location'; end if;
  created := public.transition_walk(v_walk_id, 'cancelled', null);
  if created.status <> 'cancelled' then raise exception 'Resident cancellation failed'; end if;
end $$;
rollback;
select 'PASS: eligibility, request creation, accept/start, authorized location read, resident cancel, unauthorized location write' as result;
