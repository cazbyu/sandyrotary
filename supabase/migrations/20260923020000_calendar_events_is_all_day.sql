-- schedule-sync v2.4: service/fundraiser rows without a written time are all-day.
-- All-day rows keep a 12:00–13:00 America/Denver slot so the stored date never shifts;
-- the app shows "All day" instead of the time range. Sync-owned (see docs/schedule-sync.md).
ALTER TABLE p0012_rotary.calendar_events
  ADD COLUMN IF NOT EXISTS is_all_day boolean NOT NULL DEFAULT false;
