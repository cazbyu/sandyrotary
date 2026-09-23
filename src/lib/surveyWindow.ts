/**
 * Post-meeting survey window, mirroring p0012_rotary.post_event_survey_is_open():
 * open from opens_at (the meeting start; midnight on event_date if unset) until closes_at
 * (00:00 America/Denver on event_date + 7, i.e. the end of the following Tuesday).
 */

export const CLUB_TIME_ZONE = 'America/Denver';

export interface SurveyWindowFields {
  event_date: string;
  opens_at?: string | null;
  closes_at?: string | null;
  is_active?: boolean;
}

/** YYYY-MM-DD for an instant, in the club's time zone. */
export function clubDateString(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CLUB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** The instant a survey opens. Without opens_at: midnight club time on event_date (approximated safely). */
function opensAt(survey: SurveyWindowFields): number {
  if (survey.opens_at) return new Date(survey.opens_at).getTime();
  // Midnight Denver is 06:00 or 07:00 UTC; use the earlier so the UI never hides an open survey.
  return new Date(`${survey.event_date}T06:00:00Z`).getTime();
}

export function isSurveyOpen(survey: SurveyWindowFields, now: Date = new Date()): boolean {
  if (survey.is_active === false || !survey.closes_at) return false;
  const t = now.getTime();
  return t >= opensAt(survey) && t < new Date(survey.closes_at).getTime();
}

export function hasSurveyClosed(survey: SurveyWindowFields, now: Date = new Date()): boolean {
  return !!survey.closes_at && now.getTime() >= new Date(survey.closes_at).getTime();
}

/** "Tue, Sep 29": the last day a survey is open (closes_at is 00:00 the next day). */
export function lastOpenDayLabel(survey: SurveyWindowFields): string {
  if (!survey.closes_at) return '';
  const lastMoment = new Date(new Date(survey.closes_at).getTime() - 60_000);
  return lastMoment.toLocaleDateString('en-US', {
    timeZone: CLUB_TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "Wed, Sep 23" for an event_date (a plain date, shown as-is). */
export function eventDateLabel(eventDate: string): string {
  return new Date(`${eventDate}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
