do $$
declare
  existing_trigger record;
begin
  for existing_trigger in
    select trigger_info.tgname
    from pg_trigger trigger_info
    join pg_class table_info on table_info.oid = trigger_info.tgrelid
    join pg_namespace table_schema on table_schema.oid = table_info.relnamespace
    join pg_proc function_info on function_info.oid = trigger_info.tgfoid
    where table_schema.nspname = 'public'
      and table_info.relname = 'users'
      and not trigger_info.tgisinternal
      and pg_get_functiondef(function_info.oid) like '%Privileged accounts must be provisioned by an administrator%'
  loop
    execute format('drop trigger if exists %I on public.users', existing_trigger.tgname);
  end loop;
end $$;

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

notify pgrst, 'reload schema';
