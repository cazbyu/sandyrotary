/*
  # Create Volunteer Hours Tracking

  1. New Table (in p0012_rotary schema)
    - `volunteer_hours`
      - `id` (uuid, primary key)
      - `member_id` (uuid, FK to members)
      - `hours` (numeric, not null)
      - `description` (text, optional)
      - `service_date` (date, not null)
      - `logged_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)

  2. Security
    - Members can read and insert their own hours
    - Leaders can read and insert hours for any member
*/

CREATE TABLE IF NOT EXISTS p0012_rotary.volunteer_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES p0012_rotary.members(id),
  hours numeric(6,2) NOT NULL CHECK (hours > 0),
  description text,
  service_date date NOT NULL,
  logged_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.volunteer_hours ENABLE ROW LEVEL SECURITY;

-- Members can read their own hours
CREATE POLICY "Members can read own hours"
  ON p0012_rotary.volunteer_hours
  FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

-- Members can insert their own hours
CREATE POLICY "Members can insert own hours"
  ON p0012_rotary.volunteer_hours
  FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

-- Leaders can read all hours
CREATE POLICY "Leaders can read all hours"
  ON p0012_rotary.volunteer_hours
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

-- Leaders can insert hours for any member
CREATE POLICY "Leaders can insert hours for any member"
  ON p0012_rotary.volunteer_hours
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
