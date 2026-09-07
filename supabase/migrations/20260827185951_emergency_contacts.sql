

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

grant select, insert, update, delete on public.emergency_contacts to authenticated;

do $$
begin
  if to_regprocedure('private.write_audit_log()') is not null then
    drop trigger if exists audit_emergency_contacts_changes on public.emergency_contacts;
    create trigger audit_emergency_contacts_changes
    after insert or update or delete on public.emergency_contacts
    for each row execute function private.write_audit_log();
  end if;
end;
$$;

notify pgrst, 'reload schema';
