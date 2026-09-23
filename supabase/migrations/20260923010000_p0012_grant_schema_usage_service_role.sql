-- Applied live on 2026-09-23 by the Technical Manager (Supabase migration history name
-- `p0012_rotary_grant_schema_usage_service_role`) after schedule-sync failed with
-- "permission denied for schema p0012_rotary". Recorded here so the repo matches the database.
-- Safe to re-run; no need to apply again.
GRANT USAGE ON SCHEMA p0012_rotary TO service_role;
