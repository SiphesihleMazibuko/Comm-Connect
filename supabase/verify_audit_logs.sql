
select
  to_regclass('public.audit_logs') as audit_logs_table,
  to_regprocedure('private.write_audit_log()') as audit_trigger_function,
  to_regprocedure('private.audit_changed_fields(jsonb,jsonb)') as changed_fields_function;

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename = 'audit_logs';

select
  policyname,
  cmd,
  roles,
  qual
from pg_policies
where schemaname = 'public'
  and tablename = 'audit_logs';

select
  event_object_schema as table_schema,
  event_object_table as table_name,
  trigger_name,
  string_agg(event_manipulation, ', ' order by event_manipulation) as events
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'audit_users_changes',
    'audit_pinpoints_changes',
    'audit_posts_changes',
    'audit_reports_changes',
    'audit_emergency_dispatches_changes',
    'audit_cps_duty_sessions_changes',
    'audit_emergency_requests_changes',
    'audit_emergency_contacts_changes'
  )
group by event_object_schema, event_object_table, trigger_name
order by event_object_table, trigger_name;

select
  table_name,
  operation,
  actor_id,
  changed_fields,
  created_at
from public.audit_logs
order by created_at desc
limit 20;
