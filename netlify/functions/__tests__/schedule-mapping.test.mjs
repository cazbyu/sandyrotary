import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSheetDate,
  parseMeetingTime,
  buildContext,
  mapLunchRow,
  mapServiceRow,
  mapPayload,
  planSync,
  findPossibleDuplicates,
  zonedTimeToIso,
  zonedDateString,
  parseTimeFromText,
} from '../_schedule-mapping.mjs';

const ctx = buildContext({ meetingTime: 'Wednesday, 12:15pm - 1:30pm', meetingTimezone: 'America/Denver' });

const lunch = (program, extra = {}) =>
  mapLunchRow({ date: '8/5/2026', program, host_member: '', location_caterer: 'Catering by Bryce', notes: '', board_meeting: '', ...extra }, ctx);

// ---------- lunch tab ----------

test('"Off for 4th" → No Meeting', () => {
  const { record } = lunch('Off for 4th');
  assert.equal(record.category, 'No Meeting');
  assert.equal(record.event_name, 'No Meeting — Off for 4th');
  assert.equal(record.caterer, null);
  assert.equal(record.venue_name, null);
});

test('"off for the 24th of July" → No Meeting', () => {
  const { record } = lunch('off for the 24th of July');
  assert.equal(record.category, 'No Meeting');
  assert.equal(record.event_name, 'No Meeting — off for the 24th of July');
});

test('"Wade Williams - nuclear energy" → whole text is event_name and speaker_topic', () => {
  const { record } = lunch('Wade Williams - nuclear energy');
  assert.equal(record.event_name, 'Wade Williams - nuclear energy');
  assert.equal(record.category, 'Club Meeting');
  assert.equal(record.speaker_topic, 'Wade Williams - nuclear energy');
  assert.equal(record.caterer, 'Catering by Bryce');
  assert.equal('speaker_name' in record, false, 'sync never sets speaker_name on the mapped record');
});

test('"CPR training - Jen Gerrard" → same pattern, no split', () => {
  const { record } = lunch('CPR training - Jen Gerrard');
  assert.equal(record.event_name, 'CPR training - Jen Gerrard');
  assert.equal(record.speaker_topic, 'CPR training - Jen Gerrard');
});

test('"Mayor Zoltanski" → event_name and speaker_topic are the program text', () => {
  const { record } = lunch('  Mayor Zoltanski ');
  assert.equal(record.event_name, 'Mayor Zoltanski');
  assert.equal(record.speaker_topic, 'Mayor Zoltanski');
  assert.equal(record.category, 'Club Meeting');
});

test('"Social Meeting at Simply Thai" → Club Event at venue', () => {
  const { record } = lunch('Social Meeting at Simply Thai', { location_caterer: 'Simply Thai' });
  assert.equal(record.event_name, 'Social Meeting at Simply Thai');
  assert.equal(record.category, 'Club Event');
  assert.equal(record.venue_name, 'Simply Thai');
  assert.equal(record.caterer, null);
});

test('"Business Meeting" → Business Meeting with caterer', () => {
  const { record } = lunch('Business Meeting');
  assert.equal(record.event_name, 'Business Meeting');
  assert.equal(record.category, 'Club Meeting');
  assert.equal(record.caterer, 'Catering by Bryce');
});

test('"Tour of the Utah Museum" → Club Event', () => {
  const { record } = lunch('Tour of the Utah Museum', { location_caterer: 'UMFA' });
  assert.equal(record.event_name, 'Tour of the Utah Museum');
  assert.equal(record.category, 'Club Event');
  assert.equal(record.venue_name, 'UMFA');
});

test('blank program → Weekly Club Meeting', () => {
  const { record } = lunch('');
  assert.equal(record.event_name, 'Weekly Club Meeting');
  assert.equal(record.category, 'Club Meeting');
  assert.equal(record.speaker_topic, null);
});

test('board_meeting "x" → true', () => {
  const { record } = lunch('', { board_meeting: ' X ' });
  assert.equal(record.is_board_meeting, true);
  assert.equal(record.description, null);
});

