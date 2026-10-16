-- Keep South African ID numbers out of public profile rows. The trigger
-- stores only a keyed HMAC in a private schema, then clears the input column.
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
    from private.id_number_hmac_key
    where singleton = true;

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

-- Backfill existing profile values before clearing the legacy column.
insert into private.user_identity_hashes (user_id, id_number_hmac)
select
  users.id,
  encode(
    extensions.hmac(
      convert_to(regexp_replace(users."idNumber", '[[:space:]]', '', 'g'), 'UTF8'),
      id_number_hmac_key.secret,
      'sha256'
    ),
    'hex'
  )
from public.users as users
cross join private.id_number_hmac_key
where id_number_hmac_key.singleton = true
  and nullif(trim(users."idNumber"), '') is not null
on conflict (user_id) do nothing;

update public.users set "idNumber" = null where "idNumber" is not null;

drop trigger if exists protect_user_id_number on public.users;
create trigger protect_user_id_number
before insert or update of "idNumber" on public.users
for each row execute function public.protect_user_id_number();

notify pgrst, 'reload schema';
