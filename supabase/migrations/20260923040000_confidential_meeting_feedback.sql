-- Ideas, Surveys & Suggestions: confidential meeting feedback (Paul's decisions D1–D5, 2026-09-23).
--
-- Surveys (post_event_*):
--   * Leaders no longer read raw answers. They call post_event_results(survey_id), which never returns
--     member_id, response ids or timestamps.
--   * D1: while a survey is open, leaders see only the response count and comments whose authors chose
--     "Include my name". Averages, distributions and unnamed comments appear after it closes.
--   * D2: results for a rating category need 3+ answers WITHOUT a name, from people other than the leader
--     viewing. D3: unnamed comments are text only, in scrambled order; named comments carry name + ratings.
--   * D5: members see only their own answers (no results, no counts).
--   * A survey is open from opens_at (the meeting start; midnight on event_date if unset) until
--     closes_at = 00:00 America/Denver on event_date + 7 (the end of the following Tuesday).
--     Answers are accepted only while open; after close a member can only turn their name off.
-- Suggestions (member_suggestions): "Send to leadership" and "Include my name" are separate; leaders read
--   shared suggestions through shared_suggestions(), with a name only when the author included it.
--   Existing shared suggestions keep their names.
-- Ideas (notes, deposit_idea): leaders can read and approve submitted ideas (with the author's name —
--   ideas are not confidential); members can no longer approve their own.

-- ===== 0. Grants =====
REVOKE ALL ON p0012_rotary.post_event_responses FROM anon;
REVOKE ALL ON p0012_rotary.post_event_surveys FROM anon;
REVOKE ALL ON p0012_rotary.member_suggestions FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON p0012_rotary.post_event_responses FROM authenticated;
REVOKE ALL ON p0012_rotary.post_event_responses FROM service_role;   -- no server key reads raw answers
GRANT SELECT, INSERT, UPDATE ON p0012_rotary.post_event_surveys TO service_role;   -- schedule-sync; never DELETE

-- ===== 1. Responses: opt-in name, edit time, validation, FK =====
ALTER TABLE p0012_rotary.post_event_responses
  ADD COLUMN share_name boolean NOT NULL DEFAULT false,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT post_event_responses_ratings_valid CHECK (
        jsonb_typeof(ratings) = 'object'
    AND NOT jsonb_path_exists(ratings, '$.* ? (@.type() != "number" || @ < 1 || @ > 5 || @ != @.floor())')
    AND NOT jsonb_path_exists(ratings, '$.keyvalue() ? (!(@.key like_regex "^[a-z_]{1,32}$"))')),
  ADD CONSTRAINT post_event_responses_comment_length CHECK (comment IS NULL OR char_length(comment) <= 2000);

-- A member relink (id change) carries their answers; a deleted member's answer stays, without a name.
ALTER TABLE p0012_rotary.post_event_responses ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE p0012_rotary.post_event_responses DROP CONSTRAINT post_event_responses_member_id_fkey;
ALTER TABLE p0012_rotary.post_event_responses
  ADD CONSTRAINT post_event_responses_member_id_fkey FOREIGN KEY (member_id)
  REFERENCES p0012_rotary.members(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- ===== 2. Surveys: open window, one survey per calendar event =====
ALTER TABLE p0012_rotary.post_event_surveys
  ADD COLUMN opens_at timestamptz,
  ADD COLUMN closes_at timestamptz
    GENERATED ALWAYS AS (((event_date + 7)::timestamp AT TIME ZONE 'America/Denver')) STORED;
ALTER TABLE p0012_rotary.post_event_surveys
  ADD CONSTRAINT post_event_surveys_reference_id_key UNIQUE (reference_id);   -- NULLs stay distinct

-- ===== 3. Helpers =====
CREATE OR REPLACE FUNCTION p0012_rotary.current_rotary_year()
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN extract(month FROM d) >= 7
              THEN extract(year FROM d)::int::text || '-' || (extract(year FROM d)::int + 1)::text
              ELSE (extract(year FROM d)::int - 1)::text || '-' || extract(year FROM d)::int::text END
  FROM (SELECT now() AT TIME ZONE 'America/Denver' AS d) x;
$$;

CREATE OR REPLACE FUNCTION p0012_rotary.is_current_leader_or_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
         EXISTS (SELECT 1 FROM p0012_rotary.leadership_roles lr
                 WHERE lr.member_id = auth.uid() AND lr.year = p0012_rotary.current_rotary_year())
      OR public."0012-sr-is-admin"());
$$;

CREATE OR REPLACE FUNCTION p0012_rotary.post_event_survey_is_open(p_survey_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM p0012_rotary.post_event_surveys s
                 WHERE s.id = p_survey_id AND s.is_active
                   AND now() >= COALESCE(s.opens_at, s.event_date::timestamp AT TIME ZONE 'America/Denver')
                   AND now() < s.closes_at);
$$;

REVOKE ALL ON FUNCTION p0012_rotary.current_rotary_year() FROM PUBLIC;
REVOKE ALL ON FUNCTION p0012_rotary.is_current_leader_or_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION p0012_rotary.post_event_survey_is_open(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p0012_rotary.is_current_leader_or_admin() TO authenticated;      -- used in RLS
GRANT EXECUTE ON FUNCTION p0012_rotary.post_event_survey_is_open(uuid) TO authenticated;   -- RLS + guard

-- ===== 4. Guards =====
CREATE OR REPLACE FUNCTION p0012_rotary.post_event_responses_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.survey_id IS DISTINCT FROM OLD.survey_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'A survey answer cannot be moved' USING ERRCODE = '42501';
  END IF;
  -- member_id: RLS pins it for members; the FK cascade (relink / member delete) may change it.
  IF (NEW.ratings IS DISTINCT FROM OLD.ratings OR NEW.comment IS DISTINCT FROM OLD.comment
      OR (NEW.share_name AND NOT OLD.share_name))
     AND NOT p0012_rotary.post_event_survey_is_open(OLD.survey_id) THEN
    RAISE EXCEPTION 'This survey has closed' USING ERRCODE = '42501';   -- after close: only "hide my name"
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION p0012_rotary.post_event_responses_guard() FROM PUBLIC;
CREATE TRIGGER post_event_responses_guard
  BEFORE INSERT OR UPDATE ON p0012_rotary.post_event_responses
  FOR EACH ROW EXECUTE FUNCTION p0012_rotary.post_event_responses_guard();

CREATE OR REPLACE FUNCTION p0012_rotary.post_event_surveys_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- event_date drives closes_at: fixed once open, so nobody can close early, look, reopen and compare.
  IF NEW.event_date IS DISTINCT FROM OLD.event_date
     AND now() >= COALESCE(OLD.opens_at, OLD.event_date::timestamp AT TIME ZONE 'America/Denver') THEN
    RAISE EXCEPTION 'The date of a survey cannot change after it opens' USING ERRCODE = '42501';
  END IF;
  IF OLD.reference_id IS NOT NULL AND NEW.reference_id IS DISTINCT FROM OLD.reference_id THEN
    RAISE EXCEPTION 'A survey cannot be re-linked to another calendar event' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION p0012_rotary.post_event_surveys_guard() FROM PUBLIC;
CREATE TRIGGER post_event_surveys_guard
  BEFORE UPDATE ON p0012_rotary.post_event_surveys
  FOR EACH ROW EXECUTE FUNCTION p0012_rotary.post_event_surveys_guard();

-- ===== 5. Response policies: no leader row access; insert only while open; update own =====
-- (Edits use .update().eq('id'), not upsert: an upsert re-checks the INSERT policy.)
DROP POLICY IF EXISTS "Leaders can read all post-event responses" ON p0012_rotary.post_event_responses;
DROP POLICY IF EXISTS "Members can insert own post-event responses" ON p0012_rotary.post_event_responses;
CREATE POLICY "Members can insert own post-event responses while open"
  ON p0012_rotary.post_event_responses FOR INSERT TO authenticated
  WITH CHECK (member_id = (SELECT auth.uid()) AND p0012_rotary.post_event_survey_is_open(survey_id));
CREATE POLICY "Members can update own post-event responses"
  ON p0012_rotary.post_event_responses FOR UPDATE TO authenticated
  USING (member_id = (SELECT auth.uid()))
  WITH CHECK (member_id = (SELECT auth.uid()));

-- Answered surveys stay readable after is_active = false (My history).
CREATE POLICY "Members can read surveys they answered"
  ON p0012_rotary.post_event_surveys FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM p0012_rotary.post_event_responses r
                 WHERE r.survey_id = post_event_surveys.id AND r.member_id = (SELECT auth.uid())));

