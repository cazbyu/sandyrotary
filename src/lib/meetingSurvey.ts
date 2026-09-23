import { supabase, PostEventSurvey, PostEventResponse } from './supabase';
import { clubDateString, isSurveyOpen } from './surveyWindow';

const SURVEY_COLUMNS = 'id, event_type, event_date, event_name, reference_id, is_active, opens_at, closes_at, created_by, created_at';

/** Labels for the two rating rows, taken from the meeting's calendar event. */
export interface SurveyLabels {
  subjectHeading: 'Speaker' | 'Program';
  subject: string;
  mealHeading: 'Meal';
  meal: string;
}

/** The most recent meeting survey that is open now (a meeting's survey stays open until the following Tuesday). */
export async function findOpenMeetingSurvey(): Promise<PostEventSurvey | null> {
  const today = clubDateString();
  const weekAgo = clubDateString(new Date(Date.now() - 7 * 24 * 3600 * 1000));
  const { data, error } = await supabase
    .schema('p0012_rotary')
    .from('post_event_surveys')
    .select(SURVEY_COLUMNS)
    .eq('event_type', 'meeting')
    .eq('is_active', true)
    .gte('event_date', weekAgo)
    .lte('event_date', today)
    .order('event_date', { ascending: false });
  if (error) throw error;
  return ((data || []) as PostEventSurvey[]).find((s) => isSurveyOpen(s)) ?? null;
}

export async function loadSurveyById(id: string): Promise<PostEventSurvey | null> {
  const { data, error } = await supabase
    .schema('p0012_rotary')
    .from('post_event_surveys')
    .select(SURVEY_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as PostEventSurvey | null) ?? null;
}

export async function loadMyResponse(surveyId: string, memberId: string): Promise<PostEventResponse | null> {
  const { data, error } = await supabase
    .schema('p0012_rotary')
    .from('post_event_responses')
    .select('id, survey_id, member_id, ratings, comment, share_name, created_at, updated_at')
    .eq('survey_id', surveyId)
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) throw error;
  return (data as PostEventResponse | null) ?? null;
}

/**
 * Speaker row: "Speaker" + the program when it's a speaker line, else "Program" (business meetings,
 * socials, special events). Meal row: "Meal" + caterer, else the venue (socials), else "Lunch".
 * The calendar event is the survey's reference_id, or the lunch event on the same date.
 */
export async function loadSurveyLabels(survey: PostEventSurvey): Promise<SurveyLabels> {
  let query = supabase
    .schema('p0012_rotary')
    .from('calendar_events')
    .select('event_name, speaker_topic, caterer, venue_name, category, start_date')
    .eq('status', 'Active');
  if (survey.reference_id) {
    query = query.eq('id', survey.reference_id);
  } else {
    // Leader-made surveys without a link: the lunch event on that date (a small window, then match the club date).
    const day = new Date(`${survey.event_date}T12:00:00Z`).getTime();
    query = query
      .in('category', ['Club Meeting', 'Club Event'])
      .gte('start_date', new Date(day - 18 * 3600 * 1000).toISOString())
      .lte('start_date', new Date(day + 18 * 3600 * 1000).toISOString());
  }
  const { data } = await query;
  const event = (data || []).find((e) => clubDateString(new Date(e.start_date)) === survey.event_date) ?? null;

  const name = event?.event_name || survey.event_name;
  const isSpeaker = !!event?.speaker_topic;
  return {
    subjectHeading: isSpeaker ? 'Speaker' : 'Program',
    subject: name,
    mealHeading: 'Meal',
    meal: event?.caterer || event?.venue_name || 'Lunch',
  };
}
