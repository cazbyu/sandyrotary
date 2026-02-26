/*
  # Create Pre-Meeting Survey System

  1. New Tables (in p0012_rotary schema)
    - `weekly_surveys`
      - `id` (uuid, primary key)
      - `question_text` (text, not null) - the survey question
      - `survey_type` (text, default 'pre_meeting') - extensible type
      - `meeting_date` (date, not null) - the Wednesday meeting this survey is for
      - `created_by` (uuid, FK to auth.users)
      - `is_active` (boolean, default true)
      - `choices` (text[], nullable) - multiple choice options
      - `created_at` (timestamptz)

    - `survey_responses`
      - `id` (uuid, primary key)
      - `survey_id` (uuid, FK to weekly_surveys)
      - `member_id` (uuid, FK to members)
      - `rating` (integer, 1-5, nullable) - legacy star rating support
      - `choice_index` (integer, nullable) - index of selected choice
      - `comment` (text, optional) - member comments
      - `created_at` (timestamptz)
      - UNIQUE(survey_id, member_id) - one response per member per survey

  2. Security
    - RLS enabled on both tables
    - Members can read active surveys and their own responses
    - Members can insert their own responses
    - Leaders can read all responses and manage surveys
*/

SET search_path TO p0012_rotary, public;

CREATE TABLE IF NOT EXISTS p0012_rotary.weekly_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  survey_type text DEFAULT 'pre_meeting' NOT NULL,
  meeting_date date NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  is_active boolean DEFAULT true NOT NULL,
  choices text[],
  created_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.weekly_surveys ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active surveys
CREATE POLICY "Authenticated users can read active surveys"
  ON p0012_rotary.weekly_surveys
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Leaders and admins can read all surveys (including inactive)
CREATE POLICY "Leaders can read all surveys"
  ON p0012_rotary.weekly_surveys
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM p0012_rotary.leadership_roles lr
      WHERE lr.member_id = auth.uid()
        AND lr.year = (
          CASE
            WHEN EXTRACT(MONTH FROM now()) >= 7 THEN
              EXTRACT(YEAR FROM now())::text || '-' || (EXTRACT(YEAR FROM now()) + 1)::text
            ELSE
              (EXTRACT(YEAR FROM now()) - 1)::text || '-' || EXTRACT(YEAR FROM now())::text
          END
        )
    )
    OR "0012-sr-is-admin"() = true
  );

-- Leaders and admins can create surveys
CREATE POLICY "Leaders can insert surveys"
  ON p0012_rotary.weekly_surveys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM p0012_rotary.leadership_roles lr
      WHERE lr.member_id = auth.uid()
        AND lr.year = (
          CASE
            WHEN EXTRACT(MONTH FROM now()) >= 7 THEN
              EXTRACT(YEAR FROM now())::text || '-' || (EXTRACT(YEAR FROM now()) + 1)::text
            ELSE
              (EXTRACT(YEAR FROM now()) - 1)::text || '-' || EXTRACT(YEAR FROM now())::text
          END
        )
    )
    OR "0012-sr-is-admin"() = true
  );

-- Leaders and admins can update surveys
CREATE POLICY "Leaders can update surveys"
  ON p0012_rotary.weekly_surveys
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM p0012_rotary.leadership_roles lr
      WHERE lr.member_id = auth.uid()
        AND lr.year = (
          CASE
            WHEN EXTRACT(MONTH FROM now()) >= 7 THEN
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
          CASE
            WHEN EXTRACT(MONTH FROM now()) >= 7 THEN
              EXTRACT(YEAR FROM now())::text || '-' || (EXTRACT(YEAR FROM now()) + 1)::text
            ELSE
              (EXTRACT(YEAR FROM now()) - 1)::text || '-' || EXTRACT(YEAR FROM now())::text
          END
        )
    )
    OR "0012-sr-is-admin"() = true
  );

-- Survey Responses table
CREATE TABLE IF NOT EXISTS p0012_rotary.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES p0012_rotary.weekly_surveys(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES p0012_rotary.members(id),
  rating integer CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  choice_index integer,
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(survey_id, member_id)
);

ALTER TABLE p0012_rotary.survey_responses ENABLE ROW LEVEL SECURITY;

-- Members can read their own responses
CREATE POLICY "Members can read own responses"
  ON p0012_rotary.survey_responses
  FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

-- Members can insert their own responses
CREATE POLICY "Members can insert own responses"
  ON p0012_rotary.survey_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

-- Leaders can read all responses
CREATE POLICY "Leaders can read all responses"
  ON p0012_rotary.survey_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM p0012_rotary.leadership_roles lr
      WHERE lr.member_id = auth.uid()
        AND lr.year = (
          CASE
            WHEN EXTRACT(MONTH FROM now()) >= 7 THEN
              EXTRACT(YEAR FROM now())::text || '-' || (EXTRACT(YEAR FROM now()) + 1)::text
            ELSE
              (EXTRACT(YEAR FROM now()) - 1)::text || '-' || EXTRACT(YEAR FROM now())::text
          END
        )
    )
    OR "0012-sr-is-admin"() = true
  );
