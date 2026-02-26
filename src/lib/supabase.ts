import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Member {
  id: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
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
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  member_id: string;
  rating: number;
  comment?: string;
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
  created_at: string;
}