test('board_meeting note → false, note in description', () => {
  const note = '* we cannot get into the room this day until 12:05';
  const { record } = lunch('Wade Williams - nuclear energy', { host_member: 'Susan/Paul/Charisse', notes: 'Bring badges', board_meeting: note });
  assert.equal(record.is_board_meeting, false);
  assert.equal(record.description, `Bring badges · ${note}`);
});

test('8/5 row: host_member is not synced; description is just the board note', () => {
  const note = '* we cannot get into the room this day until 12:05';
  const { record } = lunch('Wade Williams - nuclear energy', { host_member: 'Susan/Paul/Charisse', board_meeting: note });
  assert.equal(record.description, note);
  assert.ok(!/arranged by/i.test(record.description));
});

test('"Business Meeting" stays Club Meeting; socials move to Club Event', () => {
  assert.equal(lunch('Business Meeting').record.category, 'Club Meeting');
  assert.equal(lunch('social meeting at Porter\'s').record.category, 'Club Event');
});

test('board_meeting "-" → false, nothing added', () => {
  const { record } = lunch('', { board_meeting: '-' });
  assert.equal(record.is_board_meeting, false);
  assert.equal(record.description, null);
});

test('keys are normalized (trim, lowercase)', () => {
  const { record } = mapLunchRow({ ' Date ': '8/5/2026', PROGRAM: 'Business Meeting', 'Location_Caterer': 'Bryce' }, ctx);
  assert.equal(record.event_name, 'Business Meeting');
  assert.equal(record.caterer, 'Bryce');
});

test('lunch times are real Denver instants (DST-aware) from club_settings', () => {
  const summer = lunch('').record; // 8/5/2026 is MDT (UTC-6)
  assert.equal(summer.start_date, '2026-08-05T18:15:00.000Z');
  assert.equal(summer.end_date, '2026-08-05T19:30:00.000Z');
  const winter = mapLunchRow({ date: '12/2/2026', program: '' }, ctx).record; // MST (UTC-7)
  assert.equal(winter.start_date, '2026-12-02T19:15:00.000Z');
  assert.equal(winter.end_date, '2026-12-02T20:30:00.000Z');
});

test('rows before 2026-07-01 are skipped', () => {
  assert.deepEqual(mapLunchRow({ date: '6/24/2026', program: 'x' }, ctx), { reason: 'before sync window' });
});

// ---------- service tab ----------

test('service "September 2026" → Sept 1, Date TBD', () => {
  const { record, dateTbd } = mapServiceRow(
    { date: 'September 2026', organization: 'Utah Food Bank', location: 'East Midvale Elementary 6990 S 300 E', details: 'Mobile Pantry' },
    ctx,
  );
  assert.equal(dateTbd, true);
  assert.equal(record.event_name, '(Date TBD) Utah Food Bank — Mobile Pantry');
  assert.equal(record.category, 'Club Service Project');
  assert.equal(record.venue_name, 'East Midvale Elementary 6990 S 300 E');
  assert.equal(record.description, 'Mobile Pantry');
  assert.equal(record.start_date, '2026-09-01T18:00:00.000Z'); // 12:00 MDT
  assert.equal(record.end_date, '2026-09-01T19:00:00.000Z');
});

test('service "Sandy Rotary" / "Orange Fundraiser" → Club FundRaiser', () => {
  const { record } = mapServiceRow({ date: '10/10/2026', organization: 'Sandy Rotary', location: '', details: 'Orange Fundraiser' }, ctx);
  assert.equal(record.category, 'Club FundRaiser');
  assert.equal(record.event_name, 'Sandy Rotary — Orange Fundraiser');
  assert.equal(record.venue_name, null);
});

test('service with blank details → organization alone', () => {
  const { record } = mapServiceRow({ date: '10/10/2026', organization: 'Utah Food Bank', details: 'n/a' }, ctx);
  assert.equal(record.event_name, 'Utah Food Bank');
  assert.equal(record.description, null);
});

