/*
  # Add pre_mtg_survey column to notes table

  Adds a `pre_mtg_survey` date column to the notes table in p0012_rotary schema.
  This column records the date of the next Wednesday primary meeting when a
  member submits a pre-meeting survey response. It allows cross-referencing
  survey responses with meeting notes.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'p0012_rotary'
      AND table_name = 'notes'
      AND column_name = 'pre_mtg_survey'
  ) THEN
    ALTER TABLE p0012_rotary.notes ADD COLUMN pre_mtg_survey date;
  END IF;
END $$;
