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

test('"Wade Williams - nuclear energy" → weekly meeting, whole text in speaker_topic', () => {
  const { record } = lunch('Wade Williams - nuclear energy');
  assert.equal(record.event_name, 'Weekly Club Meeting');
  assert.equal(record.category, 'Club Meeting');
  assert.equal(record.speaker_topic, 'Wade Williams - nuclear energy');
  assert.equal(record.caterer, 'Catering by Bryce');
  assert.equal('speaker_name' in record, false, 'sync never sets speaker_name on the mapped record');
});

test('"CPR training - Jen Gerrard" → same pattern, no split', () => {
  const { record } = lunch('CPR training - Jen Gerrard');
  assert.equal(record.event_name, 'Weekly Club Meeting');
  assert.equal(record.speaker_topic, 'CPR training - Jen Gerrard');
});

test('"Social Meeting at Simply Thai" → Club Meeting at venue', () => {
  const { record } = lunch('Social Meeting at Simply Thai', { location_caterer: 'Simply Thai' });
  assert.equal(record.event_name, 'Social Meeting at Simply Thai');
  assert.equal(record.category, 'Club Meeting');
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
  assert.equal(record.description, `Speaker arranged by: Susan/Paul/Charisse · Bring badges · ${note}`);
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

test('payload duplicates are skipped', () => {
  const row = { date: '8/5/2026', program: 'Business Meeting' };
  const { mapped, skipped } = mapPayload({ lunch: [row, row] }, ctx);
  assert.equal(mapped.length, 1);
  assert.equal(skipped[0].reason, 'duplicate in payload');
});

test('possible duplicates: 2+ synced rows same date + category', () => {
  const dupes = findPossibleDuplicates([
    synced({ id: 'a' }),
    synced({ id: 'b', event_name: 'Weekly Club Meeting' }),
    synced({ id: 'c', category: 'No Meeting' }),
  ], 'America/Denver');
  assert.deepEqual(dupes, [{ date: '2026-08-05', category: 'Club Meeting', ids: ['a', 'b'] }]);
});

test('zonedTimeToIso handles the DST switch day', () => {
  assert.equal(zonedTimeToIso({ y: 2026, m: 11, d: 1 }, { h: 12, m: 0 }, 'America/Denver'), '2026-11-01T19:00:00.000Z');
  assert.equal(zonedTimeToIso({ y: 2026, m: 3, d: 8 }, { h: 12, m: 0 }, 'America/Denver'), '2026-03-08T18:00:00.000Z');
});
