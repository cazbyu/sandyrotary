-- Security: block self-promotion to admin on p0012_rotary.members (found 2026-09-23).
--
-- Before this migration:
--   * "0012-sr-members-update-own" had no column limits, so any member could set their own role = 'admin'
--     (and "0012-sr-is-admin"() — the check behind every leader/admin policy — then returned true).
--   * "0012-sr-members-insert-admin" allowed id = auth.uid(), so any signed-in user without a members row
--     (the Supabase project's auth pool is shared with other apps) could insert themselves as admin.
--   * "Users can link member profile by matching email" also allowed role/status changes, and could relink
--     a row that already belongs to another login.
--
-- After:
--   * Only admins insert members (service_role / postgres bypass RLS as before). The app has no
--     self-join insert path (AuthContext only relinks an existing row by email).
--   * A BEFORE INSERT OR UPDATE trigger stops non-admin API callers from setting or changing the
--     admin-only fields: role, member_status, member_title, membership_start_date, committees, created_at.
--   * A non-admin may change a row's id only to link it to themselves, and only if the row is not
--     already linked to an existing login (the email-link flow keeps working for unlinked rows).

-- 1. Only admins insert.
DROP POLICY IF EXISTS "0012-sr-members-insert-admin" ON p0012_rotary.members;
CREATE POLICY "0012-sr-members-insert-admin" ON p0012_rotary.members
  FOR INSERT TO authenticated
  WITH CHECK (public."0012-sr-is-admin"() = true);

-- 2. Helper: is this id an existing login? (SECURITY DEFINER: API roles can't read auth.users.)
CREATE OR REPLACE FUNCTION p0012_rotary.member_id_is_login(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_id);
$$;
REVOKE ALL ON FUNCTION p0012_rotary.member_id_is_login(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p0012_rotary.member_id_is_login(uuid) TO authenticated;

-- 3. Guard trigger. SECURITY INVOKER on purpose: current_user is the API role (authenticated/anon),
--    while service_role, postgres and SECURITY DEFINER functions are trusted and skip the checks.
CREATE OR REPLACE FUNCTION p0012_rotary.members_guard_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public."0012-sr-is-admin"() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- The INSERT policy already refuses non-admins; if a path ever allows it, the row starts powerless.
    NEW.role := 'member';
    NEW.member_status := 'Inactive';
    NEW.member_title := NULL;
    NEW.membership_start_date := NULL;
    NEW.committees := '{}';
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.member_status IS DISTINCT FROM OLD.member_status
     OR NEW.member_title IS DISTINCT FROM OLD.member_title
     OR NEW.membership_start_date IS DISTINCT FROM OLD.membership_start_date
     OR NEW.committees IS DISTINCT FROM OLD.committees
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only an admin can change role, status, title, start date or committees'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     AND (NEW.id IS DISTINCT FROM auth.uid() OR p0012_rotary.member_id_is_login(OLD.id)) THEN
    RAISE EXCEPTION 'This member profile is already linked to another login'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION p0012_rotary.members_guard_privileged_fields() FROM PUBLIC;

DROP TRIGGER IF EXISTS members_guard_privileged_fields ON p0012_rotary.members;
CREATE TRIGGER members_guard_privileged_fields
  BEFORE INSERT OR UPDATE ON p0012_rotary.members
  FOR EACH ROW EXECUTE FUNCTION p0012_rotary.members_guard_privileged_fields();