// ---------- dates ----------

test('date "TBD" → skipped, unparseable date', () => {
  assert.deepEqual(mapLunchRow({ date: 'TBD', program: 'Business Meeting' }, ctx), { reason: 'unparseable date' });
  assert.equal(parseSheetDate('TBD'), null);
});

test('date "7/1/26" → 2026-07-01', () => {
  assert.deepEqual(parseSheetDate('7/1/26'), { y: 2026, m: 7, d: 1, dateTbd: false });
});

test('date "46204" → 2026-07-01 (Excel serial)', () => {
  assert.deepEqual(parseSheetDate('46204'), { y: 2026, m: 7, d: 1, dateTbd: false });
  assert.deepEqual(parseSheetDate(46204), { y: 2026, m: 7, d: 1, dateTbd: false });
});

test('invalid calendar dates are rejected', () => {
  assert.equal(parseSheetDate('2/30/2026'), null);
  assert.equal(parseSheetDate('123'), null);
});

test('meeting time parsing with fallback', () => {
  assert.deepEqual(parseMeetingTime('Wednesday, 12:15pm - 1:30pm'), { start: { h: 12, m: 15 }, end: { h: 13, m: 30 } });
  assert.deepEqual(parseMeetingTime('whenever'), { start: { h: 12, m: 15 }, end: { h: 13, m: 30 } });
  assert.deepEqual(parseMeetingTime(null), { start: { h: 12, m: 15 }, end: { h: 13, m: 30 } });
});

// ---------- matching ----------

const synced = (over) => ({
  id: 'synced-1',
  sync_source: 'google-sheet',
  event_name: 'Business Meeting',
  category: 'Club Meeting',
  status: 'Active',
  description: null,
  speaker_topic: null,
  caterer: 'Catering by Bryce',
  venue_name: null,
  is_board_meeting: false,
  is_all_day: false,
  start_date: '2026-08-05T18:15:00+00:00',
  end_date: '2026-08-05T19:30:00+00:00',
  ...over,
});

test('matcher: row with NULL sync_source on the same date is ignored', () => {
  const { mapped } = mapPayload({ lunch: [{ date: '8/5/2026', program: 'Business Meeting', location_caterer: 'Catering by Bryce' }] }, ctx);
  const manual = synced({ id: 'manual-1', sync_source: null });
  const plan = planSync(mapped, [manual], ctx);
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.updates.length, 0);
  assert.equal(plan.orphaned.length, 0, 'manual rows are never reported');
});

test('matcher: identical synced row → unchanged', () => {
  const { mapped } = mapPayload({ lunch: [{ date: '8/5/2026', program: 'Business Meeting', location_caterer: 'Catering by Bryce' }] }, ctx);
  const plan = planSync(mapped, [synced()], ctx);
  assert.equal(plan.unchanged, 1);
  assert.equal(plan.inserts.length + plan.updates.length, 0);
});

test('matcher: changed sync-owned field → update with only that change', () => {
  const { mapped } = mapPayload({ lunch: [{ date: '8/5/2026', program: 'Business Meeting', location_caterer: 'Fresh Caterer', board_meeting: 'x' }] }, ctx);
  const plan = planSync(mapped, [synced()], ctx);
  assert.equal(plan.updates.length, 1);
  assert.deepEqual(plan.updates[0].changes, { caterer: 'Fresh Caterer', is_board_meeting: true });
});

test('matcher: synced row missing from payload → orphaned (never deleted)', () => {
  const plan = planSync([], [synced()], ctx);
  assert.deepEqual(plan.orphaned, [{ id: 'synced-1', date: '2026-08-05', event_name: 'Business Meeting' }]);
});

test('matcher: synced rows before the window are ignored', () => {
  const old = synced({ id: 'old', start_date: '2026-06-24T18:15:00Z' });
  const plan = planSync([], [old], ctx);
  assert.equal(plan.orphaned.length, 0);
});

