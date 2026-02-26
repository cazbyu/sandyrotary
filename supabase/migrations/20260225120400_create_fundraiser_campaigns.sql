/*
  # Create Fundraiser Campaigns

  1. New Table (in p0012_rotary schema)
    - `fundraiser_campaigns`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `description` (text, optional)
      - `goal_amount` (numeric)
      - `current_amount` (numeric, default 0)
      - `start_date` (date)
      - `end_date` (date)
      - `is_active` (boolean, default true)
      - `bracket_url` (text, optional) - external link to bracket/competition
      - `created_at` (timestamptz)

  2. Security
    - All authenticated users can read active campaigns
    - Leaders can manage campaigns
*/

CREATE TABLE IF NOT EXISTS p0012_rotary.fundraiser_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  goal_amount numeric(10,2),
  current_amount numeric(10,2) DEFAULT 0,
  start_date date,
  end_date date,
  is_active boolean DEFAULT true NOT NULL,
  bracket_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.fundraiser_campaigns ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active campaigns
CREATE POLICY "Authenticated users can read active campaigns"
  ON p0012_rotary.fundraiser_campaigns
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Leaders can read all campaigns
CREATE POLICY "Leaders can read all campaigns"
  ON p0012_rotary.fundraiser_campaigns
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

-- Leaders can insert campaigns
CREATE POLICY "Leaders can insert campaigns"
  ON p0012_rotary.fundraiser_campaigns
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

-- Leaders can update campaigns
CREATE POLICY "Leaders can update campaigns"
  ON p0012_rotary.fundraiser_campaigns
  FOR UPDATE
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
  )
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
