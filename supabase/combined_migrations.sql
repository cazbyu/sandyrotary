-- ============================================================================
-- SANDY ROTARY - Combined New Feature Migrations
-- Run this in the Supabase SQL Editor for project: ryxhnmkmsevedgjiduxn
--
-- Creates 10 new tables/modifications in p0012_rotary schema:
--   1. weekly_surveys + survey_responses (pre-meeting survey system)
--   2. member_suggestions (suggestion box)
--   3. volunteer_hours (service hour tracking)
--   4. club_settings entries (available_funds, ghl_referral_form_url)
--   5. fundraiser_campaigns (fundraiser tracking)
--   6. notes.pre_mtg_survey column
--   7. post_event_surveys + post_event_responses (post-event ratings)
--   8. idea_jar (idea management)
--   9. fundraiser_campaigns updates + fundraiser_notes join table
--  10. meeting_agendas + meeting_assignments + leadership_actions updates + scorecard settings
-- ============================================================================

SET search_path TO p0012_rotary, public;

-- ============================================
-- 1. WEEKLY SURVEYS + SURVEY RESPONSES
-- ============================================

CREATE TABLE IF NOT EXISTS p0012_rotary.weekly_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  survey_type text DEFAULT 'pre_meeting' NOT NULL,
  meeting_date date NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  is_active boolean DEFAULT true NOT NULL,
  choices text[],
  created_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.weekly_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active surveys"
  ON p0012_rotary.weekly_surveys FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Leaders can read all surveys"
  ON p0012_rotary.weekly_surveys FOR SELECT TO authenticated
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

CREATE POLICY "Leaders can insert surveys"
  ON p0012_rotary.weekly_surveys FOR INSERT TO authenticated
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

CREATE POLICY "Leaders can update surveys"
  ON p0012_rotary.weekly_surveys FOR UPDATE TO authenticated
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

CREATE TABLE IF NOT EXISTS p0012_rotary.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES p0012_rotary.weekly_surveys(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES p0012_rotary.members(id),
  rating integer CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  choice_index integer,
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(survey_id, member_id)
);

ALTER TABLE p0012_rotary.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read own responses"
  ON p0012_rotary.survey_responses FOR SELECT TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "Members can insert own responses"
  ON p0012_rotary.survey_responses FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "Leaders can read all responses"
  ON p0012_rotary.survey_responses FOR SELECT TO authenticated
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

-- ============================================
-- 2. MEMBER SUGGESTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS p0012_rotary.member_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES p0012_rotary.members(id),
  suggestion_text text NOT NULL,
  share_with_leadership boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.member_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read own suggestions"
  ON p0012_rotary.member_suggestions FOR SELECT TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "Members can insert own suggestions"
  ON p0012_rotary.member_suggestions FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "Members can update own suggestions"
  ON p0012_rotary.member_suggestions FOR UPDATE TO authenticated
  USING (member_id = auth.uid()) WITH CHECK (member_id = auth.uid());

CREATE POLICY "Members can delete own suggestions"
  ON p0012_rotary.member_suggestions FOR DELETE TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "Leaders can read shared suggestions"
  ON p0012_rotary.member_suggestions FOR SELECT TO authenticated
  USING (
    share_with_leadership = true AND (
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
  );

-- ============================================
-- 3. VOLUNTEER HOURS
-- ============================================

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

CREATE POLICY "Members can read own hours"
  ON p0012_rotary.volunteer_hours FOR SELECT TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "Members can insert own hours"
  ON p0012_rotary.volunteer_hours FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "Leaders can read all hours"
  ON p0012_rotary.volunteer_hours FOR SELECT TO authenticated
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

CREATE POLICY "Leaders can insert hours for any member"
  ON p0012_rotary.volunteer_hours FOR INSERT TO authenticated
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

-- ============================================
-- 4. CLUB SETTINGS ENTRIES
-- ============================================

INSERT INTO p0012_rotary.club_settings (key, value) VALUES ('available_funds', '0') ON CONFLICT (key) DO NOTHING;
INSERT INTO p0012_rotary.club_settings (key, value) VALUES ('ghl_referral_form_url', '') ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 5. FUNDRAISER CAMPAIGNS
-- ============================================

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

CREATE POLICY "Authenticated users can read active campaigns"
  ON p0012_rotary.fundraiser_campaigns FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Leaders can read all campaigns"
  ON p0012_rotary.fundraiser_campaigns FOR SELECT TO authenticated
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

CREATE POLICY "Leaders can insert campaigns"
  ON p0012_rotary.fundraiser_campaigns FOR INSERT TO authenticated
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

CREATE POLICY "Leaders can update campaigns"
  ON p0012_rotary.fundraiser_campaigns FOR UPDATE TO authenticated
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

-- ============================================
-- 6. ADD pre_mtg_survey TO NOTES
-- ============================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'p0012_rotary' AND table_name = 'notes' AND column_name = 'pre_mtg_survey'
  ) THEN
    ALTER TABLE p0012_rotary.notes ADD COLUMN pre_mtg_survey date;
  END IF;
