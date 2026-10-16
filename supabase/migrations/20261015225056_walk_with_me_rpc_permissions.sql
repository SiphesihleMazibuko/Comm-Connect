-- Remove default direct grants for security-definer RPCs. Walk operations are
-- available only to signed-in users; each function enforces its own actor/role.
revoke all on function public.walk_eligible_members(uuid) from public, anon, authenticated;
grant execute on function public.walk_eligible_members(uuid) to authenticated;

revoke all on function public.create_walk_request(text,double precision,double precision,text,double precision,double precision,text,uuid[]) from public, anon, authenticated;
grant execute on function public.create_walk_request(text,double precision,double precision,text,double precision,double precision,text,uuid[]) to authenticated;

revoke all on function public.respond_to_walk(uuid,boolean) from public, anon, authenticated;
grant execute on function public.respond_to_walk(uuid,boolean) to authenticated;

revoke all on function public.transition_walk(uuid,text,text) from public, anon, authenticated;
grant execute on function public.transition_walk(uuid,text,text) to authenticated;

revoke all on function public.update_walk_location(uuid,double precision,double precision,double precision) from public, anon, authenticated;
grant execute on function public.update_walk_location(uuid,double precision,double precision,double precision) to authenticated;

revoke all on function public.walk_assigned_member(uuid) from public, anon, authenticated;
grant execute on function public.walk_assigned_member(uuid) to authenticated;

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
