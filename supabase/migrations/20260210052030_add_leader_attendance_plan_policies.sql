/*
  # Add leader policies for attendance plans

  1. Changes
    - Add policy for leaders to read all attendance plans
    - Add policy for leaders to insert attendance plans for any member
    - Add policy for leaders to update attendance plans for any member

  2. Security
    - Leaders (those with entries in leadership-roles table) can manage all member plans
    - This allows leaders to override attendance plans on behalf of members

  3. Notes
    - Leaders can change member status even after Friday deadline
    - This is necessary for when members call/text to say they can't attend
*/

CREATE POLICY "Leaders can read all attendance plans"
  ON "0012-sr-attendance-plans"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "0012-sr-leadership-roles"
      WHERE member_id = auth.uid()
    )
  );

CREATE POLICY "Leaders can insert attendance plans for any member"
  ON "0012-sr-attendance-plans"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "0012-sr-leadership-roles"
      WHERE member_id = auth.uid()
    )
  );

CREATE POLICY "Leaders can update all attendance plans"
  ON "0012-sr-attendance-plans"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "0012-sr-leadership-roles"
      WHERE member_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "0012-sr-leadership-roles"
      WHERE member_id = auth.uid()
    )
  );