END $$;

-- ============================================
-- 7. POST-EVENT SURVEYS + RESPONSES
-- ============================================

CREATE TABLE IF NOT EXISTS p0012_rotary.post_event_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('meeting', 'service', 'fundraiser')),
  event_date date NOT NULL,
  event_name text NOT NULL,
  reference_id uuid,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.post_event_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active post-event surveys"
  ON p0012_rotary.post_event_surveys FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Leaders can read all post-event surveys"
  ON p0012_rotary.post_event_surveys FOR SELECT TO authenticated
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

CREATE POLICY "Leaders can insert post-event surveys"
  ON p0012_rotary.post_event_surveys FOR INSERT TO authenticated
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

CREATE POLICY "Leaders can update post-event surveys"
  ON p0012_rotary.post_event_surveys FOR UPDATE TO authenticated
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

CREATE TABLE IF NOT EXISTS p0012_rotary.post_event_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES p0012_rotary.post_event_surveys(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES p0012_rotary.members(id),
  ratings jsonb NOT NULL DEFAULT '{}',
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(survey_id, member_id)
);

ALTER TABLE p0012_rotary.post_event_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read own post-event responses"
  ON p0012_rotary.post_event_responses FOR SELECT TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "Members can insert own post-event responses"
  ON p0012_rotary.post_event_responses FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "Leaders can read all post-event responses"
  ON p0012_rotary.post_event_responses FOR SELECT TO authenticated
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

-- ============================================
-- 8. IDEA JAR
-- ============================================

CREATE TABLE IF NOT EXISTS p0012_rotary.idea_jar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  source_type text DEFAULT 'manual' NOT NULL CHECK (source_type IN ('survey_comment', 'suggestion', 'manual')),
  source_id uuid,
  tags text[] DEFAULT '{}',
  status text DEFAULT 'new' NOT NULL CHECK (status IN ('new', 'proposed', 'on_agenda', 'tabled', 'completed')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.idea_jar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaders can read idea jar"
  ON p0012_rotary.idea_jar FOR SELECT TO authenticated
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

CREATE POLICY "Leaders can insert idea jar"
  ON p0012_rotary.idea_jar FOR INSERT TO authenticated
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

CREATE POLICY "Leaders can update idea jar"
  ON p0012_rotary.idea_jar FOR UPDATE TO authenticated
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

-- ============================================
-- 9. FUNDRAISER CAMPAIGNS UPDATES + NOTES
-- ============================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'p0012_rotary' AND table_name = 'fundraiser_campaigns' AND column_name = 'estimated_costs') THEN
    ALTER TABLE p0012_rotary.fundraiser_campaigns ADD COLUMN estimated_costs numeric(10,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'p0012_rotary' AND table_name = 'fundraiser_campaigns' AND column_name = 'estimated_revenues') THEN
    ALTER TABLE p0012_rotary.fundraiser_campaigns ADD COLUMN estimated_revenues numeric(10,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'p0012_rotary' AND table_name = 'fundraiser_campaigns' AND column_name = 'purpose') THEN
    ALTER TABLE p0012_rotary.fundraiser_campaigns ADD COLUMN purpose text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'p0012_rotary' AND table_name = 'fundraiser_campaigns' AND column_name = 'details') THEN
    ALTER TABLE p0012_rotary.fundraiser_campaigns ADD COLUMN details text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'p0012_rotary' AND table_name = 'fundraiser_campaigns' AND column_name = 'assigned_members') THEN
    ALTER TABLE p0012_rotary.fundraiser_campaigns ADD COLUMN assigned_members uuid[] DEFAULT '{}';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS p0012_rotary.fundraiser_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fundraiser_id uuid NOT NULL REFERENCES p0012_rotary.fundraiser_campaigns(id) ON DELETE CASCADE,
  note_id uuid NOT NULL REFERENCES p0012_rotary.notes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.fundraiser_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaders can read fundraiser notes"
  ON p0012_rotary.fundraiser_notes FOR SELECT TO authenticated
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

