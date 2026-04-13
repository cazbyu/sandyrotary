import { createSupabaseAdmin, validateAdminSession } from './_ghl-client.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export default async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    // 1. Validate admin session
    const member = await validateAdminSession(event.headers.authorization || event.headers.Authorization);
    if (!member) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Admin access required' }),
      };
    }

    // 2. Query ghl_tokens
    const supabase = createSupabaseAdmin();
    const { data: token, error } = await supabase
      .schema('p0012_rotary')
      .from('ghl_tokens')
      .select('location_id, expires_at, created_at')
      .limit(1)
      .maybeSingle();

    if (error || !token) {
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connected: false,
          locationId: null,
          expiresAt: null,
          isExpired: false,
        }),
      };
    }

    const isExpired = new Date(token.expires_at) < new Date();

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connected: true,
        locationId: token.location_id,
        expiresAt: token.expires_at,
        isExpired,
      }),
    };
  } catch (err) {
    console.error('ghl-status error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
