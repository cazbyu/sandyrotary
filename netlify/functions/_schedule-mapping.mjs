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

export const SPECIAL_EVENTS = [
  'Christmas Party',
  'Initiation',
  'Rotary Day at the Legislature',
  'Tour of the Utah Museum',
  'Spring Break',
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
  'start_date',
  'end_date',
];

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
    eventName = program;
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
    speakerTopic = program;
    caterer = locationCaterer;
  }

  const hostMember = clean(row.host_member);
  const descriptionParts = [
    hostMember && `Speaker arranged by: ${hostMember}`,
    clean(row.notes),
    boardCell && !isBoardMeeting ? boardCell : null,
  ].filter(Boolean);

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
      start_date: zonedTimeToIso(date, ctx.meetingStart, ctx.timeZone),
      end_date: zonedTimeToIso(date, ctx.meetingEnd, ctx.timeZone),
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
  if (organization === null) return { reason: 'missing organization' };

  const dateTbd = date.dateTbd || (SERVICE_FIRST_OF_MONTH_IS_TBD && date.d === 1);

  let eventName = details ? `${organization} — ${details}` : organization;
  if (dateTbd) eventName = `(Date TBD) ${eventName}`;

  const isFundraiser = /fundraiser|silent auction/i.test(`${organization} ${details ?? ''}`);

  return {
    record: {
      event_name: eventName,
      category: isFundraiser ? 'Club FundRaiser' : 'Club Service Project',
      status: 'Active',
      description: details,
      speaker_topic: null,
      caterer: null,
      venue_name: clean(row.location),
      is_board_meeting: false,
      start_date: zonedTimeToIso(date, SERVICE_START, ctx.timeZone),
      end_date: zonedTimeToIso(date, SERVICE_END, ctx.timeZone),
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
 * Decide inserts/updates against existing rows.
 * Only rows with sync_source = 'google-sheet' dated on/after the window are considered;
 * anything else passed in is ignored (defence in depth — the query filters too).
 */
export function planSync(mapped, existingRows, ctx) {
  const tz = ctx.timeZone;
  const candidates = (existingRows || []).filter(
    (r) => r.sync_source === SYNC_SOURCE && zonedDateString(r.start_date, tz) >= SYNC_WINDOW_START,
  );

  const byKey = new Map();
  for (const row of candidates) {
    const key = matchKey(row, tz);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }

  const inserts = [];
  const updates = [];
  let unchanged = 0;
  const matchedIds = new Set();
  const finalRows = []; // post-sync view of synced rows, for duplicate detection

  for (const { tab, record } of mapped) {
    const pool = byKey.get(matchKey(record, tz));
    const existing = pool && pool.shift();
    if (!existing) {
      inserts.push({ tab, record });
      finalRows.push({ id: null, ...record, tab });
      continue;
    }
    matchedIds.add(existing.id);
    const changes = {};
    for (const field of SYNC_OWNED_FIELDS) {
      if (!sameValue(field, existing[field], record[field])) changes[field] = record[field];
    }
    if (Object.keys(changes).length === 0) unchanged++;
    else updates.push({ tab, id: existing.id, changes, record });
    finalRows.push({ ...existing, ...record, id: existing.id, tab });
  }

  const orphaned = candidates
    .filter((r) => !matchedIds.has(r.id))
    .map((r) => ({ id: r.id, date: zonedDateString(r.start_date, tz), event_name: r.event_name }));

  for (const r of candidates) {
    if (!matchedIds.has(r.id)) finalRows.push({ ...r, tab: tabForCategory(r.category) });
  }

  return { inserts, updates, unchanged, orphaned, finalRows };
}

/**
 * 2+ synced lunch-tab rows on the same date, any category (one lunch event per date is the
 * real rule). Service rows are never flagged: several projects often share a month-only date.
 * Rows without a `tab` (e.g. freshly inserted DB rows) get it from their category.
 * New rows have id null until inserted.
 */
export function findPossibleDuplicates(rows, timeZone = DEFAULT_TIME_ZONE) {
  const groups = new Map();
  for (const r of rows) {
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
