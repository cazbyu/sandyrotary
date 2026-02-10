/*
  # Add Contact and Marketing Fields to Leads

  1. Modified Tables
    - `0012-sr-leads`
      - `tags` (text array) - Flexible tagging for grouping contacts
      - `email_opt_in` (boolean) - Email opt-out preference tracking
      - `last_contacted_date` (date) - Track recency of outreach
      - `preferred_contact_method` (text) - Email, Phone, Text, WhatsApp
      - `address` (text) - Mailing address
      - `city` (text) - City
      - `state` (text) - State, defaults to UT
      - `zip` (text) - ZIP code

  2. Purpose
    - Support using leads as a marketing contact list
    - Enable bulk communications and contact management
    - Track contact preferences and opt-in status
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0012-sr-leads' AND column_name = 'tags'
  ) THEN
    ALTER TABLE "0012-sr-leads" ADD COLUMN tags text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0012-sr-leads' AND column_name = 'email_opt_in'
  ) THEN
    ALTER TABLE "0012-sr-leads" ADD COLUMN email_opt_in boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0012-sr-leads' AND column_name = 'last_contacted_date'
  ) THEN
    ALTER TABLE "0012-sr-leads" ADD COLUMN last_contacted_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0012-sr-leads' AND column_name = 'preferred_contact_method'
  ) THEN
    ALTER TABLE "0012-sr-leads" ADD COLUMN preferred_contact_method text DEFAULT 'Email';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0012-sr-leads' AND column_name = 'address'
  ) THEN
    ALTER TABLE "0012-sr-leads" ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0012-sr-leads' AND column_name = 'city'
  ) THEN
    ALTER TABLE "0012-sr-leads" ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0012-sr-leads' AND column_name = 'state'
  ) THEN
    ALTER TABLE "0012-sr-leads" ADD COLUMN state text DEFAULT 'UT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '0012-sr-leads' AND column_name = 'zip'
  ) THEN
    ALTER TABLE "0012-sr-leads" ADD COLUMN zip text;
  END IF;
END $$;
