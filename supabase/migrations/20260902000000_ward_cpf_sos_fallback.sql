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

notify pgrst, 'reload schema';