-- ===== 6. Results for leaders =====
CREATE OR REPLACE FUNCTION p0012_rotary.post_event_results(p_survey_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_min      CONSTANT int := 3;
  v_uid      uuid := auth.uid();
  v_survey   p0012_rotary.post_event_surveys%ROWTYPE;
  v_keys     text[];
  v_closed   boolean;
  v_count    int;
  v_pool     int := 0;
  v_averages jsonb := '{}'::jsonb;
  v_dist     jsonb := '{}'::jsonb;
  v_comments jsonb;
BEGIN
  IF v_uid IS NULL OR NOT p0012_rotary.is_current_leader_or_admin() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';   -- D5: members get no results or counts
  END IF;

  SELECT * INTO v_survey FROM p0012_rotary.post_event_surveys WHERE id = p_survey_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_closed := now() >= v_survey.closes_at;
  SELECT count(*)::int INTO v_count FROM p0012_rotary.post_event_responses r WHERE r.survey_id = p_survey_id;

  v_keys := CASE v_survey.event_type
              WHEN 'meeting'    THEN ARRAY['speaker', 'meal']
              WHEN 'service'    THEN ARRAY['organization', 'impact', 'enjoyment']
              WHEN 'fundraiser' THEN ARRAY['organization', 'fun_factor', 'community_impact'] END;

  IF v_closed THEN   -- D1: nothing but the count and named comments while open
    WITH base AS (
      SELECT r.ratings,
             NOT (r.share_name AND r.member_id IS NOT NULL) AS is_unnamed,
             COALESCE(r.member_id = v_uid, false)          AS is_viewer
      FROM p0012_rotary.post_event_responses r
      WHERE r.survey_id = p_survey_id
    ), vals AS (
      SELECT b.is_unnamed, b.is_viewer, e.key, e.value::int AS v
      FROM base b CROSS JOIN LATERAL jsonb_each_text(b.ratings) AS e(key, value)
      WHERE e.key = ANY (v_keys) AND e.value ~ '^[1-5]$'
    ), per_key AS (
      SELECT key,
             count(*)                                             AS n,
             count(*) FILTER (WHERE is_unnamed AND NOT is_viewer) AS pool,   -- D2, per category
             round(avg(v), 1)                                     AS avg_v,
             jsonb_build_object('1', count(*) FILTER (WHERE v = 1), '2', count(*) FILTER (WHERE v = 2),
                                '3', count(*) FILTER (WHERE v = 3), '4', count(*) FILTER (WHERE v = 4),
                                '5', count(*) FILTER (WHERE v = 5), 'n', count(*)) AS dist
      FROM vals GROUP BY key
    )
    SELECT (SELECT count(*)::int FROM base WHERE is_unnamed AND NOT is_viewer),
           COALESCE((SELECT jsonb_object_agg(key, jsonb_build_object('avg', avg_v, 'n', n))
                     FROM per_key WHERE pool >= c_min), '{}'::jsonb),
           COALESCE((SELECT jsonb_object_agg(key, dist) FROM per_key WHERE pool >= c_min), '{}'::jsonb)
      INTO v_pool, v_averages, v_dist;
  END IF;

  -- D3: named comments (consented) show at once with name + ratings; unnamed ones are text only,
  -- and only after close with 3+ unnamed answers from others. Scrambled order, never submission order.
  SELECT COALESCE(jsonb_agg(
           CASE WHEN c.name IS NOT NULL
                THEN jsonb_build_object('text', c.text, 'name', c.name, 'ratings', c.ratings)
                ELSE jsonb_build_object('text', c.text, 'name', NULL) END
           ORDER BY md5(c.text || p_survey_id::text), c.text), '[]'::jsonb)
    INTO v_comments
  FROM (SELECT btrim(r.comment) AS text,
               CASE WHEN r.share_name THEN NULLIF(btrim(concat_ws(' ', m.first_name, m.last_name)), '') END AS name,
               (SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
                  FROM jsonb_each(r.ratings) e WHERE e.key = ANY (v_keys)) AS ratings
        FROM p0012_rotary.post_event_responses r
        LEFT JOIN p0012_rotary.members m ON m.id = r.member_id
        WHERE r.survey_id = p_survey_id AND NULLIF(btrim(r.comment), '') IS NOT NULL) c
  WHERE c.name IS NOT NULL OR (v_closed AND v_pool >= c_min);

  RETURN jsonb_build_object(
    'survey_id', v_survey.id, 'event_type', v_survey.event_type, 'event_date', v_survey.event_date,
    'event_name', v_survey.event_name, 'opens_at', v_survey.opens_at, 'closes_at', v_survey.closes_at,
    'closed', v_closed, 'count', v_count, 'min_responses', c_min,
    'results_visible', v_averages <> '{}'::jsonb,
    'averages',     CASE WHEN v_averages <> '{}'::jsonb THEN v_averages END,
    'distribution', CASE WHEN v_dist     <> '{}'::jsonb THEN v_dist     END,
    'comments', v_comments);
END;
$$;
REVOKE ALL ON FUNCTION p0012_rotary.post_event_results(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p0012_rotary.post_event_results(uuid) TO authenticated;

-- ===== 7. Suggestions: separate "Include my name" =====
ALTER TABLE p0012_rotary.member_suggestions
  ADD COLUMN share_name boolean NOT NULL DEFAULT false;
UPDATE p0012_rotary.member_suggestions SET share_name = true WHERE share_with_leadership;   -- keep existing names

DROP POLICY IF EXISTS "Leaders can read shared suggestions" ON p0012_rotary.member_suggestions;

CREATE OR REPLACE FUNCTION p0012_rotary.shared_suggestions()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT p0012_rotary.is_current_leader_or_admin() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  -- Date only (no time of day), newest day first; unnamed ones never carry member_id.
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('text', x.text, 'date', x.day, 'name', x.name)
                     ORDER BY x.day DESC, md5(x.text))
    FROM (SELECT s.suggestion_text AS text,
                 (s.created_at AT TIME ZONE 'America/Denver')::date AS day,
                 CASE WHEN s.share_name THEN NULLIF(btrim(concat_ws(' ', m.first_name, m.last_name)), '') END AS name
          FROM p0012_rotary.member_suggestions s
          LEFT JOIN p0012_rotary.members m ON m.id = s.member_id
          WHERE s.share_with_leadership) x), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION p0012_rotary.shared_suggestions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p0012_rotary.shared_suggestions() TO authenticated;

