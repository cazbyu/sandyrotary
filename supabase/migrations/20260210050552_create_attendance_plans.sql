/*
  # Create attendance plans table

  1. New Tables
    - `0012-sr-attendance-plans`
      - `id` (uuid, primary key)
      - `member_id` (uuid, not null) - references the club member
      - `meeting_date` (date, not null) - the Wednesday meeting date
      - `is_attending` (boolean, default true) - whether member plans to attend
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
      - Unique constraint on (member_id, meeting_date)

  2. Security
    - Enable RLS on `0012-sr-attendance-plans`
    - Members can read their own plans
    - Members can insert their own plans
    - Members can update their own plans

  3. Notes
    - Default is_attending = true (members attend by default)
    - Used by the Attendance Plans page for members to indicate weekly availability
*/

CREATE TABLE IF NOT EXISTS "0012-sr-attendance-plans" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  meeting_date date NOT NULL,
  is_attending boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, meeting_date)
);

ALTER TABLE "0012-sr-attendance-plans" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read own attendance plans"
  ON "0012-sr-attendance-plans"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = member_id);

CREATE POLICY "Members can insert own attendance plans"
  ON "0012-sr-attendance-plans"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Members can update own attendance plans"
  ON "0012-sr-attendance-plans"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = member_id)
  WITH CHECK (auth.uid() = member_id);

CREATE INDEX IF NOT EXISTS idx_attendance_plans_member_date
  ON "0012-sr-attendance-plans" (member_id, meeting_date);
