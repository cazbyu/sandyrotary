/*
  # Make 0010_en_profiles FK to auth.users deferrable

  ## Problem
  The handle_new_user trigger fires AFTER INSERT on auth.users and inserts into
  0010_en_profiles, which has a non-deferrable FK to auth.users(id). This causes
  a "Database error saving new user" because the FK check runs before the
  auth.users transaction fully commits, blocking all new email/password signups.

  ## Fix
  Make the FK constraint deferrable so it's validated at end of transaction
  rather than immediately when the trigger fires.
*/

ALTER TABLE "0010_en_profiles"
  DROP CONSTRAINT "0010_en_profiles_id_fkey",
  ADD CONSTRAINT "0010_en_profiles_id_fkey"
    FOREIGN KEY (id) REFERENCES auth.users(id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED;
