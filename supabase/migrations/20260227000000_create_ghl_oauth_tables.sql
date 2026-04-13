-- Run in Supabase SQL editor under the p0012_rotary schema
--
-- Functions use SUPABASE_SERVICE_ROLE_KEY (not the anon key) to access these tables.
-- The anon key cannot read or write because RLS is enabled with no policies,
-- and only service_role bypasses RLS.

-- GHL token storage (keyed by location_id for multi-chapter support)
CREATE TABLE IF NOT EXISTS p0012_rotary.ghl_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Short-lived CSRF state store (10 min expiry)
CREATE TABLE IF NOT EXISTS p0012_rotary.oauth_state (
  state TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '10 minutes')
);

ALTER TABLE p0012_rotary.ghl_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE p0012_rotary.oauth_state ENABLE ROW LEVEL SECURITY;
-- No RLS policies = no frontend access. Functions use service_role key.
