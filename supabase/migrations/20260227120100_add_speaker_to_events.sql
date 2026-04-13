ALTER TABLE p0012_rotary.calendar_events
  ADD COLUMN IF NOT EXISTS speaker_name TEXT,
  ADD COLUMN IF NOT EXISTS speaker_topic TEXT,
  ADD COLUMN IF NOT EXISTS speaker_bio TEXT;
