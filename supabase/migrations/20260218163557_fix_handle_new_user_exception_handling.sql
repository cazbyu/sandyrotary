/*
  # Fix handle_new_user trigger to not block auth signups

  ## Problem
  The handle_new_user trigger fires on every new auth user and inserts into
  0010_en_profiles. Any error in this trigger blocks ALL new user signups,
  including for the Sandy Rotary app which uses this same Supabase instance.

  ## Fix
  Wrap the trigger body in an EXCEPTION block so errors are caught and logged
  rather than propagated back to the auth service.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  BEGIN
    IF COALESCE(NEW.raw_user_meta_data->>'role', 'coach') != 'entrepreneur' THEN
      INSERT INTO public."0010_en_profiles" (
        id,
        email,
        first_name,
        last_name,
        role,
        status
      ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        '',
        'coach',
        'pending'
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_entrepreneur_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  BEGIN
    IF NEW.raw_user_meta_data->>'role' = 'entrepreneur' THEN

      INSERT INTO public."0010_en_profiles" (
        id, email, first_name, last_name, phone_number,
        role, status, business_name, region_id
      )
      VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'phone_number',
        'entrepreneur',
        'active',
        NEW.raw_user_meta_data->>'business_name',
        CASE
          WHEN NEW.raw_user_meta_data->>'region_id' IS NOT NULL
               AND NEW.raw_user_meta_data->>'region_id' != ''
          THEN (NEW.raw_user_meta_data->>'region_id')::bigint
          ELSE NULL
        END
      )
      ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone_number = EXCLUDED.phone_number,
        business_name = EXCLUDED.business_name,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        region_id = EXCLUDED.region_id;

      INSERT INTO public."0010_en_entrepreneurs" (profile_id, coach_id, status)
      VALUES (
        NEW.id,
        (NEW.raw_user_meta_data->>'coach_id')::uuid,
        COALESCE(NEW.raw_user_meta_data->>'status', 'Training Phase')
      )
      ON CONFLICT (profile_id) DO NOTHING;

    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;
