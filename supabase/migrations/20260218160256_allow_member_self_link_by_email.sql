/*
  # Allow members to link their auth account to their member profile by email

  ## Problem
  When a member logs in for the first time with email/password, Supabase creates
  a new auth user with a fresh UUID. The system then tries to find the member record
  by email and update the member's `id` to match the new auth UUID. However, the
  existing UPDATE RLS policy only allows updates where `id = auth.uid()`, meaning
  an unlinked member cannot update their own record (because their auth UUID doesn't
  match the member ID yet).

  This causes silent failures — the member is authenticated in Supabase but the app
  can't load their profile, resulting in login errors.

  ## Fix
  Add a new policy that allows an authenticated user to claim/link a member record
  whose `home_email` matches the email in their JWT token. The WITH CHECK clause
  ensures the resulting `id` must equal the user's `auth.uid()` — preventing anyone
  from claiming another user's record or setting a wrong ID.

  ## Changes
  - Add UPDATE policy "Users can link member profile by matching email"
    on `0012-sr-members`

  ## Security Notes
  - USING: old row must have home_email matching the signed-in user's JWT email
  - WITH CHECK: new row must still have the same email AND id must be auth.uid()
  - This is safe: only the real account holder can link, and only to their own UID
*/

CREATE POLICY "Users can link member profile by matching email"
  ON "0012-sr-members"
  FOR UPDATE
  TO authenticated
  USING (home_email = (auth.jwt() ->> 'email'))
  WITH CHECK (
    home_email = (auth.jwt() ->> 'email')
    AND id = auth.uid()
  );
