-- Allow approved administrators to read audit logs from the admin dashboard.
-- Table privileges are still paired with RLS, so non-admin authenticated users
-- receive no rows.

grant select on public.audit_logs to authenticated;

drop policy if exists "Approved admins can read audit logs" on public.audit_logs;
create policy "Approved admins can read audit logs"
on public.audit_logs
for select
to authenticated
using ((select public.is_approved_admin()));

notify pgrst, 'reload schema';
