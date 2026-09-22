import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  SYNC_SOURCE,
  SYNC_WINDOW_START,
  SYNC_OWNED_FIELDS,
  buildContext,
  zonedTimeToIso,
  mapPayload,
  planSync,
  findPossibleDuplicates,
} from './_schedule-mapping.mjs';

/**
 * POST /.netlify/functions/schedule-sync
 * Called hourly by n8n with the board's schedule spreadsheet rows.
 * One-way: spreadsheet → p0012_rotary.calendar_events. Never deletes.
 * See docs/schedule-sync.md.
 */

const SCHEMA = 'p0012_rotary';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function secretMatches(provided, expected) {
  // Hash both sides so lengths match and the compare is constant-time.
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function loadContext(supabase) {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('club_settings')
    .select('key, value')
    .in('key', ['meeting_time', 'meeting_timezone']);
  if (error) {
    console.warn('schedule-sync: club_settings unavailable, using fallback meeting time');
    return buildContext();
  }
  const settings = Object.fromEntries((data || []).map((s) => [s.key, s.value]));
  return buildContext({ meetingTime: settings.meeting_time, meetingTimezone: settings.meeting_timezone });
}

function validateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Body must be a JSON object';
  const hasLunch = body.lunch !== undefined;
  const hasService = body.service !== undefined;
  if (!hasLunch && !hasService) return 'Body must include a "lunch" and/or "service" array';
  if (hasLunch && !Array.isArray(body.lunch)) return '"lunch" must be an array';
  if (hasService && !Array.isArray(body.service)) return '"service" must be an array';
  const rows = [...(body.lunch || []), ...(body.service || [])];
  if (rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) return 'Every row must be an object';
  if (body.dry_run !== undefined && typeof body.dry_run !== 'boolean') return '"dry_run" must be a boolean';
  return null;
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // 1. Auth — checked before anything else so a missing header is always 401.
  const authHeader = req.headers.get('authorization') || '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!provided) return json(401, { error: 'Unauthorized' });

  const expected = process.env.SCHEDULE_SYNC_SECRET;
  if (!expected) return json(500, { error: 'SCHEDULE_SYNC_SECRET is not configured' });
  if (!secretMatches(provided, expected)) return json(401, { error: 'Unauthorized' });

  // 2. Body
  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Body must be valid JSON' });
  }
  const bodyError = validateBody(body);
  if (bodyError) return json(400, { error: bodyError });
  const dryRun = body.dry_run === true;

  const supabase = createSupabaseAdmin();
  if (!supabase) {
    return json(500, { error: 'Server misconfigured: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set' });
  }

  try {
    // 3. Map
    const ctx = await loadContext(supabase);
    const { mapped, skipped } = mapPayload({ lunch: body.lunch || [], service: body.service || [] }, ctx);

    // 4. Match — only synced rows inside the window are ever read.
    const windowStart = zonedTimeToIso(
      { y: Number(SYNC_WINDOW_START.slice(0, 4)), m: Number(SYNC_WINDOW_START.slice(5, 7)), d: Number(SYNC_WINDOW_START.slice(8, 10)) },
      { h: 0, m: 0 },
      ctx.timeZone,
    );
    const { data: existing, error: existingError } = await supabase
      .schema(SCHEMA)
      .from('calendar_events')
      .select(['id', 'sync_source', ...SYNC_OWNED_FIELDS].join(', '))
      .eq('sync_source', SYNC_SOURCE)
      .gte('start_date', windowStart);
    if (existingError) throw new Error(`Failed to read calendar_events: ${existingError.message}`);

    const plan = planSync(mapped, existing, ctx);
    let finalRows = plan.finalRows;

    // 5. Write (batched per tab)
    if (!dryRun) {
      const now = new Date().toISOString();
      const insertedRows = [];
      for (const tab of ['lunch', 'service']) {
        const inserts = plan.inserts
          .filter((i) => i.tab === tab)
          .map(({ record }) => ({ ...record, enable_rsvp: false, speaker_name: null }));
        if (inserts.length) {
          const { data, error } = await supabase
            .schema(SCHEMA)
            .from('calendar_events')
            .insert(inserts)
            .select(['id', ...SYNC_OWNED_FIELDS].join(', '));
          if (error) throw new Error(`Insert failed (${tab}): ${error.message}`);
          insertedRows.push(...(data || []));
        }

        // Every update row carries the same columns (all sync-owned fields),
        // so the batch upsert never nulls a column that one row omitted.
        const updates = plan.updates
          .filter((u) => u.tab === tab)
          .map(({ id, record }) => {
            const row = { id, sync_source: SYNC_SOURCE, updated_at: now };
            for (const field of SYNC_OWNED_FIELDS) row[field] = record[field];
            return row;
          });
        if (updates.length) {
          const { error } = await supabase
            .schema(SCHEMA)
            .from('calendar_events')
            .upsert(updates, { onConflict: 'id' });
          if (error) throw new Error(`Update failed (${tab}): ${error.message}`);
        }
      }
      finalRows = [...finalRows.filter((r) => r.id !== null), ...insertedRows];
    }

    const report = {
      inserted: plan.inserts.length,
      updated: plan.updates.length,
      unchanged: plan.unchanged,
      skipped,
      possible_duplicates: findPossibleDuplicates(finalRows, ctx.timeZone),
      orphaned: plan.orphaned,
      dry_run: dryRun,
    };

    console.log(
      `schedule-sync${dryRun ? ' (dry run)' : ''}: inserted=${report.inserted} updated=${report.updated} ` +
      `unchanged=${report.unchanged} skipped=${skipped.length} orphaned=${plan.orphaned.length} ` +
      `possible_duplicates=${report.possible_duplicates.length}`,
    );
    return json(200, report);
  } catch (err) {
    console.error('schedule-sync error:', err.message);
    return json(500, { error: 'Sync failed', detail: err.message });
  }
};
