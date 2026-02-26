/*
  # Create Idea Jar

  Table in p0012_rotary schema for capturing ideas from survey comments,
  suggestions, or manual entries. Leadership can tag, promote to agenda,
  or table for later.
*/

CREATE TABLE IF NOT EXISTS p0012_rotary.idea_jar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  source_type text DEFAULT 'manual' NOT NULL
    CHECK (source_type IN ('survey_comment', 'suggestion', 'manual')),
  source_id uuid,
  tags text[] DEFAULT '{}',
  status text DEFAULT 'new' NOT NULL
    CHECK (status IN ('new', 'proposed', 'on_agenda', 'tabled', 'completed')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.idea_jar ENABLE ROW LEVEL SECURITY;

-- Leaders can read all idea jar items
CREATE POLICY "Leaders can read idea jar"
  ON p0012_rotary.idea_jar
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

-- Leaders can insert idea jar items
CREATE POLICY "Leaders can insert idea jar"
  ON p0012_rotary.idea_jar
  FOR INSERT TO authenticated
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

-- Leaders can update idea jar items (tags, status)
CREATE POLICY "Leaders can update idea jar"
  ON p0012_rotary.idea_jar
  FOR UPDATE TO authenticated
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
