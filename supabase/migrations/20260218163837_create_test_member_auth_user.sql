/*
  # Create test member auth user directly

  ## Problem
  Email/password signup is broken on this shared Supabase instance due to conflicts
  with other projects' triggers. This migration inserts the test user directly,
  bypassing triggers using session_replication_role = replica.

  ## Changes
  - Creates auth user for testmember@sandyrotary.test with password TestPassword123
  - Links member record in 0012-sr-members to the new auth user ID
*/

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_email text := 'testmember@sandyrotary.test';
  v_password_hash text := '$2a$10$PJUBCLjUMlmqQQWdmrmHNuqzSTMHj6FjcRr5GHbXkB1NVPpBAvIOi';
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE NOTICE 'User already exists';
    RETURN;
  END IF;

  SET LOCAL session_replication_role = replica;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_sso_user, is_anonymous,
    confirmation_token, recovery_token,
    email_change_token_new, email_change_token_current
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    v_password_hash,
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false, false,
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email',
    v_email,
    now(), now(), now()
  );

  SET LOCAL session_replication_role = DEFAULT;

  UPDATE "0012-sr-members"
  SET id = v_user_id, updated_at = now()
  WHERE home_email = v_email;

  RAISE NOTICE 'Created test user: %', v_user_id;
END $$;
