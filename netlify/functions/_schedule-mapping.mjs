/**
 * Pure mapping + planning for schedule-sync (board spreadsheet → calendar_events).
 * No I/O here so everything is unit-testable with `node --test`.
 */

export const SYNC_SOURCE = 'google-sheet';
export const SYNC_WINDOW_START = '2026-07-01';
export const DEFAULT_TIME_ZONE = 'America/Denver';
export const DEFAULT_MEETING_START = { h: 12, m: 15 };
export const DEFAULT_MEETING_END = { h: 13, m: 30 };
export const SERVICE_START = { h: 12, m: 0 };
export const SERVICE_END = { h: 13, m: 0 };

// Susan writes some service dates as "November 2026"; the .xlsx stores those as the 1st
// and n8n only sees the serial, so any service date on the 1st is treated as month-only.
export const SERVICE_FIRST_OF_MONTH_IS_TBD = true;

// Categories only the service tab produces; everything else came from the lunch tab.
export const SERVICE_CATEGORIES = ['Club Service Project', 'Club FundRaiser'];

export function tabForCategory(category) {
  return SERVICE_CATEGORIES.includes(category) ? 'service' : 'lunch';
}

// "Spring Break in Canyons" is not here: it's a regular meeting at another location.
export const SPECIAL_EVENTS = [
  'Christmas Party',
  'Initiation',
  'Rotary Day at the Legislature',
  'Tour of the Utah Museum',
];

// Fields the sync owns. Everything else (speaker_name, speaker_bio,
// enable_rsvp after insert, created_by, google_calendar_id, ...) belongs to the app.
export const SYNC_OWNED_FIELDS = [
  'event_name',
  'category',
  'status',
  'description',
  'speaker_topic',
  'caterer',
  'venue_name',
  'is_board_meeting',
  'is_all_day',
  'start_date',
  'end_date',
];

// A run that would hide more than this many rows of one tab (and more than a fifth of
// that tab's active rows) is treated as a bad sheet read: nothing on that tab is written
// (no inserts, updates or hides) and a warning is returned. `allow_bulk_hide` overrides it.
export const MAX_DEACTIVATIONS_PER_TAB = 5;

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

// ---------- small helpers ----------

export function isBlank(value) {
  if (value === null || value === undefined) return true;
  const s = String(value).trim().toLowerCase();
  return s === '' || s === '-' || s === 'n/a';
}

function clean(value) {
  return isBlank(value) ? null : String(value).trim();
}

/** Trim + lowercase keys; inner spaces become underscores ("Host Member" → host_member). */
export function normalizeKeys(row) {
  const out = {};
  if (!row || typeof row !== 'object') return out;
  for (const [k, v] of Object.entries(row)) {
    out[String(k).trim().toLowerCase().replace(/\s+/g, '_')] = v;
  }
  return out;
}

const pad = (n) => String(n).padStart(2, '0');

function ymd({ y, m, d }) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

// ---------- time zones (no dependencies; DST-aware via Intl) ----------

function tzOffsetMs(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - utcMs;
}

/** Wall-clock time in `timeZone` → real instant (ISO string, UTC). */
export function zonedTimeToIso(date, time, timeZone = DEFAULT_TIME_ZONE) {
  const guess = Date.UTC(date.y, date.m - 1, date.d, time.h, time.m);
  let utc = guess - tzOffsetMs(guess, timeZone);
  // Re-check once in case the guess straddled a DST change.
  const corrected = guess - tzOffsetMs(utc, timeZone);
  if (corrected !== utc) utc = corrected;
  return new Date(utc).toISOString();
}

/** Instant → 'YYYY-MM-DD' calendar date in `timeZone`. */
export function zonedDateString(instant, timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(instant));
}

// ---------- parsing ----------

/**
 * Returns { y, m, d, dateTbd } or null.
 * Accepts M/D/YYYY, M/D/YY, Excel serials (40000–60000), "Month YYYY",
 * and ISO YYYY-MM-DD (in case n8n hands dates over already converted).
 */
