/*
  # Create leadership action notes join table

  1. New Tables
    - `0012-sr-leadership-action-notes`
      - `id` (uuid, primary key)
      - `action_id` (uuid, FK to leadership-actions)
      - `note_id` (uuid, FK to notes)
      - `created_at` (timestamptz)
    
  2. Security
    - RLS enabled
    - Same access pattern as leadership-actions: leaders can manage, assigned members can view
*/

CREATE TABLE IF NOT EXISTS "0012-sr-leadership-action-notes" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES "0012-sr-leadership-actions"(id) ON DELETE CASCADE,
  note_id uuid NOT NULL REFERENCES "0012-sr-notes"(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE "0012-sr-leadership-action-notes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaders can view action notes"
  ON "0012-sr-leadership-action-notes"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "0012-sr-leadership-actions" la
      WHERE la.id = action_id
        AND (
          la.responsible_member_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM "0012-sr-leadership-roles" lr
            WHERE lr.member_id = auth.uid()
              AND lr.role_name IN ('President', 'President-Elect', 'Past President', 'President Nominee', 'Secretary')
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
    )
  );

CREATE POLICY "Leaders can insert action notes"
  ON "0012-sr-leadership-action-notes"
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

CREATE POLICY "Leaders can delete action notes"
  ON "0012-sr-leadership-action-notes"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "0012-sr-leadership-roles" lr
      WHERE lr.member_id = auth.uid()
        AND lr.role_name IN ('President', 'President-Elect', 'Past President', 'President Nominee', 'Secretary')
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
