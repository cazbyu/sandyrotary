-- Migration: Tighten RLS policies to require active club membership.
-- Fixes exposure from non-member authenticated sessions (commit 7bb7dc0).
--
-- Tables affected: members, attendance_records, leads, lead_activities,
--                  leadership_roles, member_social_media, service_selfies.
-- Tables left unchanged: club_settings (needed by public pages),
--                        club_info, sponsors, bulletins, stories, notes.

------------------------------------------------------------------------
-- 1. Helper function: is the current auth user an active club member?
------------------------------------------------------------------------
create or replace function public.is_active_member()
returns boolean
language plpgsql
stable
security definer
set search_path = p0012_rotary, public
as $$
begin
  return exists (
    select 1 from p0012_rotary.members
    where id = auth.uid()
      and member_status = 'Active'
  );
end;
$$;

revoke all on function public.is_active_member() from public;
grant execute on function public.is_active_member() to authenticated;

------------------------------------------------------------------------
-- 2. members — SELECT was: true
------------------------------------------------------------------------
drop policy if exists "0012-sr-members-select" on p0012_rotary.members;
create policy "0012-sr-members-select" on p0012_rotary.members
  for select to authenticated
  using (public.is_active_member());

------------------------------------------------------------------------
-- 3. attendance_records — SELECT was: true
------------------------------------------------------------------------
drop policy if exists "All authenticated users can read attendance records" on p0012_rotary.attendance_records;
create policy "All authenticated users can read attendance records" on p0012_rotary.attendance_records
  for select to authenticated
  using (public.is_active_member());

------------------------------------------------------------------------
-- 4. leads — SELECT was: true
------------------------------------------------------------------------
drop policy if exists "0012-sr-leads-select" on p0012_rotary.leads;
create policy "0012-sr-leads-select" on p0012_rotary.leads
  for select to authenticated
  using (public.is_active_member());

------------------------------------------------------------------------
-- 5. leads — INSERT was: auth.uid() IS NOT NULL
------------------------------------------------------------------------
drop policy if exists "0012-sr-leads-insert" on p0012_rotary.leads;
create policy "0012-sr-leads-insert" on p0012_rotary.leads
  for insert to authenticated
  with check (public.is_active_member());

------------------------------------------------------------------------
-- 6. lead_activities — SELECT was: true
------------------------------------------------------------------------
drop policy if exists "0012-sr-lead-activities-select" on p0012_rotary.lead_activities;
create policy "0012-sr-lead-activities-select" on p0012_rotary.lead_activities
  for select to authenticated
  using (public.is_active_member());

------------------------------------------------------------------------
-- 7. lead_activities — INSERT was: auth.uid() IS NOT NULL
------------------------------------------------------------------------
drop policy if exists "0012-sr-lead-activities-insert" on p0012_rotary.lead_activities;
create policy "0012-sr-lead-activities-insert" on p0012_rotary.lead_activities
  for insert to authenticated
  with check (public.is_active_member());

------------------------------------------------------------------------
-- 8. leadership_roles — SELECT was: true
------------------------------------------------------------------------
drop policy if exists "0012-sr-leadership-select" on p0012_rotary.leadership_roles;
create policy "0012-sr-leadership-select" on p0012_rotary.leadership_roles
  for select to authenticated
  using (public.is_active_member());

------------------------------------------------------------------------
-- 9. member_social_media — SELECT was: true
------------------------------------------------------------------------
drop policy if exists "0012-sr-social-select" on p0012_rotary.member_social_media;
create policy "0012-sr-social-select" on p0012_rotary.member_social_media
  for select to authenticated
  using (public.is_active_member());

------------------------------------------------------------------------
-- 10. service_selfies — SELECT was: true
------------------------------------------------------------------------
drop policy if exists "0012-sr-selfies-select" on p0012_rotary.service_selfies;
create policy "0012-sr-selfies-select" on p0012_rotary.service_selfies
  for select to authenticated
  using (public.is_active_member());

------------------------------------------------------------------------
-- DOWN MIGRATION (manual rollback — uncomment and run to revert)
------------------------------------------------------------------------
-- drop function if exists public.is_active_member();
--
-- drop policy if exists "0012-sr-members-select" on p0012_rotary.members;
-- create policy "0012-sr-members-select" on p0012_rotary.members for select to authenticated using (true);
--
-- drop policy if exists "All authenticated users can read attendance records" on p0012_rotary.attendance_records;
-- create policy "All authenticated users can read attendance records" on p0012_rotary.attendance_records for select to authenticated using (true);
--
-- drop policy if exists "0012-sr-leads-select" on p0012_rotary.leads;
-- create policy "0012-sr-leads-select" on p0012_rotary.leads for select to authenticated using (true);
--
-- drop policy if exists "0012-sr-leads-insert" on p0012_rotary.leads;
-- create policy "0012-sr-leads-insert" on p0012_rotary.leads for insert to authenticated with check (auth.uid() IS NOT NULL);
--
-- drop policy if exists "0012-sr-lead-activities-select" on p0012_rotary.lead_activities;
-- create policy "0012-sr-lead-activities-select" on p0012_rotary.lead_activities for select to authenticated using (true);
--
-- drop policy if exists "0012-sr-lead-activities-insert" on p0012_rotary.lead_activities;
-- create policy "0012-sr-lead-activities-insert" on p0012_rotary.lead_activities for insert to authenticated with check (auth.uid() IS NOT NULL);
--
-- drop policy if exists "0012-sr-leadership-select" on p0012_rotary.leadership_roles;
-- create policy "0012-sr-leadership-select" on p0012_rotary.leadership_roles for select to authenticated using (true);
--
-- drop policy if exists "0012-sr-social-select" on p0012_rotary.member_social_media;
-- create policy "0012-sr-social-select" on p0012_rotary.member_social_media for select to authenticated using (true);
--
-- drop policy if exists "0012-sr-selfies-select" on p0012_rotary.service_selfies;
-- create policy "0012-sr-selfies-select" on p0012_rotary.service_selfies for select to authenticated using (true);