export function parseSheetDate(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '') return null;

  let match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (match) {
    const m = Number(match[1]);
    const d = Number(match[2]);
    let y = Number(match[3]);
    if (match[3].length === 2) y += 2000;
    return validDate(y, m, d) ? { y, m, d, dateTbd: false } : null;
  }

  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Math.floor(Number(s));
    if (serial < 40000 || serial > 60000) return null;
    const dt = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), dateTbd: false };
  }

  match = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    return validDate(y, m, d) ? { y, m, d, dateTbd: false } : null;
  }

  match = s.match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
  if (match) {
    const name = match[1].toLowerCase();
    const idx = name.length >= 3 ? MONTHS.findIndex((mn) => mn.startsWith(name)) : -1;
    if (idx === -1) return null;
    return { y: Number(match[2]), m: idx + 1, d: 1, dateTbd: true };
  }

  return null;
}

function validDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function parseClock(h, m, ampm) {
  let hour = Number(h);
  const minute = m ? Number(m) : 0;
  if (ampm) {
    const pm = ampm.toLowerCase() === 'pm';
    if (hour === 12) hour = pm ? 12 : 0;
    else if (pm) hour += 12;
  }
  return { h: hour, m: minute };
}

/**
 * "Wednesday, 12:15pm - 1:30pm" → { start: {h:12,m:15}, end: {h:13,m:30} }.
 * Falls back to 12:15–13:30 when it can't parse.
 */
export function parseMeetingTime(text) {
  const fallback = { start: DEFAULT_MEETING_START, end: DEFAULT_MEETING_END };
  if (!text) return fallback;
  const match = String(text).match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
  );
  if (!match) return fallback;
  const end = parseClock(match[4], match[5], match[6]);
  const start = parseClock(match[1], match[2], match[3] || match[6]);
  if (start.h > 23 || end.h > 23 || start.m > 59 || end.m > 59) return fallback;
  if (start.h * 60 + start.m >= end.h * 60 + end.m) return fallback;
  return { start, end };
}

// ---------- times written in sheet text ----------

