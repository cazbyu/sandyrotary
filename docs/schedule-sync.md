# schedule-sync — board schedule → `calendar_events`

The board plans the club year in a spreadsheet owned by Susan Edwards (tabs `lunch + speaker` and `Service Dates`). That spreadsheet is the source of truth for **what is scheduled**. n8n reads it hourly and POSTs the rows to this Netlify function, which maps them and upserts them into `p0012_rotary.calendar_events`.

The sync is **one-way** (spreadsheet → Supabase) and **never deletes**. Rows that vanish from the sheet are hidden (`status = 'Inactive'`) and come back automatically if the sheet restores them.

Code: `netlify/functions/schedule-sync.mjs` (HTTP + DB) and `netlify/functions/_schedule-mapping.mjs` (pure mapping/matching). Tests: `npm test`.

## Environment

| Var | Notes |
|---|---|
| `SCHEDULE_SYNC_SECRET` | Shared secret; n8n sends `Authorization: Bearer <secret>` |
| `SUPABASE_URL` | Falls back to `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only |

Meeting times come from `club_settings` (`meeting_time`, e.g. `Wednesday, 12:15pm - 1:30pm`, and `meeting_timezone`), read once per request. Fallback: 12:15–13:30 America/Denver.

## Contract

`POST /.netlify/functions/schedule-sync`
Headers: `Authorization: Bearer <SCHEDULE_SYNC_SECRET>`, `Content-Type: application/json`

```json
{
  "source": "google-sheet",
  "lunch":   [ { "date": "8/5/2026", "program": "Wade Williams - nuclear energy", "host_member": "Susan/Paul/Charisse", "location_caterer": "Catering by Bryce", "notes": "", "board_meeting": "x" } ],
  "service": [ { "date": "September 2026", "organization": "Utah Food Bank", "location": "East Midvale Elementary 6990 S 300 E", "details": "Mobile Pantry" } ],
  "dry_run": true
}
```

- `source` is a label only (n8n actually reads an Excel file).
- Optional `"allow_bulk_hide": true` skips the bad-read guard for one run (see *Hidden rows*).
- Row keys are normalized (trimmed, lowercased, inner spaces → `_`).
- n8n strips the title row (row 1) and header row (row 2); data starts at row 3 on both tabs.

Response `200`:

```json
{ "inserted": 0, "updated": 0, "unchanged": 0,
  "skipped": [ { "tab": "lunch", "row": {}, "reason": "unparseable date" } ],
  "possible_duplicates": [ { "date": "2026-08-05", "tab": "lunch", "categories": ["Club Meeting", "No Meeting"], "ids": ["…"] } ],
  "orphaned": [ { "id": "…", "date": "2026-08-05", "event_name": "…" } ],
  "warnings": [],
  "dry_run": true }
