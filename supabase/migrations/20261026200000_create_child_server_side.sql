-- ============================================================================
-- SafeSpace: create children only through the create-child Edge Function
-- Migration: 20261026200000_create_child_server_side
--
-- 20261026000000 granted `authenticated` INSERT on children and child_modules
-- because create-child inserted AS the caregiver. That also let any caregiver
-- skip create-child through the REST API and write values the server is meant
-- to decide: privacy_tier regardless of age (it should follow the age bands),
-- an arbitrary pin_hash (including a huge PBKDF2 iteration count that
-- verify-child-pin would then try to compute), and a PIN shared with a sibling.
--
-- Now:
--   - create_child(...) (SECURITY DEFINER, service_role only) is the single
--     way to add a child. It checks the caregiver exists, validates every
--     field, derives privacy_tier from age, and inserts the child and its
--     modules in one transaction. create-child calls it after verifying the
--     caller's JWT and taking the caregiver id from that JWT, never the body.
--   - authenticated loses INSERT on children and child_modules.
--   - authenticated SELECT on children is narrowed to the columns the app
--     reads: everything except pin_hash.
-- RLS policies are unchanged. service_role keeps SELECT on children
-- (verify-child-pin and the sibling-PIN check need pin_hash).
-- ============================================================================

revoke insert on public.children from authenticated;
revoke insert on public.child_modules from authenticated;

revoke select on public.children from authenticated;
grant select (id, caregiver_id, name, age, privacy_tier, created_at) on public.children to authenticated;

create or replace function public.create_child(
  p_caregiver_id uuid,
  p_name text,
  p_age integer,
  p_pin_hash text,
  p_modules text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_id uuid;
begin
  if p_caregiver_id is null or not exists (select 1 from public.caregivers where id = p_caregiver_id) then
    raise exception 'not_a_caregiver';
  end if;

  -- pin_hash must be exactly what _shared/pin.ts hashPin() produces:
  -- pbkdf2$100000$<16-byte salt, base64>$<32-byte hash, base64>.
  if v_name is null or char_length(v_name) not between 1 and 80
     or p_age is null or p_age not between 4 and 17
     or p_pin_hash is null
     or p_pin_hash !~ '^pbkdf2\$100000\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=$'
     or p_modules is null
     or exists (
       select 1 from unnest(p_modules) m
       where m is null or not exists (select 1 from public.condition_modules c where c.key = m)
     ) then
    raise exception 'invalid_input';
  end if;

  insert into public.children (caregiver_id, name, age, pin_hash, privacy_tier)
  values (
    p_caregiver_id,
    v_name,
    p_age,
    p_pin_hash,
    -- Age bands from the architecture spec (section 3).
    case when p_age <= 8 then 'full' when p_age <= 12 then 'partial' else 'private' end
  )
  returning id into v_id;

  insert into public.child_modules (child_id, module_key)
  select v_id, m from (select distinct unnest(p_modules) m) s;

  return v_id;
end;
$$;

revoke all on function public.create_child(uuid, text, integer, text, text[]) from public, anon, authenticated;
grant execute on function public.create_child(uuid, text, integer, text, text[]) to service_role;

comment on function public.create_child(uuid, text, integer, text, text[]) is
  'The only way to add a child: validates fields, derives privacy_tier from age, inserts child + modules atomically. Service role only (create-child Edge Function).';