// A clock token: "6", "6:30", "6pm", "6 p.m.", "6:30 PM", or "noon". Digits touching "/", ":",
// other digits or letters are never a time, so dates ("9/11", "12/16"), street numbers
// ("6990 S 300 E") and ordinals ("4th of July") don't match.
const TIME_TOKEN = /(?<![\d/:.])(?:(\d{1,2})(?::(\d{2}))?(?:\s*([ap])\.?\s?m\b\.?|(?![\d/:a-z]))|\b(noon)\b)/gi;
const RANGE_JOIN = /^\s*(?:to|until|till|'?til|thru|through|-|–|—)\s*$/i;
const AND_JOIN = /^\s*and\s*$/i;
const AT_BEFORE = /(?:^|[^a-z])at\s+$/i;
// A bare number right after a month, weekday or room word is a date or a room, not a range start.
const NOT_A_CLOCK_BEFORE = /(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?|\broom|\bno\.?|#)\s*$/i;

function tokenMinutes(hour, minute, meridiem) {
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    return ((hour % 12) + (meridiem === 'p' ? 12 : 0)) * 60 + minute;
  }
  // No am/pm: 7–11 → morning, 12 → noon, 1–6 → afternoon/evening. Anything else is implausible.
  if (hour >= 7 && hour <= 11) return hour * 60 + minute;
  if (hour === 12) return 12 * 60 + minute;
  if (hour >= 1 && hour <= 6) return (hour + 12) * 60 + minute;
  return null;
}

const hhmm = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
const plausibleStart = (mins) => mins >= 6 * 60 && mins < 22 * 60;

function readTokens(text) {
  const tokens = [];
  for (const m of text.matchAll(TIME_TOKEN)) {
    const noon = m[4] !== undefined;
    tokens.push({
      index: m.index,
      end: m.index + m[0].length,
      hour: noon ? 12 : Number(m[1]),
      minute: noon || m[2] === undefined ? 0 : Number(m[2]),
      hasColon: noon || m[2] !== undefined,
      meridiem: noon ? 'p' : (m[3] ? m[3].toLowerCase() : null),
      noon,
    });
  }
  return tokens;
}

/**
 * "5:30 to 7:30 pm": one am/pm at the end applies to both ends. At least one end needs
 * am/pm (or "noon"). Returns { range } or { reject: 'date' | 'other' }.
 */
function readRange(a, b, textBefore) {
  if (!a.meridiem && !b.meridiem) return { reject: 'other' };
  // "Nov 7 - 6pm", "Room 2 - 6pm": the bare number is a date or a room, not the start.
  if (!a.meridiem && !a.hasColon && NOT_A_CLOCK_BEFORE.test(textBefore)) return { reject: 'date' };
  const end = b.meridiem ? tokenMinutes(b.hour, b.minute, b.meridiem) : null;
  let start;
  let morningGuess = false;
  if (a.meridiem) {
    start = tokenMinutes(a.hour, a.minute, a.meridiem);
  } else {
    start = tokenMinutes(a.hour, a.minute, b.meridiem);
    // "11:30 to 1 pm": the shared "pm" would put the start after the end, so it's morning.
    if (start !== null && end !== null && start >= end) {
      start = tokenMinutes(a.hour, a.minute, 'a');
      morningGuess = true;
    }
  }
  if (start === null) return { reject: 'other' };
  let endMins = end;
  if (endMins === null) {
    // End without am/pm: the first reading of that hour that comes after the start.
    const base = (b.hour % 12) * 60 + b.minute;
    endMins = b.minute > 59 ? null : ([base, base + 12 * 60].find((m) => m > start) ?? null);
  }
  const maxSpan = morningGuess ? 6 * 60 : 12 * 60;
  if (endMins === null || endMins <= start || endMins - start > maxSpan || !plausibleStart(start)) {
    return { reject: 'other' };
  }
  return { range: { start: hhmm(start), end: hhmm(endMins) } };
}

/**
 * The first time written in `texts` (checked in order), or null.
 * Recognises "6 p.m.", "6pm", "6:30 pm", "at 10:30", and ranges "5:30 to 7:30 pm" /
 * "5:30-7:30pm" / "5:30 – 7:30 p.m." / "noon - 2pm" / "4:30 until 6:30 pm".
 * A lone time needs am/pm, or "at" plus a colon time ("at 10:30"): notes like "until 12:05",
 * "at 3 schools" or "at 4th of July" are not times. "noon" only counts inside a range.
 * The end of a range that couldn't be read ("between 5 and 7 pm") is never taken as a start.
 * Returns { start: 'HH:MM', end?: 'HH:MM' } — end only when the text gives a range.
 */
export function parseTimeFromText(texts) {
  for (const raw of texts || []) {
    if (raw === null || raw === undefined) continue;
    const text = String(raw);
    const tokens = readTokens(text);
    const endsUnreadRange = new Set();
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const next = tokens[i + 1];
      const between = next ? text.slice(tok.end, next.index) : '';
      if (next && RANGE_JOIN.test(between)) {
        const result = readRange(tok, next, text.slice(0, tok.index));
        if (result.range) return result.range;
        if (result.reject === 'other') endsUnreadRange.add(i + 1);
      } else if (next && AND_JOIN.test(between)) {
        endsUnreadRange.add(i + 1);
      }
      if (tok.noon || endsUnreadRange.has(i)) continue;
      const afterAt = AT_BEFORE.test(text.slice(0, tok.index));
      if (!tok.meridiem && !(afterAt && tok.hasColon)) continue;
      const start = tokenMinutes(tok.hour, tok.minute, tok.meridiem);
      if (start !== null && plausibleStart(start)) return { start: hhmm(start) };
    }
  }
  return null;
}

const toClock = (s) => ({ h: Number(s.slice(0, 2)), m: Number(s.slice(3, 5)) });

/**
 * Start/end clocks for a parsed time. A range is used as written; a single time runs to the
 * meeting end (13:30) when it starts before it, otherwise for two hours.
 */
export function timesFromParsed(parsed, meetingEnd = DEFAULT_MEETING_END) {
  const start = toClock(parsed.start);
  if (parsed.end) return { start, end: toClock(parsed.end) };
  const startMins = start.h * 60 + start.m;
  const meetingEndMins = meetingEnd.h * 60 + meetingEnd.m;
  const endMins = startMins < meetingEndMins ? meetingEndMins : startMins + 120;
  return { start, end: { h: Math.floor(endMins / 60), m: endMins % 60 } };
}

export function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Build ctx from club_settings values (either may be missing). */
export function buildContext({ meetingTime, meetingTimezone } = {}) {
  const { start, end } = parseMeetingTime(meetingTime);
  const timeZone = meetingTimezone && isValidTimeZone(meetingTimezone) ? meetingTimezone : DEFAULT_TIME_ZONE;
  return { meetingStart: start, meetingEnd: end, timeZone };
}

// ---------- row mapping ----------

function allBlank(row) {
  return Object.values(row).every(isBlank);
}