// ---------- v2.2: lunch rows matched by date only ----------

const weekly1007 = (over) => synced({
  id: 'weekly-1007',
  event_name: 'Weekly Club Meeting',
  caterer: null,
  start_date: '2026-10-07T18:15:00Z',
  end_date: '2026-10-07T19:30:00Z',
  ...over,
});

test('matcher: "Weekly Club Meeting" → "Mayor Zoltanski" on the same date is updated in place', () => {
  const { mapped } = mapPayload({ lunch: [{ date: '10/7/2026', program: 'Mayor Zoltanski' }] }, ctx);
  const plan = planSync(mapped, [weekly1007()], ctx);
  assert.equal(plan.inserts.length, 0);
  assert.deepEqual(plan.orphaned, []);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].id, 'weekly-1007');
  assert.deepEqual(plan.updates[0].changes, { event_name: 'Mayor Zoltanski', speaker_topic: 'Mayor Zoltanski' });
});

test('matcher: "Weekly Club Meeting" → "Off for Thanksgiving" updates category to No Meeting', () => {
  const { mapped } = mapPayload({ lunch: [{ date: '10/7/2026', program: 'Off for Thanksgiving' }] }, ctx);
  const plan = planSync(mapped, [weekly1007()], ctx);
  assert.equal(plan.inserts.length, 0);
  assert.deepEqual(plan.orphaned, []);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].changes.category, 'No Meeting');
  assert.equal(plan.updates[0].changes.event_name, 'No Meeting — Off for Thanksgiving');
});

test('matcher: 2 service rows on the same date with different names → both kept, no duplicate flag', () => {
  const service = [
    { date: '10/10/2026', organization: 'Utah Food Bank', details: 'Mobile Pantry' },
    { date: '10/10/2026', organization: 'Sandy Rotary', details: 'Orange Fundraiser' },
  ];
  const { mapped } = mapPayload({ service }, ctx);
  const existing = mapped.map(({ record }, i) => ({ id: `svc-${i}`, ...record }));
  const plan = planSync(mapped, existing, ctx);
  assert.equal(plan.unchanged, 2);
  assert.equal(plan.inserts.length + plan.updates.length + plan.orphaned.length, 0);
  assert.deepEqual(findPossibleDuplicates(plan.finalRows, ctx.timeZone), []);
});

test('matcher: 2 existing synced lunch-type rows on one date → reported, neither updated', () => {
  const { mapped } = mapPayload({ lunch: [{ date: '10/7/2026', program: 'Mayor Zoltanski' }] }, ctx);
  const existing = [weekly1007({ id: 'x' }), weekly1007({ id: 'y', event_name: 'No Meeting — Off', category: 'No Meeting' })];
  const plan = planSync(mapped, existing, ctx);
  assert.equal(plan.inserts.length + plan.updates.length, 0);
  assert.deepEqual(plan.orphaned, []);
  assert.deepEqual(findPossibleDuplicates(plan.finalRows, ctx.timeZone), [
    { date: '2026-10-07', tab: 'lunch', categories: ['Club Meeting', 'No Meeting'], ids: ['x', 'y'] },
  ]);
});

test('payload duplicates are skipped', () => {
  const row = { date: '8/5/2026', program: 'Business Meeting' };
  const { mapped, skipped } = mapPayload({ lunch: [row, row] }, ctx);
  assert.equal(mapped.length, 1);
  assert.equal(skipped[0].reason, 'duplicate in payload');
});

test('possible duplicates: 2+ synced lunch-tab rows same date, any category', () => {
  const dupes = findPossibleDuplicates([
    synced({ id: 'a' }),
    synced({ id: 'b', event_name: 'Weekly Club Meeting' }),
    synced({ id: 'c', category: 'No Meeting' }),
  ], 'America/Denver');
  assert.deepEqual(dupes, [{ date: '2026-08-05', tab: 'lunch', categories: ['Club Meeting', 'No Meeting'], ids: ['a', 'b', 'c'] }]);
});

