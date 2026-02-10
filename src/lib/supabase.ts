import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Member {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  district?: string;
  club_name?: string;
  created_at: string;
  updated_at: string;
}