function resolveDate(rawDate) {
  const date = parseSheetDate(rawDate);
  if (!date) return { reason: 'unparseable date' };
  if (ymd(date) < SYNC_WINDOW_START) return { reason: 'before sync window' };
  return { date };
}

/** Returns { record } or { reason }. */
export function mapLunchRow(rawRow, ctx = buildContext()) {
  const row = normalizeKeys(rawRow);
  if (allBlank(row)) return { reason: 'empty row' };

  const { date, reason } = resolveDate(row.date);
  if (reason) return { reason };

  const program = clean(row.program);
  const locationCaterer = clean(row.location_caterer);
  const boardCell = clean(row.board_meeting);
  const isBoardMeeting = boardCell !== null && boardCell.toLowerCase() === 'x';

  let eventName = 'Weekly Club Meeting';
  let category = 'Club Meeting';
  let speakerTopic = null;
  let caterer = null;
  let venueName = null;

  if (program === null) {
    // Plain weekly meeting, nothing else to fill in.
  } else if (/^off\b/i.test(program)) {
    eventName = `No Meeting — ${program}`;
    category = 'No Meeting';
  } else if (/^social meeting/i.test(program)) {
    // Socials are special events (light blue on the Calendar). The app still detects
    // them by event_name, so attendance defaults don't depend on this category.
    eventName = program;
    category = 'Club Event';
    venueName = locationCaterer;
  } else if (program.toLowerCase() === 'business meeting') {
    eventName = 'Business Meeting';
    caterer = locationCaterer;
  } else if (SPECIAL_EVENTS.some((kw) => program.toLowerCase().includes(kw.toLowerCase()))) {
    eventName = program;
    category = 'Club Event';
    venueName = locationCaterer;
  } else {
    // Speaker line is stored whole; names/topics are too inconsistent to split.
    // It is also the title, so Club Events and My Attendance Plans show the speaker.
    eventName = program;
    speakerTopic = program;
    caterer = locationCaterer;
  }

  // host_member ("who arranged the speaker") is internal to the board and is not synced.
  const notes = clean(row.notes);
  const boardNote = boardCell && !isBoardMeeting ? boardCell : null;
  const descriptionParts = [notes, boardNote].filter(Boolean);

  // A time written in the program or notes ("Initiation - 6 p.m.") overrides the lunch slot.
  // Month-only dates are all-day, like on the service tab.
  const parsed = date.dateTbd ? null : parseTimeFromText([program, notes, boardNote]);
  const { start, end } = parsed
    ? timesFromParsed(parsed, ctx.meetingEnd)
    : { start: ctx.meetingStart, end: ctx.meetingEnd };

  return {
    record: {
      event_name: eventName,
      category,
      status: 'Active',
      description: descriptionParts.length ? descriptionParts.join(' · ') : null,
      speaker_topic: speakerTopic,
      caterer,
      venue_name: venueName,
      is_board_meeting: isBoardMeeting,
      is_all_day: date.dateTbd,
      start_date: zonedTimeToIso(date, start, ctx.timeZone),
      end_date: zonedTimeToIso(date, end, ctx.timeZone),
      sync_source: SYNC_SOURCE,
    },
    dateTbd: date.dateTbd,
  };
}

/** Returns { record } or { reason }. */
export function mapServiceRow(rawRow, ctx = buildContext()) {
  const row = normalizeKeys(rawRow);
  if (allBlank(row)) return { reason: 'empty row' };

  const { date, reason } = resolveDate(row.date);
  if (reason) return { reason };

  const organization = clean(row.organization);
  const details = clean(row.details);
  const location = clean(row.location);
  if (organization === null) return { reason: 'missing organization' };

  const dateTbd = date.dateTbd || (SERVICE_FIRST_OF_MONTH_IS_TBD && date.d === 1);

  let eventName = details ? `${organization} — ${details}` : organization;
  if (dateTbd) eventName = `(Date TBD) ${eventName}`;

  const isFundraiser = /fundraiser|silent auction/i.test(`${organization} ${details ?? ''}`);

  // A written time sets the slot; otherwise the project is all-day. All-day rows keep a
  // 12:00–13:00 Denver slot so the stored date never shifts across time zones.
  const parsed = dateTbd ? null : parseTimeFromText([details, location]);
  const { start, end } = parsed
    ? timesFromParsed(parsed, ctx.meetingEnd)
    : { start: SERVICE_START, end: SERVICE_END };

  return {
    record: {
      event_name: eventName,
      category: isFundraiser ? 'Club FundRaiser' : 'Club Service Project',
      status: 'Active',
      description: details,
      speaker_topic: null,
      caterer: null,
      venue_name: location,
      is_board_meeting: false,
      is_all_day: !parsed,
      start_date: zonedTimeToIso(date, start, ctx.timeZone),
      end_date: zonedTimeToIso(date, end, ctx.timeZone),
      sync_source: SYNC_SOURCE,
    },
    dateTbd,
  };
}

