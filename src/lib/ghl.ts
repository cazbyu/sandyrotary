import { supabase } from './supabase';

export interface GHLStatus {
  connected: boolean;
  locationId: string | null;
  expiresAt: string | null;
  isExpired: boolean;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export async function callGHL(
  endpoint: string,
  method: string = 'GET',
  body?: object,
  locationId?: string
): Promise<unknown> {
  const headers = await getAuthHeaders();

  const response = await fetch('/.netlify/functions/ghl-proxy', {
    method: 'POST',
    headers,
    body: JSON.stringify({ endpoint, method, body, locationId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `GHL request failed (${response.status})`);
  }

  return data;
}

export async function getGHLStatus(): Promise<GHLStatus> {
  const headers = await getAuthHeaders();

  const response = await fetch('/.netlify/functions/ghl-status', {
    method: 'GET',
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Status check failed (${response.status})`);
  }

  return data as GHLStatus;
}
