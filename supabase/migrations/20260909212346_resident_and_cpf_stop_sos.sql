create or replace function public.stop_sos_alert(alert_id uuid)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog
as $$
declare alert public."emergencyRequests"%rowtype; actor public.users%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to stop an SOS' using errcode = '42501'; end if;
  select * into actor from public.users where id = auth.uid();
  select * into alert from public."emergencyRequests" where id = alert_id and "emergencyType" = 'sos' for update;
  if not found then raise exception 'SOS not found' using errcode = 'P0002'; end if;
  if not coalesce((coalesce(alert."userId" = auth.uid(), false) or
    (actor.role in ('community_protection_service', 'emergency_responder') and actor.ward_id is not null and actor.ward_id = alert.ward_id)), false) then
    raise exception 'Only the resident or a CPF member in their ward can stop this SOS' using errcode = '42501';
  end if;
  if alert.status in ('cancelled', 'completed', 'resolved') then return to_jsonb(alert); end if;
  update public."emergencyRequests" set
    status = case when alert."userId" = auth.uid() then 'cancelled' else 'completed' end,
    "completedAt" = now(),
    "responderId" = case when alert."userId" <> auth.uid() then auth.uid() else alert."responderId" end,
    "responderName" = case when alert."userId" <> auth.uid()
      then nullif(trim(concat_ws(' ', actor."firstName", actor."lastName")), '') else alert."responderName" end
  where id = alert_id returning * into alert;
  return to_jsonb(alert);
end;
$$;
revoke all on function public.stop_sos_alert(uuid) from public, anon;
grant execute on function public.stop_sos_alert(uuid) to authenticated;
notify pgrst, 'reload schema';
