/*
  Service Selfies → Social Media Approval Workflow

  Adds approval status, reviewer tracking, and social caption fields
  to the service_selfies table for the Public Image Chair workflow.

  Flow: Member uploads → pending → Public Image Chair reviews →
        approved → formatted for social media → sent via GHL Social Planner

  Run this in the Supabase SQL Editor for project ryxhnmkmsevedgjiduxn
*/

-- Add approval workflow columns
ALTER TABLE p0012_rotary.service_selfies
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES p0012_rotary.members(id),
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS social_caption text,
ADD COLUMN IF NOT EXISTS rejection_note text;

-- Set all existing selfies to approved (they were uploaded before the workflow existed)
UPDATE p0012_rotary.service_selfies SET status = 'approved' WHERE status IS NULL OR status = 'pending';

-- Index for quick filtering by status
CREATE INDEX IF NOT EXISTS idx_service_selfies_status ON p0012_rotary.service_selfies(status);
