import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client using the service_role key.
 * Bypasses RLS — only use server-side in Netlify functions.
 */
export function createSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Validates that the request comes from an authenticated admin user.
 * Returns the member object if valid, or null if not.
 *
 * Auth lookup mirrors AuthContext.tsx: try by user.id first,
 * then fall back to home_email.
 */
export async function validateAdminSession(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');
  const supabase = createSupabaseAdmin();

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  // Try by id first (matches AuthContext pattern)
  let { data: member } = await supabase
    .from('0012-sr-members')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  // Fallback: by home_email
  if (!member && user.email) {
    ({ data: member } = await supabase
      .from('0012-sr-members')
      .select('*')
      .eq('home_email', user.email)
      .maybeSingle());
  }

  if (!member || member.role !== 'admin') return null;
  return member;
}

/**
 * Loads a GHL access token for a location, auto-refreshing if it
 * expires within the next 5 minutes.
 */
export async function getGHLToken(locationId) {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .schema('p0012_rotary')
    .from('ghl_tokens')
    .select('*')
    .eq('location_id', locationId)
    .single();

  if (error || !data) {
    throw new Error(`No GHL token found for location ${locationId}`);
  }

  const expiresAt = new Date(data.expires_at);
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt < fiveMinFromNow) {
    return await refreshGHLToken(locationId);
  }

  return data.access_token;
}

/**
 * Refreshes GHL tokens using the stored refresh_token and updates
 * the Supabase row with new tokens.
 */
export async function refreshGHLToken(locationId) {
  const supabase = createSupabaseAdmin();

  const { data: tokenRow, error: fetchError } = await supabase
    .schema('p0012_rotary')
    .from('ghl_tokens')
    .select('refresh_token')
    .eq('location_id', locationId)
    .single();

  if (fetchError || !tokenRow) {
    throw new Error(`Cannot refresh: no token row for location ${locationId}`);
  }

  const body = new URLSearchParams({
    client_id: process.env.GHL_CLIENT_ID,
    client_secret: process.env.GHL_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: tokenRow.refresh_token,
  });

  const response = await fetch('https://services.leadconnectorhq.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GHL token refresh failed (${response.status}): ${text}`);
  }

  const tokens = await response.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error: updateError } = await supabase
    .schema('p0012_rotary')
    .from('ghl_tokens')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('location_id', locationId);

  if (updateError) {
    throw new Error(`Failed to save refreshed tokens: ${updateError.message}`);
  }

  return tokens.access_token;
}

/**
 * Makes an authenticated request to the GHL API.
 */
export async function makeGHLRequest(endpoint, method, body, locationId) {
  const accessToken = await getGHLToken(locationId);

  const url = `https://services.leadconnectorhq.com${endpoint}`;
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  // Log rate limit warnings
  const remainingDay = response.headers.get('X-RateLimit-Remaining-Day');
  if (remainingDay !== null && parseInt(remainingDay, 10) < 1000) {
    console.warn(`[GHL Rate Limit] Remaining/day: ${remainingDay}`);
  }
  const remainingSec = response.headers.get('X-RateLimit-Remaining-Second');
  if (remainingSec !== null) {
    console.log(`[GHL Rate Limit] Remaining/sec: ${remainingSec}`);
  }

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`GHL API error (${response.status}): ${text}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}
