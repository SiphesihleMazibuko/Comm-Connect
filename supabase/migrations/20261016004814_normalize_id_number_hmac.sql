-- Normalize whitespace consistently before deriving ID-number HMAC values.
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
