alter table public.audit_logs add column if not exists actor_display_name text;
alter table public.audit_logs add column if not exists record_label text;
alter table public.audit_logs add column if not exists action_summary text;
alter table public.audit_logs add column if not exists change_details jsonb not null default '[]'::jsonb;

create or replace function private.audit_changed_fields(old_row jsonb, new_row jsonb)
returns text[]
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(array_agg(key order by key), array[]::text[])
  from (
    select key
    from jsonb_each(coalesce(old_row, '{}'::jsonb))
    where coalesce(old_row, '{}'::jsonb) -> key is distinct from coalesce(new_row, '{}'::jsonb) -> key

    union

    select key
    from jsonb_each(coalesce(new_row, '{}'::jsonb))
    where coalesce(old_row, '{}'::jsonb) -> key is distinct from coalesce(new_row, '{}'::jsonb) -> key
  ) changed;
$$;

create or replace function private.audit_change_details(old_row jsonb, new_row jsonb)
returns jsonb
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'field',
        key,
        'oldValue',
        coalesce(old_row, '{}'::jsonb) -> key,
        'newValue',
        coalesce(new_row, '{}'::jsonb) -> key
      )
      order by key
    ),
    '[]'::jsonb
  )
  from unnest(private.audit_changed_fields(old_row, new_row)) as fields(key);
$$;

create or replace function private.audit_record_label(row_data jsonb)
returns text
language sql
stable
set search_path = pg_catalog
as $$
  select nullif(
    coalesce(
      row_data ->> 'title',
      row_data ->> 'label',
      row_data ->> 'name',
      row_data ->> 'email',
      row_data ->> 'memberName',
      row_data ->> 'emergencyType',
      row_data ->> 'reportType',
      row_data ->> 'digitalAddress',
      row_data ->> 'description',
      row_data ->> 'id'
    ),
    ''
  );
$$;

create or replace function private.audit_actor_display_name(actor uuid)
returns text
language sql
stable
set search_path = pg_catalog, public
as $$
  select nullif(
    concat_ws(
      ' ',
      nullif(users."firstName", ''),
      nullif(users."lastName", '')
    ),
    ''
  )
  from public.users
  where users.id = actor;
$$;

create or replace function private.audit_action_summary(
  table_name text,
  operation text,
  record_label text,
  changed_fields text[]
)
returns text
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  readable_table text;
  field_count integer;
  field_preview text;
  target text;
begin
  readable_table := replace(table_name, '_', ' ');
  field_count := coalesce(array_length(changed_fields, 1), 0);
  field_preview := array_to_string(changed_fields[1:3], ', ');
  target := case
    when record_label is null then readable_table
    else readable_table || ' "' || left(record_label, 80) || '"'
  end;

  if operation = 'INSERT' then
    return 'Created ' || target;
  end if;

  if operation = 'DELETE' then
    return 'Deleted ' || target;
  end if;

  if field_count = 0 then
    return 'Updated ' || target || ' without field changes';
  end if;

  if field_count = 1 then
    return 'Updated ' || target || ': ' || field_preview;
  end if;

  return 'Updated ' || target || ': ' || field_count || ' fields (' || field_preview || case when field_count > 3 then ', ...' else '' end || ')';
end;
$$;

create or replace function private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  old_row jsonb;
  new_row jsonb;
  changed text[];
  details jsonb;
  audit_record_id text;
  label text;
  actor uuid;
  actor_email text;
  actor_name text;
