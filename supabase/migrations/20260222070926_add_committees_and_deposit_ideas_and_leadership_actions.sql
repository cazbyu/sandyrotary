/*
  # Add committees, deposit idea approval, and leadership actions

  1. Modified Tables
    - `0012-sr-members`
      - Added `committees` (text[], default '{}') - list of committee names the member belongs to
    - `0012-sr-notes`
      - Added `deposit_idea_approved` (boolean, default false) - whether a deposit idea has been approved by leadership
      - Added `deposit_idea_category` (text) - category for deposit ideas (e.g., 'service_project', 'fundraising', 'meeting', 'speaker', 'committee', 'other')

  2. New Tables
    - `0012-sr-leadership-actions`
      - `id` (uuid, primary key)
      - `assignment` (text, not null) - description of the action/task
      - `responsible_member_id` (uuid, FK to members) - the member responsible
      - `due_date` (date) - when the action is due
      - `status` (text, default 'pending') - pending, in_progress, completed, cancelled
      - `created_by` (uuid, FK to auth.users) - who created the action
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - RLS enabled on `0012-sr-leadership-actions`
    - Leaders can view actions assigned to them
    - President, President-Elect, Past President, President Nominee, Secretary can view all actions
    - Leaders can create and update actions
    - Notes: existing RLS allows user_id = auth.uid() full access; add SELECT policy for approved deposit ideas visible to all authenticated users
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0012-sr-members' AND column_name = 'committees'
  ) THEN
    ALTER TABLE "0012-sr-members" ADD COLUMN committees text[] DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0012-sr-notes' AND column_name = 'deposit_idea_approved'
  ) THEN
    ALTER TABLE "0012-sr-notes" ADD COLUMN deposit_idea_approved boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0012-sr-notes' AND column_name = 'deposit_idea_category'
  ) THEN
    ALTER TABLE "0012-sr-notes" ADD COLUMN deposit_idea_category text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "0012-sr-leadership-actions" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment text NOT NULL,
  responsible_member_id uuid REFERENCES "0012-sr-members"(id),
  due_date date,
  status text DEFAULT 'pending' NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE "0012-sr-leadership-actions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaders can view own actions"
  ON "0012-sr-leadership-actions"
  FOR SELECT
  TO authenticated
  USING (
    responsible_member_id = auth.uid()
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
  );

CREATE POLICY "Leaders can insert actions"
  ON "0012-sr-leadership-actions"
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

CREATE POLICY "Leaders can update actions"
  ON "0012-sr-leadership-actions"
  FOR UPDATE
  TO authenticated
  USING (
    responsible_member_id = auth.uid()
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

CREATE POLICY "Leaders can delete actions"
  ON "0012-sr-leadership-actions"
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

CREATE POLICY "Authenticated users can view approved deposit ideas"
  ON "0012-sr-notes"
  FOR SELECT
  TO authenticated
  USING (deposit_idea = true AND deposit_idea_approved = true);
