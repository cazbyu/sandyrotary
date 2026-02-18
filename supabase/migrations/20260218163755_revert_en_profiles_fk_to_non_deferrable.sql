/*
  # Revert 0010_en_profiles FK back to non-deferrable

  ## Reason
  The DEFERRABLE constraint adds a new RI trigger on auth.users which may
  interfere with the Supabase auth service. Reverting to standard non-deferrable
  CASCADE since the handle_new_user trigger now has exception handling anyway.
*/

ALTER TABLE "0010_en_profiles"
  DROP CONSTRAINT "0010_en_profiles_id_fkey",
  ADD CONSTRAINT "0010_en_profiles_id_fkey"
    FOREIGN KEY (id) REFERENCES auth.users(id)
    ON DELETE CASCADE;
