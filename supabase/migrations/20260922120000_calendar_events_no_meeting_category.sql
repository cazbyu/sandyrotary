-- Allow a 'No Meeting' category so off weeks from the board schedule
-- (e.g. "Off for 4th", "Off for Thanksgiving") appear in the member app.
-- Written by schedule-sync only; not offered in the AddEvent form.
ALTER TABLE p0012_rotary.calendar_events
  DROP CONSTRAINT "0012-sr-calendar-events_category_check";
ALTER TABLE p0012_rotary.calendar_events
  ADD CONSTRAINT "0012-sr-calendar-events_category_check"
  CHECK (category = ANY (ARRAY['Club Event','Club FundRaiser','Club Meeting','Club Service Project','No Meeting']));
