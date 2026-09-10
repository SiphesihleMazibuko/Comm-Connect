begin;
do $$
declare owner_id uuid; cpf_id uuid; ward uuid; test_id uuid := gen_random_uuid(); second_id uuid := gen_random_uuid(); third_id uuid := gen_random_uuid();
begin
 select a.id,b.id,a.ward_id into strict owner_id,cpf_id,ward
 from public.users a join public.users b on a.ward_id=b.ward_id
 where a.role='resident' and b.role in ('community_protection_service','emergency_responder') limit 1;
 perform set_config('sos_test.owner',owner_id::text,true);
 perform set_config('sos_test.cpf',cpf_id::text,true);
 perform set_config('sos_test.first',test_id::text,true);
 perform set_config('sos_test.second',second_id::text,true);
 perform set_config('sos_test.third',third_id::text,true);
 insert into public."emergencyRequests"(id,"userId","emergencyType",status,ward_id)
 values (test_id,owner_id,'sos','active',ward),(second_id,owner_id,'sos','active',ward),(third_id,owner_id,'sos','active',null);
end $$;
set local role authenticated;
do $$
declare result jsonb; test_id uuid := current_setting('sos_test.first')::uuid;
begin
 perform set_config('request.jwt.claims', jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 begin
   perform public.stop_sos_alert(test_id);
   raise exception 'Unauthorized actor was allowed to stop SOS';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('sos_test.owner'),'role','authenticated')::text,true);
 result := public.stop_sos_alert(test_id);
 if result->>'status' <> 'cancelled' or result->>'completedAt' is null then raise exception 'Resident stop failed'; end if;
 if public.stop_sos_alert(test_id) <> result then raise exception 'Repeated stop changed completed SOS'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('sos_test.cpf'),'role','authenticated')::text,true);
 result := public.stop_sos_alert(current_setting('sos_test.second')::uuid);
 if result->>'status' <> 'completed' or result->>'responderId' <> current_setting('sos_test.cpf') then raise exception 'CPF stop failed'; end if;
 begin
   perform public.stop_sos_alert(current_setting('sos_test.third')::uuid);
   raise exception 'CPF could stop SOS outside their ward';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claims','{}',true);
 begin
   perform public.stop_sos_alert(test_id);
   raise exception 'Unauthenticated stop allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
select 'PASS: resident stop, CPF stop, idempotency, unauthorized/no-profile/no-session/out-of-ward denial; changes rolled back' as result;
