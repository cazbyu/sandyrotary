import crypto from 'crypto';
import { createSupabaseAdmin } from './_ghl-client.mjs';

function base64url(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

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

    // 2. Generate PKCE values
    const codeVerifier = base64url(crypto.randomBytes(64));
    const codeChallenge = base64url(
      crypto.createHash('sha256').update(codeVerifier).digest()
    );

    // 3. Generate state
    const state = crypto.randomUUID();

    // 4. Store state + code_verifier; clean up expired rows
    await supabase
      .schema('p0012_rotary')
      .from('oauth_state')
      .delete()
      .lt('expires_at', new Date().toISOString());

    const { error: insertError } = await supabase
      .schema('p0012_rotary')
      .from('oauth_state')
      .insert({ state, code_verifier: codeVerifier });

    if (insertError) {
      throw new Error(`Failed to store OAuth state: ${insertError.message}`);
    }

    // 5. Build authorization URL
    const scopes = [
      'contacts.readonly', 'contacts.write',
      'conversations.readonly', 'conversations.write',
      'forms.readonly', 'forms.write',
      'calendars.readonly', 'calendars.write',
      'opportunities.readonly',
      'invoices.readonly', 'invoices.write',
      'blogs/posts.readonly', 'blogs/posts.write',
      'social-media-posting.readonly', 'social-media-posting.write',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: process.env.GHL_CLIENT_ID,
      redirect_uri: process.env.GHL_REDIRECT_URI,
      response_type: 'code',
      scope: scopes,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?${params.toString()}`;

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ authUrl }),
    };
  } catch (err) {
    console.error('ghl-auth-init error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
