# schedule-sync — board schedule → `calendar_events`

The board plans the club year in a spreadsheet owned by Susan Edwards (tabs `lunch + speaker` and `Service Dates`). That spreadsheet is the source of truth for **what is scheduled**. n8n reads it hourly and POSTs the rows to this Netlify function, which maps them and upserts them into `p0012_rotary.calendar_events`.

The sync is **one-way** (spreadsheet → Supabase) and **never deletes**.

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
- Row keys are normalized (trimmed, lowercased, inner spaces → `_`).
- n8n strips the title row (row 1) and header row (row 2); data starts at row 3 on both tabs.

Response `200`:

```json
{ "inserted": 0, "updated": 0, "unchanged": 0,
  "skipped": [ { "tab": "lunch", "row": {}, "reason": "unparseable date" } ],
  "possible_duplicates": [ { "date": "2026-08-05", "category": "Club Meeting", "ids": ["…"] } ],
  "orphaned": [ { "id": "…", "date": "2026-08-05", "event_name": "…" } ],
  "dry_run": true }
```

`401` bad/missing secret · `400` malformed body (with message) · `405` non-POST · `500` misconfiguration or DB error (message, never secrets).

With `dry_run: true` everything runs except the writes; the counts show what *would* happen (possible-duplicate ids for would-be inserts show as `(new)`).

## Common rules

- `status = 'Active'`, `sync_source = 'google-sheet'` on every row.
- Rows dated before **2026-07-01** are skipped (`before sync window`).
- Blank means `""`, `"-"` or `"n/a"` (case-insensitive, trimmed). Fully blank rows are skipped (`empty row`).
- Dates: `M/D/YYYY`, `M/D/YY` (→ 20YY), Excel serial 40000–60000 (days since 1899-12-30), ISO `YYYY-MM-DD`, or `Month YYYY` (→ the 1st, flagged Date TBD). Anything else → `unparseable date`.
- Times are stored as the **real instant** in America/Denver (DST-aware): 12:15 MDT → `18:15Z`, 12:15 MST → `19:15Z`.
- `enable_rsvp = false` and `speaker_name = NULL` on insert only.

## Lunch tab (first match wins)

| Program text (trimmed) | `event_name` | `category` | Other fields |
|---|---|---|---|
| blank | `Weekly Club Meeting` | Club Meeting | — |
| matches `/^off\b/i` | `No Meeting — <program>` | **No Meeting** | no caterer, no venue |
| starts with `Social Meeting` | program text | Club Meeting | `venue_name` = location_caterer |
| equals `Business Meeting` | `Business Meeting` | Club Meeting | `caterer` = location_caterer |
| contains a `SPECIAL_EVENTS` keyword | program text | Club Event | `venue_name` = location_caterer |
| anything else (speaker line) | `Weekly Club Meeting` | Club Meeting | `speaker_topic` = full program text; `caterer` = location_caterer |

`SPECIAL_EVENTS`: Christmas Party, Initiation, Rotary Day at the Legislature, Tour of the Utah Museum, Spring Break.

- Times: `meeting_time` from club_settings (12:15–13:30).
- `is_board_meeting` = board_meeting cell is `x` (case-insensitive). Any other text is a note.
- `description` = non-blank parts joined with ` · `: `Speaker arranged by: <host_member>`, `<notes>`, board_meeting text (if not blank and not `x`).
- Speaker text is stored **whole** in `speaker_topic`; it is never split into name/topic (the sheet is inconsistent: "Wade Williams - nuclear energy" vs "CPR training - Jen Gerrard").

## Service tab

- `event_name` = `<organization> — <details>` (or `<organization>` alone); prefix `(Date TBD) ` for `Month YYYY` dates. Blank organization → skipped (`missing organization`).
- `category` = `Club FundRaiser` if `/fundraiser|silent auction/i` matches organization or details, else `Club Service Project`.
- `venue_name` = location; `description` = details.
- Times: 12:00–13:00 Denver.

## Matching and field ownership

- Only rows with `sync_source = 'google-sheet'` dated on/after 2026-07-01 are ever read, updated, or reported. Manual rows (`sync_source` NULL) are never touched.
- Match key: (Denver calendar date of `start_date`, `category`, `event_name`). No DB unique index — matching is done in code. Two payload rows with the same key → the second is skipped (`duplicate in payload`).
- **Sync-owned fields** (updated on match): `event_name, category, status, description, speaker_topic, caterer, venue_name, is_board_meeting, start_date, end_date`. No differences → counted `unchanged`.
- **App-owned, never touched by the sync:** `id, speaker_name, speaker_bio, enable_rsvp` (set false on insert only), `created_by, google_calendar_id`, and all RSVP/attendance/role tables.
- Because `event_name` is part of the key, renaming a row in the sheet (e.g. adding a program to a blank week, which changes `Weekly Club Meeting` → `Business Meeting`) inserts a new row and reports the old one as `orphaned`. A leader decides what to do with orphans; the sync never deletes.
- `possible_duplicates`: same Denver date + same category with 2+ synced rows.

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