// ---------- v2.1: month-only service dates, lunch-only duplicate warnings ----------

const foodBank = (date) =>
  mapServiceRow({ date, organization: 'Utah Food Bank', location: '', details: 'Mobile Pantry' }, ctx);

test('service 46327 (2026-11-01) → Date TBD on the 1st', () => {
  const { record, dateTbd } = foodBank(46327);
  assert.equal(dateTbd, true);
  assert.equal(zonedDateString(record.start_date), '2026-11-01');
  assert.equal(record.event_name, '(Date TBD) Utah Food Bank — Mobile Pantry');
});

test('service 46273 (2026-09-08) → exact date, not TBD', () => {
  const { record, dateTbd } = foodBank(46273);
  assert.equal(dateTbd, false);
  assert.equal(zonedDateString(record.start_date), '2026-09-08');
  assert.equal(record.event_name, 'Utah Food Bank — Mobile Pantry');
});

test('service "12/1/2026" → TBD (rule applies to every format)', () => {
  const { record, dateTbd } = foodBank('12/1/2026');
  assert.equal(dateTbd, true);
  assert.equal(record.event_name, '(Date TBD) Utah Food Bank — Mobile Pantry');
});

test('lunch 46204 (2026-07-01) "Off for 4th" → not TBD', () => {
  const { record, dateTbd } = mapLunchRow({ date: 46204, program: 'Off for 4th' }, ctx);
  assert.equal(dateTbd, false);
  assert.equal(record.event_name, 'No Meeting — Off for 4th');
});

test('4 service rows on 2026-12-01 → no possible duplicates', () => {
  const service = ['A', 'B', 'C', 'D'].map((org) => ({ date: '12/1/2026', organization: org, details: 'Project' }));
  const { mapped } = mapPayload({ service }, ctx);
  assert.equal(mapped.length, 4);
  const plan = planSync(mapped, [], ctx);
  assert.deepEqual(findPossibleDuplicates(plan.finalRows, ctx.timeZone), []);
});

test('2 lunch rows on the same date → flagged with tab "lunch"', () => {
  const { mapped } = mapPayload({ lunch: [
    { date: '8/5/2026', program: 'Business Meeting' },
    { date: '8/5/2026', program: 'Off for summer' },
  ] }, ctx);
  const plan = planSync(mapped, [], ctx);
  assert.deepEqual(findPossibleDuplicates(plan.finalRows, ctx.timeZone), [
    { date: '2026-08-05', tab: 'lunch', categories: ['Club Meeting', 'No Meeting'], ids: ['(new)', '(new)'] },
  ]);
});

test('zonedTimeToIso handles the DST switch day', () => {
  assert.equal(zonedTimeToIso({ y: 2026, m: 11, d: 1 }, { h: 12, m: 0 }, 'America/Denver'), '2026-11-01T19:00:00.000Z');
  assert.equal(zonedTimeToIso({ y: 2026, m: 3, d: 8 }, { h: 12, m: 0 }, 'America/Denver'), '2026-03-08T18:00:00.000Z');
});

// ---------- v2.4: times from text, all-day service, hide vanished rows ----------

const denverClock = (iso) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Denver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
const slot = (record) => `${denverClock(record.start_date)}–${denverClock(record.end_date)}`;

test('"Initiation - 6 p.m." → 18:00–20:00 Club Event', () => {
  const { record } = mapLunchRow({ date: '6/16/2027', program: 'Initiation - 6 p.m.', location_caterer: 'Peaks Rooms' }, ctx);
  assert.equal(record.category, 'Club Event');
  assert.equal(slot(record), '18:00–20:00');
  assert.equal(record.is_all_day, false);
});

