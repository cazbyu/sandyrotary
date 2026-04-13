-- Run in Supabase SQL editor under the p0012_rotary schema
--
-- Functions use SUPABASE_SERVICE_ROLE_KEY (not the anon key) to access these tables.
-- The anon key cannot read or write to these tables because RLS is enabled
-- with no policies, and only service_role bypasses RLS.

-- GHL token storage (one row per connected GHL sub-account/location)
CREATE TABLE IF NOT EXISTS p0012_rotary.ghl_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Short-lived OAuth state for CSRF protection (expires in 10 min)
CREATE TABLE IF NOT EXISTS p0012_rotary.oauth_state (
  state TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '10 minutes')
);

-- Lock down both tables: only service_role key can access them
-- (Netlify functions use service_role; frontend never touches these)
ALTER TABLE p0012_rotary.ghl_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE p0012_rotary.oauth_state ENABLE ROW LEVEL SECURITY;

-- No RLS policies = no frontend access (service_role bypasses RLS)
