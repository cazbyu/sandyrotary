import { createSupabaseAdmin, makeGHLRequest, refreshGHLToken } from './_ghl-client.mjs';

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
    // 1. Validate Supabase session
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

    // 2. Parse request body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }

    const {
      endpoint,
      method = 'GET',
      body: requestBody,
      locationId = process.env.GHL_DEFAULT_LOCATION_ID,
    } = body;

    if (!endpoint) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing endpoint parameter' }),
      };
    }

    // 3. Call GHL API with auto-retry on 401
    try {
      const data = await makeGHLRequest(endpoint, method, requestBody, locationId);
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      };
    } catch (err) {
      if (err.status === 401) {
        // Attempt one token refresh and retry
        try {
          await refreshGHLToken(locationId);
          const data = await makeGHLRequest(endpoint, method, requestBody, locationId);
          return {
            statusCode: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          };
        } catch (retryErr) {
          console.error('GHL retry after refresh failed:', retryErr);
          return {
            statusCode: 401,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'GHL authorization expired', code: 'GHL_AUTH_EXPIRED' }),
          };
        }
      }
      throw err;
    }
  } catch (err) {
    console.error('ghl-proxy error:', err);
    return {
      statusCode: err.status || 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
}