test('service "Volunteer for Flag 9/11 project 5:30 to 7:30 pm" → 17:30–19:30, not all-day', () => {
  const { record } = mapServiceRow(
    { date: '9/9/2026', organization: 'Sandy City', details: 'Volunteer for Flag 9/11 project 5:30 to 7:30 pm', location: 'The Utah Healing Field, Sandy City' },
    ctx,
  );
  assert.equal(slot(record), '17:30–19:30');
  assert.equal(record.is_all_day, false);
  assert.equal(zonedDateString(record.start_date), '2026-09-09');
});

test('tour board note "…at 10:30; lunch served at noon…" → 10:30–13:30', () => {
  const note = 'this is at the Capitol north building at 10:30; lunch served at noon in the Kletting room (Senate building)';
  const { record } = mapLunchRow({ date: '8/19/2026', program: 'Tour of the Utah Museum', location_caterer: 'Kathryn', board_meeting: note }, ctx);
  assert.equal(slot(record), '10:30–13:30');
});

test('"Rotary Day at the Legislature" with no time → default 12:15–13:30', () => {
  const { record } = mapLunchRow({ date: '2/3/2027', program: 'Rotary Day at the Legislature', location_caterer: 'State Capitol' }, ctx);
  assert.equal(record.category, 'Club Event');
  assert.equal(slot(record), '12:15–13:30');
});

test('8/5 note "until 12:05" is not read as the meeting time', () => {
  const { record } = lunch('Wade Williams - nuclear energy', { board_meeting: '* we cannot get into the room this day until 12:05' });
  assert.equal(slot(record), '12:15–13:30');
});

test('service "Mobile Pantry" with an address → all-day, stored 12:00–13:00 Denver', () => {
  const { record } = mapServiceRow(
    { date: '9/8/2026', organization: 'Utah Food Bank', details: 'Mobile Pantry', location: 'East Midvale Elementary 6990 S 300 E' },
    ctx,
  );
  assert.equal(record.is_all_day, true);
  assert.equal(slot(record), '12:00–13:00');
});

test('month-only (Date TBD) service rows are all-day', () => {
  const { record } = mapServiceRow({ date: 'December 2026', organization: 'Salvation Army', details: 'Ring the Bell 5-7pm' }, ctx);
  assert.equal(record.is_all_day, true);
  assert.ok(record.event_name.startsWith('(Date TBD) '));
});

test('"Spring Break in Canyons" → Club Meeting, name unchanged', () => {
  const { record } = mapLunchRow({ date: '4/7/2027', program: 'Spring Break in Canyons' }, ctx);
  assert.equal(record.category, 'Club Meeting');
  assert.equal(record.event_name, 'Spring Break in Canyons');
});

test('date guard: "12/16", "9/11" and "9/11 project" alone parse as no time', () => {
  assert.equal(parseTimeFromText(['12/16']), null);
  assert.equal(parseTimeFromText(['9/11']), null);
  assert.equal(parseTimeFromText(['9/11 project']), null);
  assert.equal(parseTimeFromText(['Off for the 24th of July', '6990 S 300 E']), null);
});

test('parseTimeFromText recognises the written forms', () => {
  assert.deepEqual(parseTimeFromText(['6pm']), { start: '18:00' });
  assert.deepEqual(parseTimeFromText(['6 PM']), { start: '18:00' });
  assert.deepEqual(parseTimeFromText(['6:30 pm']), { start: '18:30' });
  assert.deepEqual(parseTimeFromText(['5:30-7:30pm']), { start: '17:30', end: '19:30' });
  assert.deepEqual(parseTimeFromText(['5:30 – 7:30 p.m.']), { start: '17:30', end: '19:30' });
  assert.deepEqual(parseTimeFromText(['11:30 to 1 pm']), { start: '11:30', end: '13:00' });
  assert.deepEqual(parseTimeFromText(['meet at 7:00']), { start: '07:00' });
  assert.deepEqual(parseTimeFromText(['meet at 6:30']), { start: '18:30' });
  assert.deepEqual(parseTimeFromText(['Dinner 6pm: bring a dish']), { start: '18:00' });
  assert.deepEqual(parseTimeFromText(['6pm/7pm']), { start: '18:00' });
  assert.equal(parseTimeFromText(['at the Capitol']), null);
  assert.equal(parseTimeFromText(['6 amazing volunteers']), null);
  assert.equal(parseTimeFromText(['until 12:05']), null);
  // Texts are checked in order: the program wins over the notes.
  assert.deepEqual(parseTimeFromText(['Initiation - 6 p.m.', 'doors at 5:30 pm']), { start: '18:00' });
});

