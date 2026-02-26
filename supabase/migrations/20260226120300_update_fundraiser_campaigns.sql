/*
  # Update Fundraiser Campaigns + Fundraiser Notes Join Table

  1. Add new columns to fundraiser_campaigns:
    - estimated_costs, estimated_revenues, purpose, details, assigned_members

  2. Create fundraiser_notes join table linking fundraisers to notes
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'p0012_rotary' AND table_name = 'fundraiser_campaigns'
      AND column_name = 'estimated_costs'
  ) THEN
    ALTER TABLE p0012_rotary.fundraiser_campaigns ADD COLUMN estimated_costs numeric(10,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'p0012_rotary' AND table_name = 'fundraiser_campaigns'
      AND column_name = 'estimated_revenues'
  ) THEN
    ALTER TABLE p0012_rotary.fundraiser_campaigns ADD COLUMN estimated_revenues numeric(10,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'p0012_rotary' AND table_name = 'fundraiser_campaigns'
      AND column_name = 'purpose'
  ) THEN
    ALTER TABLE p0012_rotary.fundraiser_campaigns ADD COLUMN purpose text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'p0012_rotary' AND table_name = 'fundraiser_campaigns'
      AND column_name = 'details'
  ) THEN
    ALTER TABLE p0012_rotary.fundraiser_campaigns ADD COLUMN details text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'p0012_rotary' AND table_name = 'fundraiser_campaigns'
      AND column_name = 'assigned_members'
  ) THEN
    ALTER TABLE p0012_rotary.fundraiser_campaigns ADD COLUMN assigned_members uuid[] DEFAULT '{}';
  END IF;
END $$;

-- Fundraiser Notes join table
CREATE TABLE IF NOT EXISTS p0012_rotary.fundraiser_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fundraiser_id uuid NOT NULL REFERENCES p0012_rotary.fundraiser_campaigns(id) ON DELETE CASCADE,
  note_id uuid NOT NULL REFERENCES p0012_rotary.notes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.fundraiser_notes ENABLE ROW LEVEL SECURITY;

-- Leaders can read fundraiser notes
CREATE POLICY "Leaders can read fundraiser notes"
  ON p0012_rotary.fundraiser_notes
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

-- Leaders can insert fundraiser notes
CREATE POLICY "Leaders can insert fundraiser notes"
  ON p0012_rotary.fundraiser_notes
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

-- Authenticated users can read notes linked to fundraisers they can see
CREATE POLICY "Authenticated users can read fundraiser notes for active campaigns"
  ON p0012_rotary.fundraiser_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM p0012_rotary.fundraiser_campaigns fc
      WHERE fc.id = fundraiser_id AND fc.is_active = true
    )
  );
