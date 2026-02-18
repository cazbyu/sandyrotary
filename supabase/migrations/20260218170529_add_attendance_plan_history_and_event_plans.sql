/*
  # Attendance Plan History and Event Attendance Plans

  1. Changes to `0012-sr-attendance-plans`
    - Add `event_id` (uuid, nullable FK to `0012-sr-calendar-events`) to distinguish
      non-club-meeting event rows from regular meeting rows

  2. New Table: `0012-sr-attendance-plan-history`
    - Timestamped log of every toggle so accidental changes can be recovered
    - Columns: id, member_id, meeting_date, event_id (nullable), is_attending,
               toggled_at, toggled_by

  3. Security
    - Enable RLS on history table
    - Members can read/insert their own history
    - Leaders (anyone in leadership-roles) can read/insert all history
*/

-- Add event_id column to attendance-plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0012-sr-attendance-plans' AND column_name = 'event_id'
  ) THEN
    ALTER TABLE "0012-sr-attendance-plans"
      ADD COLUMN event_id uuid REFERENCES "0012-sr-calendar-events"(id) ON DELETE CASCADE;
  END IF;
END $$;

-- History table
CREATE TABLE IF NOT EXISTS "0012-sr-attendance-plan-history" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  meeting_date date NOT NULL,
  event_id uuid REFERENCES "0012-sr-calendar-events"(id) ON DELETE SET NULL,
  is_attending boolean NOT NULL,
  toggled_at timestamptz NOT NULL DEFAULT now(),
  toggled_by uuid
);

ALTER TABLE "0012-sr-attendance-plan-history" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own plan history"
  ON "0012-sr-attendance-plan-history"
  FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "Leaders can view all plan history"
  ON "0012-sr-attendance-plan-history"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "0012-sr-leadership-roles"
      WHERE member_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert own plan history"
  ON "0012-sr-attendance-plan-history"
  FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "Leaders can insert any plan history"
  ON "0012-sr-attendance-plan-history"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "0012-sr-leadership-roles"
      WHERE member_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_plan_history_member_date
  ON "0012-sr-attendance-plan-history"(member_id, meeting_date);

CREATE INDEX IF NOT EXISTS idx_plan_history_toggled_at
  ON "0012-sr-attendance-plan-history"(toggled_at);