```

- `orphaned` lists rows **newly hidden in this run** (they vanished from the sheet). A row that stays missing is not listed again, so each disappearance is reported once.
- `warnings` explains anything the sync refused to do, e.g. a run that would hide most of a tab (see *Hidden rows*).

`401` bad/missing secret · `400` malformed body (with message) · `405` non-POST · `500` misconfiguration or DB error (message, never secrets).

With `dry_run: true` everything runs except the writes; the counts show what *would* happen (possible-duplicate ids for would-be inserts show as `(new)`).

## Common rules

- `status = 'Active'`, `sync_source = 'google-sheet'` on every row written from the sheet (hidden rows are `Inactive`).
- Rows dated before **2026-07-01** are skipped (`before sync window`).
- Blank means `""`, `"-"` or `"n/a"` (case-insensitive, trimmed). Fully blank rows are skipped (`empty row`).
- Dates: `M/D/YYYY`, `M/D/YY` (→ 20YY), Excel serial 40000–60000 (days since 1899-12-30), ISO `YYYY-MM-DD`, or `Month YYYY` (→ the 1st, flagged Date TBD). Anything else → `unparseable date`.
- Times are stored as the **real instant** in America/Denver (DST-aware): 12:15 MDT → `18:15Z`, 12:15 MST → `19:15Z`.
- `enable_rsvp = false` and `speaker_name = NULL` on insert only.

## Times written in the sheet text

`parseTimeFromText` reads the first time written in the row's text (lunch: program, notes, board-column note; service: details, location).

- Recognised: `6 p.m.`, `6pm`, `6 PM`, `6:30 pm`, `at 10:30`, and ranges joined by `to`, `until`, `till`, `thru`, `-`, `–`, `—`: `5:30 to 7:30 pm`, `5:30-7:30pm`, `5:30 – 7:30 p.m.`, `noon - 2pm`, `8 am to noon`. One am/pm at the end applies to both ends (`11:30 to 1 pm` is 11:30–13:00).
- A range needs am/pm (or `noon`) on at least one end. A lone time needs am/pm, or `at` plus a colon time (`at 10:30`). So these are **not** times: `until 12:05` (8/5 note), `room available 12:05-1:30`, `at 3 schools`, `at 4th of July`, `lunch served at noon`.
- Dates (`9/11`, `12/16`), street numbers (`6990 S 300 E`) and ordinals (`4th`, `9th`) never match. A bare number right after a month, weekday or "room" (`Nov 7 - 6pm`) is not a range start, so only `6pm` is read.
- If a range can't be read, its end is never used as a start (`between 5 and 7 pm` → no time, default slot).
- No am/pm: 7–11 → morning, 12 → noon, 1–6 → afternoon/evening; anything else is ignored. Starts before 06:00 or from 22:00 on are ignored.
- Duration: a range is used as written. A single time runs to the meeting end (13:30) if it starts earlier, otherwise for 2 hours (`Initiation - 6 p.m.` → 18:00–20:00; tour note `at 10:30` → 10:30–13:30).
- Month-only dates (either tab) are all-day and ignore written times.

## Lunch tab (first match wins)

| Program text (trimmed) | `event_name` | `category` | Other fields |
|---|---|---|---|
| blank | `Weekly Club Meeting` | Club Meeting | — |
| matches `/^off\b/i` | `No Meeting — <program>` | **No Meeting** | no caterer, no venue |
| starts with `Social Meeting` | program text | **Club Event** (special event; the app detects socials by `event_name`) | `venue_name` = location_caterer |
| equals `Business Meeting` | `Business Meeting` | Club Meeting | `caterer` = location_caterer |
| contains a `SPECIAL_EVENTS` keyword | program text | Club Event | `venue_name` = location_caterer |
| anything else (speaker line) | program text (trimmed) | Club Meeting | `speaker_topic` = full program text; `caterer` = location_caterer |

`SPECIAL_EVENTS`: Christmas Party, Initiation, Rotary Day at the Legislature, Tour of the Utah Museum. ("Spring Break in Canyons" is a regular meeting at another location, so it is a Club Meeting.)

- Times: `meeting_time` from club_settings (12:15–13:30), unless the text gives a time (above). `is_all_day = false`.
- `is_board_meeting` = board_meeting cell is `x` (case-insensitive). Any other text is a note.
- `description` = non-blank parts joined with ` · `: `<notes>`, board_meeting text (if not blank and not `x`). `host_member` is not synced (it's internal to the board).
- Speaker text is the event title, so Club Events and My Attendance Plans both show the speaker (both display `event_name`). `speaker_name` stays NULL.
- Speaker text is stored **whole** in `event_name` and `speaker_topic`; it is never split into name/topic (the sheet is inconsistent: "Wade Williams - nuclear energy" vs "CPR training - Jen Gerrard").

## Service tab

- `event_name` = `<organization> — <details>` (or `<organization>` alone); prefix `(Date TBD) ` for `Month YYYY` dates **and for any date on the 1st of the month** (`SERVICE_FIRST_OF_MONTH_IS_TBD`: the .xlsx stores "November 2026" as 11/1 and n8n only sees the serial, so the display text is lost). Lunch tab is unaffected. Blank organization → skipped (`missing organization`).
- `category` = `Club FundRaiser` if `/fundraiser|silent auction/i` matches organization or details, else `Club Service Project`.
- `venue_name` = location; `description` = details.
- Times: a time written in details or location sets start/end and `is_all_day = false`. Otherwise the project is **all-day** (`is_all_day = true`), stored 12:00–13:00 Denver so the date never shifts. `(Date TBD)` rows are always all-day. The app shows "All day".

## Matching and field ownership

- Only rows with `sync_source = 'google-sheet'` dated on/after 2026-07-01 are ever read, updated, or reported. Manual rows (`sync_source` NULL) are never touched.
- **Lunch-tab match key: Denver calendar date** of `start_date` alone, against synced lunch-type rows (any category except `Club Service Project` / `Club FundRaiser`). There is one lunch row per Wednesday, so renames and category changes (blank → speaker, speaker → different speaker, meeting → No Meeting) update the row in place.
- If 2+ **Active** synced lunch-type rows exist on one date, none of them is updated or hidden, the incoming row for that date is not written, and the group is reported in `possible_duplicates`.
- **Service-tab match key:** (Denver date, `category`, `event_name`), because several projects can share a date.
- No DB unique index — matching is done in code. Two payload rows with the same (date, category, event_name) → the second is skipped (`duplicate in payload`).
- **Sync-owned fields** (updated on match): `event_name, category, status, description, speaker_topic, caterer, venue_name, is_board_meeting, is_all_day, start_date, end_date`. No differences → counted `unchanged`.
- **App-owned, never touched by the sync:** `id, speaker_name, speaker_bio, enable_rsvp` (set false on insert only), `created_by, google_calendar_id`, and all RSVP/attendance/role tables.
- `possible_duplicates`: 2+ **Active** synced **lunch-tab** rows on the same Denver date, any category (one lunch event per date is the real rule). Service-tab rows are never flagged — several projects often share a month-only placeholder date. Hidden rows don't count. DB rows are assigned a tab by category (`Club Service Project` / `Club FundRaiser` = service; everything else = lunch).

## Hidden rows (vanished from the sheet)

- An **Active** synced row (on/after 2026-07-01, past rows included) that is no longer matched by the payload is set `status = 'Inactive'` — never deleted — and listed in `orphaned` in that run only. A sheet row the sync skips (unparseable date, missing organization) can't be matched, so its DB row is hidden too.
- Matching includes Inactive synced rows, so a row that returns to the sheet is matched, updated and set `Active` again (counted `updated`). When a key has both an Active and a hidden row, the Active one is matched.
- A lunch row is hidden when its **date** leaves the lunch tab. A service row is keyed by (date, category, name), so renaming it in the sheet inserts the new name and hides the old one.
- Safety (bad-read guard):
  - Only tabs present in the body are checked (a body with only `lunch` never hides service rows).
  - If a run would hide more than 5 rows of one tab **and** more than a fifth of that tab's active rows, that tab is **frozen for the run**: no inserts, updates or hides on it, and a `warnings` entry explains why. That pattern usually means a bad sheet read (truncated tab, renamed column); freezing everything means a bad read can't leave duplicates behind, and the next good read is a clean no-op.
  - For an intended bulk change (e.g. many service rows renamed at once, or a clean-up of past rows), run once with `"allow_bulk_hide": true` in the body.
  - n8n should alert on a non-empty `warnings` array, since the warning repeats every run until someone acts.
- The app only shows `status = 'Active'` rows (Calendar, My Attendance Plans, admin Attendance).

## Carry-forward

- **Deploy order for v2.4:** apply `supabase/migrations/20260923020000_calendar_events_is_all_day.sql` **before** deploying the function. The function selects `is_all_day`; without the column every run returns 500 (nothing is written, it recovers once the column exists).
- The Calendar lists events with `start_date >=` today's **UTC** date, so after 6 pm Denver time (5 pm in winter) an event still running today drops off the list. Pre-existing; now slightly more visible because v2.4 stores evening times. Fix: filter on the local start of today, or on `end_date >= now`.
- **`service_role` needs `USAGE` on schema `p0012_rotary`.** It was missing until 2026-09-23 (schedule-sync failed with "permission denied for schema p0012_rotary"); applied live and recorded in `supabase/migrations/20260923010000_p0012_grant_schema_usage_service_role.sql`. This missing grant is a likely cause of the GHL functions failing too — re-test them.

## Try it (dry run)

```bash
curl -s -X POST "https://<site>/.netlify/functions/schedule-sync" \
  -H "Authorization: Bearer $SCHEDULE_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"source":"google-sheet","dry_run":true,
       "lunch":[{"date":"8/5/2026","program":"Wade Williams - nuclear energy","host_member":"Susan/Paul/Charisse","location_caterer":"Catering by Bryce","notes":"","board_meeting":"x"},
                {"date":"7/1/26","program":"Off for 4th"}],
       "service":[{"date":"September 2026","organization":"Utah Food Bank","location":"East Midvale Elementary 6990 S 300 E","details":"Mobile Pantry"}]}'
```
