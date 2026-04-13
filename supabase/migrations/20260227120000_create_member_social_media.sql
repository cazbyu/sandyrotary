CREATE TABLE IF NOT EXISTS p0012_rotary.member_social_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES p0012_rotary.members(id)
    ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, platform)
);

ALTER TABLE p0012_rotary.member_social_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view social media of members with share_contact_info=true"
  ON p0012_rotary.member_social_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM p0012_rotary.members m
      WHERE m.id = member_id AND m.share_contact_info = true
    )
  );

CREATE POLICY "Members can manage their own social media"
  ON p0012_rotary.member_social_media FOR ALL
  USING (auth.uid() = member_id);
