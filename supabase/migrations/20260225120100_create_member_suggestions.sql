/*
  # Create Member Suggestions (Suggestion Box)

  1. New Table (in p0012_rotary schema)
    - `member_suggestions`
      - `id` (uuid, primary key)
      - `member_id` (uuid, FK to members)
      - `suggestion_text` (text, not null)
      - `share_with_leadership` (boolean, default false)
      - `created_at` (timestamptz)

  2. Security
    - Members can CRUD their own suggestions
    - Leaders can read suggestions shared with leadership
*/

CREATE TABLE IF NOT EXISTS p0012_rotary.member_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES p0012_rotary.members(id),
  suggestion_text text NOT NULL,
  share_with_leadership boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.member_suggestions ENABLE ROW LEVEL SECURITY;

-- Members can read their own suggestions
CREATE POLICY "Members can read own suggestions"
  ON p0012_rotary.member_suggestions
  FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

-- Members can insert their own suggestions
CREATE POLICY "Members can insert own suggestions"
  ON p0012_rotary.member_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

-- Members can update their own suggestions
CREATE POLICY "Members can update own suggestions"
  ON p0012_rotary.member_suggestions
  FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- Members can delete their own suggestions
CREATE POLICY "Members can delete own suggestions"
  ON p0012_rotary.member_suggestions
  FOR DELETE
  TO authenticated
  USING (member_id = auth.uid());

-- Leaders can read shared suggestions
CREATE POLICY "Leaders can read shared suggestions"
  ON p0012_rotary.member_suggestions
  FOR SELECT
  TO authenticated
  USING (
    share_with_leadership = true
    AND (
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
  );