-- ===== 8. Ideas: leaders read + approve; members can't approve =====
CREATE POLICY "Leaders can read deposit ideas"
  ON p0012_rotary.notes FOR SELECT TO authenticated
  USING (deposit_idea = true AND p0012_rotary.is_current_leader_or_admin());
CREATE POLICY "Leaders can approve deposit ideas"
  ON p0012_rotary.notes FOR UPDATE TO authenticated
  USING (deposit_idea = true AND p0012_rotary.is_current_leader_or_admin())
  WITH CHECK (deposit_idea = true AND p0012_rotary.is_current_leader_or_admin());

CREATE OR REPLACE FUNCTION p0012_rotary.notes_guard_idea_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_leader boolean;
  v_other  p0012_rotary.notes;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  v_leader := p0012_rotary.is_current_leader_or_admin();
  IF TG_OP = 'INSERT' THEN
    IF NOT v_leader THEN
      NEW.deposit_idea_approved := false;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.deposit_idea_approved IS DISTINCT FROM OLD.deposit_idea_approved AND NOT v_leader THEN
    RAISE EXCEPTION 'Only a leader can approve an idea' USING ERRCODE = '42501';
  END IF;
  -- A leader editing someone else's idea may only change its approval.
  IF v_leader AND OLD.user_id IS DISTINCT FROM auth.uid() THEN
    v_other := NEW;
    v_other.deposit_idea_approved := OLD.deposit_idea_approved;
    IF v_other IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Leaders can only approve or un-approve another member''s idea' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION p0012_rotary.notes_guard_idea_approval() FROM PUBLIC;
CREATE TRIGGER notes_guard_idea_approval
  BEFORE INSERT OR UPDATE ON p0012_rotary.notes
  FOR EACH ROW EXECUTE FUNCTION p0012_rotary.notes_guard_idea_approval();