// ---------- matching / planning ----------

export function matchKey(record, timeZone = DEFAULT_TIME_ZONE) {
  return `${zonedDateString(record.start_date, timeZone)}|${record.category}|${record.event_name}`;
}

function sameValue(field, a, b) {
  if (field === 'start_date' || field === 'end_date') {
    if (!a || !b) return !a && !b;
    return new Date(a).getTime() === new Date(b).getTime();
  }
  const na = a === undefined || a === '' ? null : a;
  const nb = b === undefined || b === '' ? null : b;
  return na === nb;
}

/**
 * Map a payload into records. Returns { mapped: [{tab, record}], skipped }.
 * Rows that repeat an earlier row's match key are skipped.
 */
export function mapPayload({ lunch = [], service = [] }, ctx) {
  const mapped = [];
  const skipped = [];
  const seen = new Set();
  const run = (tab, rows, fn) => {
    for (const row of rows) {
      const result = fn(row, ctx);
      if (result.reason) {
        skipped.push({ tab, row, reason: result.reason });
        continue;
      }
      const key = matchKey(result.record, ctx.timeZone);
      if (seen.has(key)) {
        skipped.push({ tab, row, reason: 'duplicate in payload' });
        continue;
      }
      seen.add(key);
      mapped.push({ tab, record: result.record });
    }
  };
  run('lunch', lunch, mapLunchRow);
  run('service', service, mapServiceRow);
  return { mapped, skipped };
}

/**
 * Key used to pair payload rows with DB rows. There is one lunch-tab row per Wednesday,
 * so lunch rows match on date alone (a rename or category change updates in place).
 * Several service rows can share a date, so they keep the full (date, category, name) key.
 */
function planKey(tab, record, timeZone) {
  return tab === 'lunch'
    ? `lunch|${zonedDateString(record.start_date, timeZone)}`
    : `service|${matchKey(record, timeZone)}`;
}

const isInactive = (row) => row.status === 'Inactive';

/**
 * Decide inserts/updates/deactivations against existing rows.
 * Only rows with sync_source = 'google-sheet' dated on/after the window are considered;
 * anything else passed in is ignored (defence in depth — the query filters too).
 * Inactive synced rows are matchable, so a row that returns to the sheet is reactivated.
 * `tabs` lists the tabs present in the payload; rows of a missing tab are never hidden.
 * `allowBulkHide` skips the bad-read guard (for an intended bulk change to the sheet).
 */
