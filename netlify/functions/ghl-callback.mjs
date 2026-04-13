import { createSupabaseAdmin } from './_ghl-client.mjs';

function redirect(path) {
  return {
    statusCode: 302,
    headers: { Location: path },
    body: '',
  };
}

export default async function handler(event) {
  try {
    const params = event.queryStringParameters || {};

    // 1. Check for error from GHL
    if (params.error) {
      return redirect(`/settings?ghl=error&reason=${encodeURIComponent(params.error)}`);
    }

    const { code, state } = params;
    if (!code || !state) {
      return redirect('/settings?ghl=error&reason=missing_params');
    }

    const supabase = createSupabaseAdmin();

    // 2. Look up state
    const { data: stateRow, error: stateError } = await supabase
      .schema('p0012_rotary')
      .from('oauth_state')
      .select('*')
      .eq('state', state)
      .single();

    if (stateError || !stateRow) {
      return redirect('/settings?ghl=error&reason=invalid_state');
    }

    // Check expiry
    if (new Date(stateRow.expires_at) < new Date()) {
      await supabase
        .schema('p0012_rotary')
        .from('oauth_state')
        .delete()
        .eq('state', state);
      return redirect('/settings?ghl=error&reason=state_expired');
    }

    const codeVerifier = stateRow.code_verifier;

    // 3. Delete state row (single-use)
    await supabase
      .schema('p0012_rotary')
      .from('oauth_state')
      .delete()
      .eq('state', state);

    // 4. Exchange code for tokens
    const tokenBody = new URLSearchParams({
      client_id: process.env.GHL_CLIENT_ID,
      client_secret: process.env.GHL_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.GHL_REDIRECT_URI,
      code_verifier: codeVerifier,
    });

    const tokenResponse = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      console.error('GHL token exchange failed:', tokenResponse.status, text);
      return redirect('/settings?ghl=error&reason=token_exchange_failed');
    }

    const tokens = await tokenResponse.json();

    // 5. Upsert into ghl_tokens
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error: upsertError } = await supabase
      .schema('p0012_rotary')
      .from('ghl_tokens')
      .upsert(
        {
          location_id: tokens.locationId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'location_id' }
      );

    if (upsertError) {
      console.error('Failed to store GHL tokens:', upsertError);
      return redirect('/settings?ghl=error&reason=storage_failed');
    }

    // 6. Success — redirect to settings
    return redirect('/settings?ghl=connected');
  } catch (err) {
    console.error('ghl-callback error:', err);
    return redirect('/settings?ghl=error&reason=server_error');
  }
}
