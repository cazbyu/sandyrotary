/*
  Add is_admin boolean column to members table.

  This column enables admin-level permissions beyond leadership roles.
  Leaders are detected via leadership_roles table; is_admin grants
  additional privileges (manage members, create stories/bulletins, etc.)

  Run this in the Supabase SQL Editor for project ryxhnmkmsevedgjiduxn
*/

ALTER TABLE p0012_rotary.members
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Set yourself as admin (update the email to match your member record)
-- UPDATE p0012_rotary.members SET is_admin = true WHERE home_email = 'your-email@example.com';