export function planSync(mapped, existingRows, ctx, { tabs = ['lunch', 'service'], allowBulkHide = false } = {}) {
  const tz = ctx.timeZone;
  const candidates = (existingRows || []).filter(
    (r) => r.sync_source === SYNC_SOURCE && zonedDateString(r.start_date, tz) >= SYNC_WINDOW_START,
  );

  const byKey = new Map();
  for (const row of candidates) {
    const key = planKey(tabForCategory(row.category), row, tz);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }
  // Prefer an Active row when a key also has hidden leftovers.
  for (const rows of byKey.values()) rows.sort((a, b) => Number(isInactive(a)) - Number(isInactive(b)));

  // 2+ Active synced lunch-type rows on one date: ambiguous, so none are updated or hidden.
  // They stay in finalRows and surface in possible_duplicates.
  const heldIds = new Set();
  for (const [key, rows] of byKey) {
    const active = rows.filter((r) => !isInactive(r));
    if (key.startsWith('lunch|') && active.length > 1) rows.forEach((r) => heldIds.add(r.id));
  }

  const inserts = [];
  const updates = [];
  const matches = []; // { tab, existing, record, changed }

  for (const { tab, record } of mapped) {
    const pool = byKey.get(planKey(tab, record, tz));
    if (pool && pool.some((r) => heldIds.has(r.id))) continue;
    const existing = pool && pool.shift();
    if (!existing) {
      inserts.push({ tab, record });
      continue;
    }
    const changes = {};
    for (const field of SYNC_OWNED_FIELDS) {
      if (!sameValue(field, existing[field], record[field])) changes[field] = record[field];
    }
    const changed = Object.keys(changes).length > 0;
    if (changed) updates.push({ tab, id: existing.id, changes, record });
    matches.push({ tab, existing, record, changed });
  }
  const matchedIds = new Set(matches.map((m) => m.existing.id));

  // Active rows no longer in the sheet are hidden (never deleted). Rows already hidden stay
  // quiet, so each disappearance is reported once. A row the sync skipped (e.g. unparseable
  // date) can't be matched, so it counts as missing too.
  const vanished = candidates.filter(
    (r) => !matchedIds.has(r.id) && !heldIds.has(r.id) && !isInactive(r)
      && tabs.includes(tabForCategory(r.category)),
  );

  // Bad-read guard: when most of a tab seems to have vanished, freeze that tab for this run.
  const warnings = [];
  const frozenTabs = new Set();
  for (const tab of tabs) {
    const missing = vanished.filter((r) => tabForCategory(r.category) === tab).length;
    const active = candidates.filter((r) => tabForCategory(r.category) === tab && !isInactive(r)).length;
    if (!allowBulkHide && missing > MAX_DEACTIVATIONS_PER_TAB && missing > active / 5) {
      frozenTabs.add(tab);
      warnings.push(
        `${tab} tab: ${missing} of ${active} active rows are missing from the sheet. This looks like an `
        + `incomplete sheet read, so no ${tab} rows were changed this run. Check the sheet; if the change is `
        + 'intended, run once with "allow_bulk_hide": true.',
      );
    }
  }
  const live = (tab) => !frozenTabs.has(tab);

  const deactivations = vanished.filter((r) => live(tabForCategory(r.category)));
  const deactivateIds = new Set(deactivations.map((r) => r.id));
  const orphaned = deactivations
    .map((r) => ({ id: r.id, date: zonedDateString(r.start_date, tz), event_name: r.event_name }));

  // Post-sync view of synced rows, for duplicate detection.
  const finalRows = [];
  for (const { tab, existing, record } of matches) {
    finalRows.push(live(tab) ? { ...existing, ...record, id: existing.id, tab } : { ...existing, tab });
  }
  for (const { tab, record } of inserts) {
    if (live(tab)) finalRows.push({ id: null, ...record, tab });
  }
  for (const r of candidates) {
    if (matchedIds.has(r.id)) continue;
    const status = deactivateIds.has(r.id) ? 'Inactive' : r.status;
    finalRows.push({ ...r, status, tab: tabForCategory(r.category) });
  }

  return {
    inserts: inserts.filter((i) => live(i.tab)),
    updates: updates.filter((u) => live(u.tab)),
    unchanged: matches.filter((m) => !m.changed).length,
    deactivations: deactivations.map((r) => r.id),
    orphaned,
    warnings,
    frozenTabs: [...frozenTabs],
    finalRows,
  };
}

/**
 * 2+ synced lunch-tab rows on the same date, any category (one lunch event per date is the
 * real rule). Service rows are never flagged: several projects often share a month-only date.
 * Rows without a `tab` (e.g. freshly inserted DB rows) get it from their category.
 * Hidden (Inactive) rows don't count. New rows have id null until inserted.
 */
export function findPossibleDuplicates(rows, timeZone = DEFAULT_TIME_ZONE) {
  const groups = new Map();
  for (const r of rows) {
    if (isInactive(r)) continue;
    if ((r.tab ?? tabForCategory(r.category)) !== 'lunch') continue;
    const date = zonedDateString(r.start_date, timeZone);
    if (!groups.has(date)) groups.set(date, { categories: new Set(), ids: [] });
    const group = groups.get(date);
    group.categories.add(r.category);
    group.ids.push(r.id ?? '(new)');
  }
  const out = [];
  for (const [date, { categories, ids }] of groups) {
    if (ids.length < 2) continue;
    out.push({ date, tab: 'lunch', categories: [...categories], ids });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- post-meeting surveys ----------

// Lunch-tab categories that get a post-meeting survey (No Meeting weeks don't).
export const SURVEY_CATEGORIES = ['Club Meeting', 'Club Event'];

/** closes_at, as the DB generates it: 00:00 in the club's time zone on event_date + 7. */
export function surveyClosesAt(eventDate, timeZone = DEFAULT_TIME_ZONE) {
  const [y, m, d] = eventDate.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 7));
  return zonedTimeToIso(
    { y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() },
    { h: 0, m: 0 },
    timeZone,
  );
}

