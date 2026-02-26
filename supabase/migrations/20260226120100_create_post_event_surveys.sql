/*
  # Create Post-Event Survey System

  Tables in p0012_rotary schema:

  1. `post_event_surveys`
    - Tracks post-meeting, post-service, post-fundraiser surveys
    - event_type: 'meeting', 'service', 'fundraiser'
    - reference_id links to fundraiser_campaigns for fundraiser type

  2. `post_event_responses`
    - Stores structured ratings as JSONB
    - Meeting: {"meal":1-5, "admin_delivery":1-5, "speaker":1-5}
    - Service: {"organization":1-5, "impact":1-5, "enjoyment":1-5}
    - Fundraiser: {"organization":1-5, "fun_factor":1-5, "community_impact":1-5}
    - Plus optional comment text
*/

CREATE TABLE IF NOT EXISTS p0012_rotary.post_event_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('meeting', 'service', 'fundraiser')),
  event_date date NOT NULL,
  event_name text NOT NULL,
  reference_id uuid,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.post_event_surveys ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active surveys
CREATE POLICY "Authenticated users can read active post-event surveys"
  ON p0012_rotary.post_event_surveys
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Leaders can read all post-event surveys
CREATE POLICY "Leaders can read all post-event surveys"
  ON p0012_rotary.post_event_surveys
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM p0012_rotary.leadership_roles lr
      WHERE lr.member_id = auth.uid()
        AND lr.year = (
          CASE WHEN EXTRACT(MONTH FROM now()) >= 7 THEN
            EXTRACT(YEAR FROM now())::text || '-' || (EXTRACT(YEAR FROM now()) + 1)::text
          ELSE
            (EXTRACT(YEAR FROM now()) - 1)::text || '-' || EXTRACT(YEAR FROM now())::text
          END
        )
    )
    OR "0012-sr-is-admin"() = true
  );

-- Leaders can create post-event surveys
CREATE POLICY "Leaders can insert post-event surveys"
  ON p0012_rotary.post_event_surveys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM p0012_rotary.leadership_roles lr
      WHERE lr.member_id = auth.uid()
        AND lr.year = (
          CASE WHEN EXTRACT(MONTH FROM now()) >= 7 THEN
            EXTRACT(YEAR FROM now())::text || '-' || (EXTRACT(YEAR FROM now()) + 1)::text
          ELSE
            (EXTRACT(YEAR FROM now()) - 1)::text || '-' || EXTRACT(YEAR FROM now())::text
          END
        )
    )
    OR "0012-sr-is-admin"() = true
  );

-- Leaders can update post-event surveys
CREATE POLICY "Leaders can update post-event surveys"
  ON p0012_rotary.post_event_surveys
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM p0012_rotary.leadership_roles lr
      WHERE lr.member_id = auth.uid()
        AND lr.year = (
          CASE WHEN EXTRACT(MONTH FROM now()) >= 7 THEN
            EXTRACT(YEAR FROM now())::text || '-' || (EXTRACT(YEAR FROM now()) + 1)::text
          ELSE
            (EXTRACT(YEAR FROM now()) - 1)::text || '-' || EXTRACT(YEAR FROM now())::text
          END
        )
    )
    OR "0012-sr-is-admin"() = true
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM p0012_rotary.leadership_roles lr
      WHERE lr.member_id = auth.uid()
        AND lr.year = (
          CASE WHEN EXTRACT(MONTH FROM now()) >= 7 THEN
            EXTRACT(YEAR FROM now())::text || '-' || (EXTRACT(YEAR FROM now()) + 1)::text
          ELSE
            (EXTRACT(YEAR FROM now()) - 1)::text || '-' || EXTRACT(YEAR FROM now())::text
          END
        )
    )
    OR "0012-sr-is-admin"() = true
  );

-- Post-Event Responses
CREATE TABLE IF NOT EXISTS p0012_rotary.post_event_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES p0012_rotary.post_event_surveys(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES p0012_rotary.members(id),
  ratings jsonb NOT NULL DEFAULT '{}',
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(survey_id, member_id)
);

ALTER TABLE p0012_rotary.post_event_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read own post-event responses"
  ON p0012_rotary.post_event_responses
  FOR SELECT TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "Members can insert own post-event responses"
  ON p0012_rotary.post_event_responses
  FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "Leaders can read all post-event responses"
  ON p0012_rotary.post_event_responses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM p0012_rotary.leadership_roles lr
      WHERE lr.member_id = auth.uid()
        AND lr.year = (
          CASE WHEN EXTRACT(MONTH FROM now()) >= 7 THEN
            EXTRACT(YEAR FROM now())::text || '-' || (EXTRACT(YEAR FROM now()) + 1)::text
          ELSE
            (EXTRACT(YEAR FROM now()) - 1)::text || '-' || EXTRACT(YEAR FROM now())::text
          END
        )
    )
    OR "0012-sr-is-admin"() = true
  );