test('"at" + a bare number, ordinals and counts are not times', () => {
  assert.equal(parseTimeFromText(['meet at 6']), null);
  assert.equal(parseTimeFromText(['Volunteer at 4th of July parade']), null);
  assert.equal(parseTimeFromText(['Book Blitz at 3 schools']), null);
  assert.equal(parseTimeFromText(['Social Meeting at 5 Guys']), null);
  assert.equal(parseTimeFromText(['meet at 9th and 9th']), null);
  assert.equal(parseTimeFromText(['Pick up at 7-11']), null);
  assert.deepEqual(parseTimeFromText(['Help at 4th of July parade at 9 am']), { start: '09:00' });
});

test('a date or room number before a dash is not a range start', () => {
  assert.deepEqual(parseTimeFromText(['Mobile Pantry Nov 7 - 6pm']), { start: '18:00' });
  assert.deepEqual(parseTimeFromText(['Ring the Bell Sat Dec 12 - 3pm']), { start: '15:00' });
  assert.deepEqual(parseTimeFromText(['Room 2 - 6pm']), { start: '18:00' });
  // A made-up 10-hour span is rejected, and its end isn't taken as the start either.
  assert.equal(parseTimeFromText(['8 - 6pm']), null);
});

test('noon and until/till/thru ranges; an unread range end is never the start', () => {
  assert.deepEqual(parseTimeFromText(['Mobile Pantry noon - 2pm']), { start: '12:00', end: '14:00' });
  assert.deepEqual(parseTimeFromText(['8 am to noon']), { start: '08:00', end: '12:00' });
  assert.deepEqual(parseTimeFromText(['4:30 until 6:30 pm']), { start: '16:30', end: '18:30' });
  assert.deepEqual(parseTimeFromText(['5:30 till 7:30 pm']), { start: '17:30', end: '19:30' });
  assert.deepEqual(parseTimeFromText(['5:30 thru 7:30 pm']), { start: '17:30', end: '19:30' });
  assert.equal(parseTimeFromText(['between 5 and 7 pm']), null);
  assert.equal(parseTimeFromText(['lunch served at noon']), null);
});

test('logistics notes without am/pm do not move the lunch meeting', () => {
  assert.equal(parseTimeFromText(['room available 12:05-1:30']), null);
  assert.equal(parseTimeFromText(['Board meeting 11:30-12:15']), null);
});

test('month-only dates on the lunch tab are all-day too', () => {
  const { record, dateTbd } = mapLunchRow({ date: 'November 2026', program: 'Holiday lunch 6 pm' }, ctx);
  assert.equal(dateTbd, true);
  assert.equal(record.is_all_day, true);
  assert.equal(slot(record), '12:15–13:30');
});

const lunchRow = (date, program = 'Business Meeting') => ({ date, program });

