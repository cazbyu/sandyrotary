-- Confidential meeting feedback: hardening after review (2026-09-23).
--
-- 1. Leaders could move a survey's opens_at / event_date to make it look closed, read the results
--    that D1 hides while a survey is open, then move it back. Manual survey creation is retired (D7),
--    so leaders no longer insert or update surveys at all (schedule-sync uses the service key), and
--    the guard freezes event_type / event_date for everyone once a survey has opened, and opens_at
--    for API callers.
-- 2. An answer that was ever shown with a name (share_name true at any point) no longer counts toward
--    the 3-answer threshold, and its comment is never listed as unnamed — turning the name off later
--    can't hide it among the unnamed answers.
-- 3. "Include my name" now shows the name with the ratings even without a comment, so the member-facing
--    promise ("Leaders will see your name with this feedback") holds.

-- ===== 1. Surveys: no leader writes; freeze after open =====
DROP POLICY IF EXISTS "Leaders can insert post-event surveys" ON p0012_rotary.post_event_surveys;
DROP POLICY IF EXISTS "Leaders can update post-event surveys" ON p0012_rotary.post_event_surveys;

CREATE OR REPLACE FUNCTION p0012_rotary.post_event_surveys_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_opened boolean := now() >= COALESCE(OLD.opens_at, OLD.event_date::timestamp AT TIME ZONE 'America/Denver');
BEGIN
  -- event_date drives closes_at: fixed once open, so nobody can close early, look, reopen and compare.
  IF v_opened AND (NEW.event_date IS DISTINCT FROM OLD.event_date OR NEW.event_type IS DISTINCT FROM OLD.event_type) THEN
    RAISE EXCEPTION 'The date of a survey cannot change after it opens' USING ERRCODE = '42501';
  END IF;
  IF v_opened AND NEW.opens_at IS DISTINCT FROM OLD.opens_at AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'The opening time of a survey cannot change after it opens' USING ERRCODE = '42501';
  END IF;
  IF OLD.reference_id IS NOT NULL AND NEW.reference_id IS DISTINCT FROM OLD.reference_id THEN
    RAISE EXCEPTION 'A survey cannot be re-linked to another calendar event' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- ===== 2. Remember that a name was shown =====
ALTER TABLE p0012_rotary.post_event_responses
  ADD COLUMN name_ever_shared boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION p0012_rotary.post_event_responses_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.updated_at := now();
    NEW.name_ever_shared := NEW.share_name;
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
  NEW.name_ever_shared := OLD.name_ever_shared OR NEW.share_name;      -- sticky; callers can't clear it
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ===== 3. Results =====
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

  IF v_closed THEN   -- D1: nothing but the count and named answers while open
    WITH base AS (
      SELECT r.ratings,
             -- D2: only answers that never carried a name, from people other than the viewer
             (NOT r.name_ever_shared AND NOT COALESCE(r.member_id = v_uid, false)) AS in_pool
      FROM p0012_rotary.post_event_responses r
      WHERE r.survey_id = p_survey_id
    ), vals AS (
      SELECT b.in_pool, e.key, e.value::int AS v
      FROM base b CROSS JOIN LATERAL jsonb_each_text(b.ratings) AS e(key, value)
      WHERE e.key = ANY (v_keys) AND e.value ~ '^[1-5]$'
    ), per_key AS (
      SELECT key,
             count(*)                          AS n,
             count(*) FILTER (WHERE in_pool)   AS pool,   -- per category
             round(avg(v), 1)                  AS avg_v,
             jsonb_build_object('1', count(*) FILTER (WHERE v = 1), '2', count(*) FILTER (WHERE v = 2),
                                '3', count(*) FILTER (WHERE v = 3), '4', count(*) FILTER (WHERE v = 4),
                                '5', count(*) FILTER (WHERE v = 5), 'n', count(*)) AS dist
      FROM vals GROUP BY key
    )
    SELECT (SELECT count(*)::int FROM base WHERE in_pool),
           COALESCE((SELECT jsonb_object_agg(key, jsonb_build_object('avg', avg_v, 'n', n))
                     FROM per_key WHERE pool >= c_min), '{}'::jsonb),
           COALESCE((SELECT jsonb_object_agg(key, dist) FROM per_key WHERE pool >= c_min), '{}'::jsonb)
      INTO v_pool, v_averages, v_dist;
  END IF;

  -- D3: named answers (consented) show at once with name + ratings, with or without a comment.
  -- Unnamed comments are text only, only after close with 3+ answers in the pool, and never from an
  -- answer that once carried a name. Scrambled order, never submission order.
  SELECT COALESCE(jsonb_agg(
           CASE WHEN c.name IS NOT NULL
                THEN jsonb_build_object('text', c.text, 'name', c.name, 'ratings', c.ratings)
                ELSE jsonb_build_object('text', c.text, 'name', NULL) END
           ORDER BY md5(COALESCE(c.text, '') || COALESCE(c.name, '') || p_survey_id::text)), '[]'::jsonb)
    INTO v_comments
  FROM (SELECT NULLIF(btrim(r.comment), '') AS text,
               CASE WHEN r.share_name THEN NULLIF(btrim(concat_ws(' ', m.first_name, m.last_name)), '') END AS name,
               r.name_ever_shared,
               (SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
                  FROM jsonb_each(r.ratings) e WHERE e.key = ANY (v_keys)) AS ratings
        FROM p0012_rotary.post_event_responses r
        LEFT JOIN p0012_rotary.members m ON m.id = r.member_id
        WHERE r.survey_id = p_survey_id) c
  WHERE c.name IS NOT NULL
     OR (c.text IS NOT NULL AND NOT c.name_ever_shared AND v_closed AND v_pool >= c_min);

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
