/*
  # Create Weekly Surveys System

  1. New Tables
    - `0012-sr-weekly-surveys`
      - `id` (uuid, primary key)
      - `question_text` (text, not null) - the survey question
      - `survey_type` (text, default 'speaker_rating') - extensible type
      - `meeting_date` (date, not null) - the Wednesday meeting this survey is for
      - `created_by` (uuid, FK to auth.users)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)

    - `0012-sr-survey-responses`
      - `id` (uuid, primary key)
      - `survey_id` (uuid, FK to weekly-surveys)
      - `member_id` (uuid, FK to members)
      - `rating` (integer, 1-5)
      - `comment` (text, optional)
      - `created_at` (timestamptz)
      - UNIQUE(survey_id, member_id) - one response per member per survey

  2. Security
    - RLS enabled on both tables
    - Members can read active surveys and their own responses
    - Members can insert their own responses
    - Leaders can read all responses and manage surveys
*/

CREATE TABLE IF NOT EXISTS "0012-sr-weekly-surveys" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  survey_type text DEFAULT 'speaker_rating' NOT NULL,
  meeting_date date NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE "0012-sr-weekly-surveys" ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active surveys
CREATE POLICY "Authenticated users can read active surveys"
  ON "0012-sr-weekly-surveys"
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Leaders and admins can read all surveys (including inactive)
CREATE POLICY "Leaders can read all surveys"
  ON "0012-sr-weekly-surveys"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "0012-sr-leadership-roles" lr
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
  ON "0012-sr-weekly-surveys"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "0012-sr-leadership-roles" lr
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
  ON "0012-sr-weekly-surveys"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "0012-sr-leadership-roles" lr
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
      SELECT 1 FROM "0012-sr-leadership-roles" lr
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
CREATE TABLE IF NOT EXISTS "0012-sr-survey-responses" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES "0012-sr-weekly-surveys"(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES "0012-sr-members"(id),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(survey_id, member_id)
);

ALTER TABLE "0012-sr-survey-responses" ENABLE ROW LEVEL SECURITY;

-- Members can read their own responses
CREATE POLICY "Members can read own responses"
  ON "0012-sr-survey-responses"
  FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

-- Members can insert their own responses
CREATE POLICY "Members can insert own responses"
  ON "0012-sr-survey-responses"
  FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

-- Leaders can read all responses
CREATE POLICY "Leaders can read all responses"
  ON "0012-sr-survey-responses"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "0012-sr-leadership-roles" lr
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