test('vanished row → Inactive and listed once; returning row → Active again', () => {
  const sheet = [lunchRow('10/7/2026', 'Mayor Zoltanski'), lunchRow('10/14/2026')];
  const db = mapPayload({ lunch: sheet }, ctx).mapped.map(({ record }, i) => ({ id: `r${i}`, ...record }));

  // Run 1: 10/14 disappears from the sheet.
  const run1 = planSync(mapPayload({ lunch: [sheet[0]] }, ctx).mapped, db, ctx, { tabs: ['lunch'] });
  assert.deepEqual(run1.deactivations, ['r1']);
  assert.deepEqual(run1.orphaned.map((o) => o.id), ['r1']);
  assert.equal(run1.unchanged, 1);

  // Run 2: still missing, already Inactive → not listed again.
  const db2 = db.map((r) => (r.id === 'r1' ? { ...r, status: 'Inactive' } : r));
  const run2 = planSync(mapPayload({ lunch: [sheet[0]] }, ctx).mapped, db2, ctx, { tabs: ['lunch'] });
  assert.deepEqual(run2.deactivations, []);
  assert.deepEqual(run2.orphaned, []);

  // Run 3: it comes back → matched and set Active again, nothing inserted.
  const run3 = planSync(mapPayload({ lunch: sheet }, ctx).mapped, db2, ctx, { tabs: ['lunch'] });
  assert.equal(run3.inserts.length, 0);
  assert.equal(run3.updates.length, 1);
  assert.equal(run3.updates[0].id, 'r1');
  assert.deepEqual(run3.updates[0].changes, { status: 'Active' });
});

test('hidden rows are ignored by the duplicate check', () => {
  const rows = [synced({ id: 'a' }), synced({ id: 'b', status: 'Inactive' })];
  assert.deepEqual(findPossibleDuplicates(rows, 'America/Denver'), []);
});

test('an Active and a hidden lunch row on one date: the Active one is matched, nothing held', () => {
  const { mapped } = mapPayload({ lunch: [{ date: '8/5/2026', program: 'Business Meeting', location_caterer: 'Catering by Bryce' }] }, ctx);
  const plan = planSync(mapped, [synced({ id: 'old', status: 'Inactive' }), synced({ id: 'live' })], ctx);
  assert.equal(plan.unchanged, 1);
  assert.deepEqual(plan.deactivations, []);
  assert.deepEqual(plan.orphaned, []);
});

test('a tab missing from the payload is never hidden', () => {
  const svc = mapServiceRow({ date: '10/10/2026', organization: 'Utah Food Bank', details: 'Mobile Pantry' }, ctx).record;
  const plan = planSync([], [{ id: 's1', ...svc }], ctx, { tabs: ['lunch'] });
  assert.deepEqual(plan.deactivations, []);
});

test('a bad sheet read (most rows missing) changes nothing on that tab and warns', () => {
  const dates = ['10/7/2026', '10/14/2026', '10/21/2026', '11/4/2026', '11/11/2026', '11/18/2026', '12/2/2026'];
  const db = dates.map((d, i) => ({ id: `m${i}`, ...mapLunchRow(lunchRow(d), ctx).record }));
  const plan = planSync([], db, ctx, { tabs: ['lunch'] });
  assert.deepEqual(plan.deactivations, []);
  assert.deepEqual(plan.orphaned, []);
  assert.equal(plan.warnings.length, 1);
  assert.match(plan.warnings[0], /lunch tab: 7 of 7 active rows are missing/);
  // allow_bulk_hide applies it anyway.
  assert.equal(planSync([], db, ctx, { tabs: ['lunch'], allowBulkHide: true }).deactivations.length, 7);
});

test('bad read that changes keys (details column lost): no inserts, no hides, so nothing is left duplicated', () => {
  const orgs = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const good = orgs.map((o) => ({ date: '10/10/2026', organization: o, details: 'Project' }));
  const db = mapPayload({ service: good }, ctx).mapped.map(({ record }, i) => ({ id: `s${i}`, ...record }));
  const bad = orgs.map((o) => ({ date: '10/10/2026', organization: o })); // details missing → new names
  const plan = planSync(mapPayload({ service: bad }, ctx).mapped, db, ctx, { tabs: ['service'] });
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.updates.length, 0);
  assert.deepEqual(plan.deactivations, []);
  assert.equal(plan.warnings.length, 1);
  // The next good read is a clean no-op.
  const next = planSync(mapPayload({ service: good }, ctx).mapped, db, ctx, { tabs: ['service'] });
  assert.equal(next.unchanged, 8);
  assert.equal(next.inserts.length + next.updates.length + next.deactivations.length, 0);
});
