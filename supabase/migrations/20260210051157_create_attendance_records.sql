/*
  # Create attendance records table

  1. New Tables
    - `0012-sr-attendance-records`
      - `id` (uuid, primary key)
      - `member_id` (uuid, not null) - references the club member
      - `meeting_date` (date, not null) - the Wednesday meeting date
      - `status` (text, not null) - attended | busy | no_show
      - `marked_by` (uuid) - admin who marked the attendance
      - `marked_at` (timestamptz) - when it was marked
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
      - Unique constraint on (member_id, meeting_date)

  2. Security
    - Enable RLS on `0012-sr-attendance-records`
    - All authenticated users can read records
    - Only leaders can insert/update records (checked via leadership-roles table)

  3. Notes
    - This table tracks ACTUAL attendance after meetings occur
    - Status values: 'attended', 'busy', 'no_show'
    - Leaders can override any status at any time
*/

CREATE TABLE IF NOT EXISTS "0012-sr-attendance-records" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  meeting_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('attended', 'busy', 'no_show')),
  marked_by uuid,
  marked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, meeting_date)
);

ALTER TABLE "0012-sr-attendance-records" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read attendance records"
  ON "0012-sr-attendance-records"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Leaders can insert attendance records"
  ON "0012-sr-attendance-records"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "0012-sr-leadership-roles"
      WHERE member_id = auth.uid()
    )
  );

CREATE POLICY "Leaders can update attendance records"
  ON "0012-sr-attendance-records"
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

CREATE INDEX IF NOT EXISTS idx_attendance_records_member_date
  ON "0012-sr-attendance-records" (member_id, meeting_date);

CREATE INDEX IF NOT EXISTS idx_attendance_records_meeting_date
  ON "0012-sr-attendance-records" (meeting_date);
