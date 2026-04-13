import { createSupabaseAdmin } from './_ghl-client.mjs';

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
    // 1. Validate Supabase session and admin status
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing authorization token' }),
      };
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseAdmin();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Invalid session' }),
      };
    }

    // Check admin status
    const { data: member, error: memberError } = await supabase
      .schema('p0012_rotary')
      .from('members')
      .select('is_admin')
      .eq('email', user.email)
      .single();

    if (memberError || !member?.is_admin) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Admin access required' }),
      };
    }

    // 2. Query ghl_tokens
    const { data: tokens, error: tokensError } = await supabase
      .schema('p0012_rotary')
      .from('ghl_tokens')
      .select('location_id, expires_at, created_at')
      .limit(1)
      .single();

    if (tokensError || !tokens) {
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

    const isExpired = new Date(tokens.expires_at) < new Date();

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connected: true,
        locationId: tokens.location_id,
        expiresAt: tokens.expires_at,
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
