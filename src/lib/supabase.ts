import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Member {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  district?: string;
  club_name?: string;
  home_email: string;
  profile_photo_url?: string;
  member_status?: string;
  member_title?: string;
  share_contact_info?: boolean;
  created_at: string;
  updated_at: string;
}

export interface WeeklySurvey {
  id: string;
  question_text: string;
  survey_type: string;
  meeting_date: string;
  created_by: string;
  is_active: boolean;
  choices: string[] | null;
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  member_id: string;
  rating?: number | null;
  choice_index?: number | null;
  comment?: string | null;
  created_at: string;
}

export interface MemberSuggestion {
  id: string;
  member_id: string;
  suggestion_text: string;
  share_with_leadership: boolean;
  created_at: string;
}

export interface VolunteerHours {
  id: string;
  member_id: string;
  hours: number;
  description?: string;
  service_date: string;
  logged_by: string;
  created_at: string;
}

export interface FundraiserCampaign {
  id: string;
  name: string;
  description?: string;
  goal_amount: number;
  current_amount: number;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  bracket_url?: string;
  estimated_costs?: number;
  estimated_revenues?: number;
  purpose?: string;
  details?: string;
  assigned_members?: string[];
  created_at: string;
}

export interface PostEventSurvey {
  id: string;
  event_type: 'meeting' | 'service' | 'fundraiser';
  event_date: string;
  event_name: string;
  reference_id?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface PostEventResponse {
  id: string;
  survey_id: string;
  member_id: string;
  ratings: Record<string, number>;
  comment?: string | null;
  created_at: string;
}

export interface IdeaJarItem {
  id: string;
  title: string;
  description?: string;
  source_type: 'survey_comment' | 'suggestion' | 'manual';
  source_id?: string;
  tags: string[];
  status: 'new' | 'proposed' | 'on_agenda' | 'tabled' | 'completed';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const MEETING_RATING_CATEGORIES = [
  { key: 'meal', label: 'Meal' },
  { key: 'admin_delivery', label: 'Administrative Delivery' },
  { key: 'speaker', label: 'Speaker' },
];

export const SERVICE_RATING_CATEGORIES = [
  { key: 'organization', label: 'Organization' },
  { key: 'impact', label: 'Impact' },
  { key: 'enjoyment', label: 'Enjoyment' },
];

export const FUNDRAISER_RATING_CATEGORIES = [
  { key: 'organization', label: 'Organization' },
  { key: 'fun_factor', label: 'Fun Factor' },
  { key: 'community_impact', label: 'Community Impact' },
];

export interface MeetingAgenda {
  id: string;
  meeting_date: string;
  start_time: string;
  created_by: string;
  created_at: string;
}

export interface MeetingAssignment {
  id: string;
  agenda_id: string;
  role_type: 'pledge' | 'four_way_test' | 'prayer_thought';
  assigned_member_id: string | null;
  created_at: string;
}

export const MEETING_ROLES = [
  { key: 'pledge', label: 'Pledge' },
  { key: 'four_way_test', label: 'Rotary 4-Way Test' },
  { key: 'prayer_thought', label: 'Prayer / Rotary Thought' },
] as const;
