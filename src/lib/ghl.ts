import { supabase } from './supabase';

export interface GHLStatus {
  connected: boolean;
  locationId: string | null;
  expiresAt: string | null;
  isExpired: boolean;
}

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return `Bearer ${session.access_token}`;
}

export async function getGHLStatus(): Promise<GHLStatus> {
  const auth = await getAuthHeader();
  const res = await fetch('/.netlify/functions/ghl-status', {
    headers: { Authorization: auth },
  });
  if (!res.ok) throw new Error('Failed to get GHL status');
  return res.json();
}

export async function initGHLAuth(): Promise<string> {
  const auth = await getAuthHeader();
  const res = await fetch('/.netlify/functions/ghl-auth-init', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to initialize GHL auth');
  const { authUrl } = await res.json();
  return authUrl;
}

export async function callGHL(
  endpoint: string,
  method: string = 'GET',
  body?: object,
  locationId?: string
): Promise<unknown> {
  const auth = await getAuthHeader();
  const res = await fetch('/.netlify/functions/ghl-proxy', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, method, body, locationId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'GHL request failed');
  }
  return res.json();
}