begin
  if tg_table_schema = 'public' and tg_table_name = 'audit_logs' then
    return coalesce(new, old);
  end if;

  old_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  changed := case
    when tg_op = 'UPDATE' then private.audit_changed_fields(old_row, new_row)
    when tg_op = 'INSERT' then private.audit_changed_fields('{}'::jsonb, new_row)
    else private.audit_changed_fields(old_row, '{}'::jsonb)
  end;
  details := private.audit_change_details(
    case when tg_op = 'INSERT' then '{}'::jsonb else old_row end,
    case when tg_op = 'DELETE' then '{}'::jsonb else new_row end
  );
  audit_record_id := coalesce(new_row ->> 'id', old_row ->> 'id');
  label := private.audit_record_label(coalesce(new_row, old_row));
  actor := auth.uid();
  -- Read the verified request claims; phone sign-ins may have no email claim.
  actor_email := coalesce(
    nullif(auth.jwt() ->> 'email', ''),
    (select nullif(u.email, '') from public.users u where u.id = actor),
    (select nullif(u.email, '') from auth.users u where u.id = actor)
  );
  actor_name := coalesce(
    private.audit_actor_display_name(actor),
    (select coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''),
                     nullif(u.raw_user_meta_data ->> 'name', ''))
       from auth.users u where u.id = actor),
    case when tg_table_name = 'users' and audit_record_id = actor::text
      then nullif(trim(concat_ws(' ', old_row ->> 'firstName', old_row ->> 'lastName')), '') end,
    case when actor is null then 'System / database operation'
         else 'Unknown user (' || actor::text || ')' end
  );

  insert into public.audit_logs (
    table_schema,
    table_name,
    record_id,
    operation,
    actor_id,
    actor_email,
    actor_display_name,
    record_label,
    action_summary,
    old_record,
    new_record,
    changed_fields,
    change_details,
    request_id
  )
  values (
    tg_table_schema,
    tg_table_name,
    audit_record_id,
    tg_op,
    actor,
    actor_email,
    coalesce(actor_name, actor_email),
    label,
    private.audit_action_summary(tg_table_name, tg_op, label, changed),
    old_row,
    new_row,
    changed,
    details,
    nullif(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id', '')
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_changed_fields(jsonb, jsonb) from public;
revoke all on function private.audit_change_details(jsonb, jsonb) from public;
revoke all on function private.audit_record_label(jsonb) from public;
revoke all on function private.audit_actor_display_name(uuid) from public;
revoke all on function private.audit_action_summary(text, text, text, text[]) from public;
revoke all on function private.write_audit_log() from public;

notify pgrst, 'reload schema';

-- Backfill only missing identity snapshots. Never infer an actor from the
-- owner of the affected record: an administrator may have made the change.
update public.audit_logs a
set actor_email = coalesce(nullif(a.actor_email, ''),
      (select nullif(u.email, '') from public.users u where u.id = a.actor_id),
      (select nullif(u.email, '') from auth.users u where u.id = a.actor_id)),
    actor_display_name = coalesce(nullif(a.actor_display_name, ''),
      private.audit_actor_display_name(a.actor_id),
      (select coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''),
                       nullif(u.raw_user_meta_data ->> 'name', ''))
         from auth.users u where u.id = a.actor_id),
      case when a.actor_id is null then 'System / database operation'
           else 'Unknown user (' || a.actor_id::text || ')' end),
    record_label = coalesce(nullif(a.record_label, ''),
      private.audit_record_label(coalesce(a.new_record, a.old_record))),
    changed_fields = private.audit_changed_fields(a.old_record, a.new_record),
    change_details = private.audit_change_details(a.old_record, a.new_record);

update public.audit_logs
set action_summary = private.audit_action_summary(
  table_name, operation, record_label, changed_fields)
where nullif(action_summary, '') is null;

-- Triggers continue writing as their owner; application roles cannot read logs.
drop policy if exists "Community leaders can read audit logs" on public.audit_logs;
revoke all on public.audit_logs from public, anon, authenticated;
alter table public.audit_logs enable row level security;

comment on column public.audit_logs.actor_display_name is
  'Actor name captured at write time. Backfilled historical names use the current profile.';
comment on column public.audit_logs.action_summary is
  'Human-readable action and affected fields; change_details contains before/after values.';
notify pgrst, 'reload schema';
