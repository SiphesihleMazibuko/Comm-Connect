-- Permit the authenticated signup RPC to finish only the caller's own profile.
-- The transaction-local marker is set only inside the restricted RPC below.
create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE'
    and auth.uid() is not null
    and old.id = auth.uid()
    and current_setting('app.signup_profile_completion_user', true) = auth.uid()::text
  then
    return new;
  end if;

  if auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.id is distinct from auth.uid() then
        raise exception 'Profiles must belong to the signed-in user' using errcode='42501';
      end if;
      if new.role not in ('resident','community_leader','leader','community_protection_service','emergency_responder')
        or (new."requestedRole" is not null and new."requestedRole" not in ('resident','community_leader','leader','community_protection_service','emergency_responder')) then
        raise exception 'Invalid signup role' using errcode='42501';
      end if;
      if new.role <> 'resident' then new."requestedRole" := new.role; end if;
      new.role := 'resident';
      new."approvalStatus" := case when new."requestedRole" in ('community_leader','leader','community_protection_service','emergency_responder') then 'pending' else 'approved' end;
      new.permissions := jsonb_strip_nulls(jsonb_build_object(
        'anonymousReportsDefault', new.permissions -> 'anonymousReportsDefault',
        'emergencyContacts', new.permissions -> 'emergencyContacts'
      ));
    elsif tg_op = 'UPDATE' then
      if new.id is distinct from old.id
        or new.role is distinct from old.role
        or new."requestedRole" is distinct from old."requestedRole"
        or new."approvalStatus" is distinct from old."approvalStatus"
        or new."phoneNumber" is distinct from old."phoneNumber"
        or new."idNumber" is distinct from old."idNumber"
        or new.province_id is distinct from old.province_id
        or new.city_id is distinct from old.city_id
        or new.suburb_id is distinct from old.suburb_id
        or new.zone_id is distinct from old.zone_id
        or new.ward_id is distinct from old.ward_id
        or new."wardName" is distinct from old."wardName"
        or new."serviceType" is distinct from old."serviceType"
        or new."responderType" is distinct from old."responderType"
        or (coalesce(new.permissions, '{}'::jsonb) - array['anonymousReportsDefault', 'emergencyContacts'])
          is distinct from
          (coalesce(old.permissions, '{}'::jsonb) - array['anonymousReportsDefault', 'emergencyContacts']) then
        raise exception 'Account security and verified identity fields require a trusted administrator' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.complete_my_signup_profile(p_profile jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth, extensions
as $$
declare
  caller_id uuid := auth.uid();
  requested_role text := coalesce(p_profile->>'requestedRole', 'resident');
  normalized_id text := regexp_replace(coalesce(p_profile->>'idNumber', ''), '[[:space:]]', '', 'g');
  verified_phone text;
  hmac_key bytea;
  candidate_hmac text;
  existing_hmac text;
begin
  if caller_id is null then
    raise exception 'Authentication is required to complete signup' using errcode = '42501';
  end if;
  if requested_role not in ('resident', 'community_leader', 'community_protection_service') then
    raise exception 'Invalid signup role' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_profile->>'firstName', '')), '') is null
    or nullif(trim(coalesce(p_profile->>'lastName', '')), '') is null
    or nullif(trim(coalesce(p_profile->>'email', '')), '') is null then
    raise exception 'First name, last name, and email are required' using errcode = '22023';
  end if;
  if normalized_id !~ '^[0-9]{13}$' then
    raise exception 'A valid 13-digit ID number is required' using errcode = '22023';
  end if;

  select phone into verified_phone from auth.users where id = caller_id;
  if nullif(verified_phone, '') is null then
    raise exception 'A verified phone number is required to complete signup' using errcode = '22023';
  end if;

  select secret into strict hmac_key
  from private.id_number_hmac_key where singleton = true;
  candidate_hmac := encode(extensions.hmac(convert_to(normalized_id, 'UTF8'), hmac_key, 'sha256'), 'hex');
  select id_number_hmac into existing_hmac
  from private.user_identity_hashes where user_id = caller_id;
  if existing_hmac is not null and existing_hmac <> candidate_hmac then
    raise exception 'An ID number is already protected for this account' using errcode = '23505';
  end if;
  perform set_config('app.signup_profile_completion_user', caller_id::text, true);
  insert into public.users (
    id, "firstName", "lastName", email, "phoneNumber", "idNumber", location,
    role, "requestedRole", "approvalStatus"
  ) values (
    caller_id, trim(p_profile->>'firstName'), trim(p_profile->>'lastName'),
    lower(trim(p_profile->>'email')), verified_phone, null,
    nullif(trim(coalesce(p_profile->>'location', '')), ''), 'resident',
    case when requested_role = 'resident' then null else requested_role end,
    case when requested_role = 'resident' then 'approved' else 'pending' end
  ) on conflict (id) do nothing;

  update public.users set
    "firstName" = trim(p_profile->>'firstName'),
    "lastName" = trim(p_profile->>'lastName'),
    email = lower(trim(p_profile->>'email')),
    "phoneNumber" = verified_phone,
    "idNumber" = null,
    location = nullif(trim(coalesce(p_profile->>'location', '')), ''),
    role = 'resident',
    "requestedRole" = case when requested_role = 'resident' then null else requested_role end,
    "approvalStatus" = case when requested_role = 'resident' then 'approved' else 'pending' end,
    "organizationName" = nullif(trim(coalesce(p_profile->>'organizationName', '')), ''),
    "responderType" = case when requested_role = 'community_protection_service' then 'community_protection_service' else null end,
    "serviceType" = case when requested_role = 'community_protection_service' then 'community_protection_service' else null end,
    "wardName" = case when requested_role = 'community_protection_service' then nullif(trim(coalesce(p_profile->>'wardName', '')), '') else null end,
    province_id = nullif(p_profile->>'province_id', '')::uuid,
    city_id = nullif(p_profile->>'city_id', '')::uuid,
    suburb_id = nullif(p_profile->>'suburb_id', '')::uuid,
    zone_id = nullif(p_profile->>'zone_id', '')::uuid,
    ward_id = nullif(p_profile->>'ward_id', '')::uuid,
    permissions = jsonb_build_object(
      'locationEnabled', false,
      'notificationsEnabled', false,
      'manualWardNumber', nullif(p_profile->'permissions'->>'manualWardNumber', ''),
      'pinpointAddress', p_profile->'permissions'->'pinpointAddress',
      'canReportIncident', true,
      'canRequestEmergency', true,
      'canReviewReports', false,
      'canRespondToEmergency', false,
      'canClockInForDuty', false,
      'canSendCommunityAlerts', false
    )
  where id = caller_id;

  if not found then
    raise exception 'Signup profile was not created for this account';
  end if;

  insert into private.user_identity_hashes (user_id, id_number_hmac)
  values (caller_id, candidate_hmac)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.complete_my_signup_profile(jsonb) from public, anon;
grant execute on function public.complete_my_signup_profile(jsonb) to authenticated;
notify pgrst, 'reload schema';
