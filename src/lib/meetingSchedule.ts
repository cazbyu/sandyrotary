/**
 * Reads the weekly meeting schedule from calendar_events (synced from the board sheet).
 * Lunch-tab rows (one per Wednesday) say whether a week is a normal meeting, the social,
 * or no meeting; service projects on the same date are separate events.
 */

export const LUNCH_CATEGORIES = ['Club Meeting', 'Club Event', 'No Meeting'];

export interface ScheduleEvent {
  id: string;
  event_name: string;
  start_date: string;
  category?: string | null;
}

export function isLunchEvent(evt: { category?: string | null }): boolean {
  return !!evt.category && LUNCH_CATEGORIES.includes(evt.category);
}

/** The club's social is the last Wednesday of the month. */
export function isLastWednesdayOfMonth(date: Date): boolean {
  if (date.getDay() !== 3) return false;
  const nextWeek = new Date(date);
  nextWeek.setDate(nextWeek.getDate() + 7);
  return nextWeek.getMonth() !== date.getMonth();
}

/** Local YYYY-MM-DD (members are in Utah and events are at midday). */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function eventDateKey(evt: { start_date: string }): string {
  const d = new Date(evt.start_date);
  d.setHours(12, 0, 0, 0);
  return localDateKey(d);
}

export function groupEventsByDate<E extends { start_date: string }>(evts: E[]): Record<string, E[]> {
  const byDate: Record<string, E[]> = {};
  for (const evt of evts) {
    const key = eventDateKey(evt);
    (byDate[key] ||= []).push(evt);
  }
  return byDate;
}

export interface WednesdayInfo<E> {
  lunchEvent?: E;
  otherEvents: E[];
  isSocial: boolean;
  isNoMeeting: boolean;
}

export function classifyWednesday<E extends ScheduleEvent>(date: Date, eventsOnThatDate: E[]): WednesdayInfo<E> {
  const lunch = eventsOnThatDate.filter(isLunchEvent);
  if (lunch.length > 1) {
    console.warn(`meetingSchedule: ${lunch.length} lunch events on ${localDateKey(date)}; using the first`, lunch);
  }
  const lunchEvent = lunch[0];
  const otherEvents = eventsOnThatDate.filter((e) => !isLunchEvent(e));
  const isNoMeeting = lunchEvent?.category === 'No Meeting';
  const isSocial = lunchEvent
    ? /^social meeting/i.test(lunchEvent.event_name)
    : isLastWednesdayOfMonth(date);
  return { lunchEvent, otherEvents, isSocial, isNoMeeting };
}

/**
 * Default plan when the member hasn't set one: attend normal meetings, skip socials and
 * other events. No Meeting weeks have no plan (null).
 */
export function defaultAttending(row: { isMeeting: boolean; isSocial: boolean; isNoMeeting?: boolean }): boolean | null {
  if (row.isNoMeeting) return null;
  return row.isMeeting && !row.isSocial;
}
