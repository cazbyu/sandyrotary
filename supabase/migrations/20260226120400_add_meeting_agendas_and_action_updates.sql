/*
  # Meeting Agendas, Assignments, and Leadership Actions Updates

  1. Add columns to leadership_actions:
    - description (text)
    - attachment_url (text)
    - responsible_member_ids (uuid[]) for multiple POCs
    - is_announcement (boolean)
    - announcement_approved (boolean)

  2. Create meeting_agendas table:
    - id, meeting_date, start_time, created_by, created_at

  3. Create meeting_assignments table:
    - id, agenda_id, role_type, assigned_member_id, created_at

  4. Add club_settings keys for Scorecard
*/

-- 1. Leadership Actions updates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'p0012_rotary' AND table_name = 'leadership_actions'
      AND column_name = 'description'
  ) THEN
    ALTER TABLE p0012_rotary.leadership_actions ADD COLUMN description text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'p0012_rotary' AND table_name = 'leadership_actions'
      AND column_name = 'attachment_url'
  ) THEN
    ALTER TABLE p0012_rotary.leadership_actions ADD COLUMN attachment_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'p0012_rotary' AND table_name = 'leadership_actions'
      AND column_name = 'responsible_member_ids'
  ) THEN
    ALTER TABLE p0012_rotary.leadership_actions ADD COLUMN responsible_member_ids uuid[] DEFAULT '{}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'p0012_rotary' AND table_name = 'leadership_actions'
      AND column_name = 'is_announcement'
  ) THEN
    ALTER TABLE p0012_rotary.leadership_actions ADD COLUMN is_announcement boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'p0012_rotary' AND table_name = 'leadership_actions'
      AND column_name = 'announcement_approved'
  ) THEN
    ALTER TABLE p0012_rotary.leadership_actions ADD COLUMN announcement_approved boolean DEFAULT false;
  END IF;
END $$;

-- 2. Meeting Agendas
CREATE TABLE IF NOT EXISTS p0012_rotary.meeting_agendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date date NOT NULL UNIQUE,
  start_time text DEFAULT '12:15',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.meeting_agendas ENABLE ROW LEVEL SECURITY;

-- Leaders can read agendas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'p0012_rotary' AND tablename = 'meeting_agendas'
      AND policyname = 'Leaders can read meeting agendas'
  ) THEN
    CREATE POLICY "Leaders can read meeting agendas"
      ON p0012_rotary.meeting_agendas
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
  END IF;
END $$;

-- Leaders can manage agendas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'p0012_rotary' AND tablename = 'meeting_agendas'
      AND policyname = 'Leaders can manage meeting agendas'
  ) THEN
    CREATE POLICY "Leaders can manage meeting agendas"
      ON p0012_rotary.meeting_agendas
      FOR ALL TO authenticated
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
  END IF;
END $$;

-- 3. Meeting Assignments
CREATE TABLE IF NOT EXISTS p0012_rotary.meeting_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id uuid NOT NULL REFERENCES p0012_rotary.meeting_agendas(id) ON DELETE CASCADE,
  role_type text NOT NULL CHECK (role_type IN ('pledge', 'four_way_test', 'prayer_thought')),
  assigned_member_id uuid REFERENCES p0012_rotary.members(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.meeting_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'p0012_rotary' AND tablename = 'meeting_assignments'
      AND policyname = 'Leaders can read meeting assignments'
  ) THEN
    CREATE POLICY "Leaders can read meeting assignments"
      ON p0012_rotary.meeting_assignments
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
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'p0012_rotary' AND tablename = 'meeting_assignments'
      AND policyname = 'Leaders can manage meeting assignments'
  ) THEN
    CREATE POLICY "Leaders can manage meeting assignments"
      ON p0012_rotary.meeting_assignments
      FOR ALL TO authenticated
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
  END IF;
END $$;

-- 4. Club settings for Scorecard
INSERT INTO p0012_rotary.club_settings (key, value)
VALUES ('membership_goal', '50')
ON CONFLICT (key) DO NOTHING;

INSERT INTO p0012_rotary.club_settings (key, value)
VALUES ('membership_dues_amount', '200')
ON CONFLICT (key) DO NOTHING;

INSERT INTO p0012_rotary.club_settings (key, value)
VALUES ('happy_dollar_total', '0')
ON CONFLICT (key) DO NOTHING;