CREATE POLICY "Leaders can insert fundraiser notes"
  ON p0012_rotary.fundraiser_notes FOR INSERT TO authenticated
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

CREATE POLICY "Authenticated users can read fundraiser notes for active campaigns"
  ON p0012_rotary.fundraiser_notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM p0012_rotary.fundraiser_campaigns fc
      WHERE fc.id = fundraiser_id AND fc.is_active = true
    )
  );

-- ============================================
-- 10. MEETING AGENDAS + ASSIGNMENTS + LEADERSHIP ACTIONS UPDATES
-- ============================================

-- Leadership Actions updates
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'p0012_rotary' AND table_name = 'leadership_actions' AND column_name = 'description') THEN
    ALTER TABLE p0012_rotary.leadership_actions ADD COLUMN description text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'p0012_rotary' AND table_name = 'leadership_actions' AND column_name = 'attachment_url') THEN
    ALTER TABLE p0012_rotary.leadership_actions ADD COLUMN attachment_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'p0012_rotary' AND table_name = 'leadership_actions' AND column_name = 'responsible_member_ids') THEN
    ALTER TABLE p0012_rotary.leadership_actions ADD COLUMN responsible_member_ids uuid[] DEFAULT '{}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'p0012_rotary' AND table_name = 'leadership_actions' AND column_name = 'is_announcement') THEN
    ALTER TABLE p0012_rotary.leadership_actions ADD COLUMN is_announcement boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'p0012_rotary' AND table_name = 'leadership_actions' AND column_name = 'announcement_approved') THEN
    ALTER TABLE p0012_rotary.leadership_actions ADD COLUMN announcement_approved boolean DEFAULT false;
  END IF;
END $$;

-- Meeting Agendas
CREATE TABLE IF NOT EXISTS p0012_rotary.meeting_agendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date date NOT NULL UNIQUE,
  start_time text DEFAULT '12:15',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.meeting_agendas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'p0012_rotary' AND tablename = 'meeting_agendas' AND policyname = 'Leaders can read meeting agendas') THEN
    CREATE POLICY "Leaders can read meeting agendas"
      ON p0012_rotary.meeting_agendas FOR SELECT TO authenticated
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'p0012_rotary' AND tablename = 'meeting_agendas' AND policyname = 'Leaders can manage meeting agendas') THEN
    CREATE POLICY "Leaders can manage meeting agendas"
      ON p0012_rotary.meeting_agendas FOR ALL TO authenticated
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

-- Meeting Assignments
CREATE TABLE IF NOT EXISTS p0012_rotary.meeting_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id uuid NOT NULL REFERENCES p0012_rotary.meeting_agendas(id) ON DELETE CASCADE,
  role_type text NOT NULL CHECK (role_type IN ('pledge', 'four_way_test', 'prayer_thought')),
  assigned_member_id uuid REFERENCES p0012_rotary.members(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE p0012_rotary.meeting_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'p0012_rotary' AND tablename = 'meeting_assignments' AND policyname = 'Leaders can read meeting assignments') THEN
    CREATE POLICY "Leaders can read meeting assignments"
      ON p0012_rotary.meeting_assignments FOR SELECT TO authenticated
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'p0012_rotary' AND tablename = 'meeting_assignments' AND policyname = 'Leaders can manage meeting assignments') THEN
    CREATE POLICY "Leaders can manage meeting assignments"
      ON p0012_rotary.meeting_assignments FOR ALL TO authenticated
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

-- Scorecard club_settings entries
INSERT INTO p0012_rotary.club_settings (key, value) VALUES ('membership_goal', '50') ON CONFLICT (key) DO NOTHING;
INSERT INTO p0012_rotary.club_settings (key, value) VALUES ('membership_dues_amount', '200') ON CONFLICT (key) DO NOTHING;
INSERT INTO p0012_rotary.club_settings (key, value) VALUES ('happy_dollar_total', '0') ON CONFLICT (key) DO NOTHING;

-- ============================================
-- DONE! All 10 migrations applied.
-- ============================================