/**
 * Keep one post-meeting survey per lunch meeting (p0012_rotary.post_event_surveys).
 * - calendarRows: synced lunch-tab rows after the sync (id, category, status, event_name, start_date);
 *   rows without an id (dry-run inserts) are ignored.
 * - surveys: existing event_type 'meeting' surveys (id, event_date, event_name, reference_id, is_active, opens_at).
 * Rules: an Active Club Meeting / Club Event gets a survey (adopting a leader-made survey with no link on the
 * same date, else creating one) that opens at the meeting start; a linked survey follows renames and is
 * deactivated when its row is hidden or becomes No Meeting. Surveys that have closed are history and are
 * never touched; nothing is created for a meeting whose survey would already be closed. Dates with 2+
 * qualifying rows are ambiguous and skipped. Never deletes.
 * Returns { creates: [row], adoptions: [{ id, changes }], updates: [{ id, changes }], skippedDates }.
 */
export function planSurveys(calendarRows, surveys, { now = new Date(), timeZone = DEFAULT_TIME_ZONE } = {}) {
  const nowMs = new Date(now).getTime();
  const lunchRows = (calendarRows || []).filter(
    (r) => r.id && tabForCategory(r.category) === 'lunch'
      && nowMs < new Date(surveyClosesAt(zonedDateString(r.start_date, timeZone), timeZone)).getTime(),
  );
  const qualifies = (r) => r.status === 'Active' && SURVEY_CATEGORIES.includes(r.category);

  const perDate = new Map();
  for (const r of lunchRows.filter(qualifies)) {
    const date = zonedDateString(r.start_date, timeZone);
    perDate.set(date, (perDate.get(date) || 0) + 1);
  }
  const skippedDates = [...perDate].filter(([, n]) => n > 1).map(([date]) => date).sort();

  const byRef = new Map();
  const unlinkedByDate = new Map();
  for (const s of surveys || []) {
    if (s.reference_id) byRef.set(s.reference_id, s);
    else {
      if (!unlinkedByDate.has(s.event_date)) unlinkedByDate.set(s.event_date, []);
      unlinkedByDate.get(s.event_date).push(s);
    }
  }
  // Prefer an active leader-made survey, then the oldest.
  for (const list of unlinkedByDate.values()) {
    list.sort((a, b) => Number(b.is_active) - Number(a.is_active)
      || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
  }

  const sameInstant = (a, b) => (!a && !b) || (!!a && !!b && new Date(a).getTime() === new Date(b).getTime());
  const creates = [];
  const adoptions = [];
  const updates = [];

  for (const r of lunchRows) {
    const date = zonedDateString(r.start_date, timeZone);
    if (skippedDates.includes(date)) continue;
    const existing = byRef.get(r.id);

    if (existing) {
      if (nowMs >= new Date(existing.closes_at ?? surveyClosesAt(existing.event_date, timeZone)).getTime()) continue;
      const want = qualifies(r)
        ? { event_name: r.event_name, is_active: true, opens_at: r.start_date }
        : { is_active: false };
      const changes = {};
      if (want.event_name !== undefined && want.event_name !== existing.event_name) changes.event_name = want.event_name;
      if (want.is_active !== existing.is_active) changes.is_active = want.is_active;
      if (want.opens_at !== undefined && !sameInstant(want.opens_at, existing.opens_at)) changes.opens_at = want.opens_at;
      if (Object.keys(changes).length) updates.push({ id: existing.id, changes });
      continue;
    }
    if (!qualifies(r)) continue;

    const leaderMade = unlinkedByDate.get(date);
    if (leaderMade && leaderMade.length) {
      const s = leaderMade.shift();
      adoptions.push({
        id: s.id,
        changes: { reference_id: r.id, event_name: r.event_name, is_active: true, opens_at: r.start_date },
      });
      continue;
    }
    creates.push({
      event_type: 'meeting',
      event_date: date,
      event_name: r.event_name,
      reference_id: r.id,
      is_active: true,
      opens_at: r.start_date,
    });
  }

  return { creates, adoptions, updates, skippedDates };
}
