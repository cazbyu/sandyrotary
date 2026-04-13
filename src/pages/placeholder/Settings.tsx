import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { getGHLStatus, GHLStatus } from '../../lib/ghl';
import { supabase } from '../../lib/supabase';
import { LogOut, Loader2, AlertCircle, CheckCircle2, Link as LinkIcon } from 'lucide-react';

export function Settings() {
  const { member, isAdmin, signOut } = useAuth();
  const [ghlStatus, setGhlStatus] = useState<GHLStatus | null>(null);
  const [ghlLoading, setGhlLoading] = useState(false);
  const [ghlError, setGhlError] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ghl = params.get('ghl');
    const reason = params.get('reason');

    if (ghl === 'connected') {
      setBanner({ type: 'success', message: 'GoHighLevel connected successfully!' });
    } else if (ghl === 'error') {
      setBanner({ type: 'error', message: `GoHighLevel connection failed: ${reason || 'unknown error'}` });
    }

    if (ghl) {
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  // Fetch GHL status on mount (admin only)
  useEffect(() => {
    if (!isAdmin) return;

    setGhlLoading(true);
    getGHLStatus()
      .then(setGhlStatus)
      .catch((err) => setGhlError(err.message))
      .finally(() => setGhlLoading(false));
  }, [isAdmin]);

  async function handleConnect() {
    setConnectLoading(true);
    setGhlError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/.netlify/functions/ghl-auth-init', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate connection');
      }

      window.location.href = data.authUrl;
    } catch (err) {
      setGhlError(err instanceof Error ? err.message : 'Connection failed');
      setConnectLoading(false);
    }
  }

  return (
    <Layout>
      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Banner */}
        {banner && (
          <div
            className={`flex items-center gap-3 p-4 rounded-xl text-sm font-medium ${
              banner.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{banner.message}</span>
            <button
              onClick={() => setBanner(null)}
              className="ml-auto text-lg leading-none opacity-60 hover:opacity-100"
            >
              &times;
            </button>
          </div>
        )}

        {/* Section A: Account */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#1B2A4A]">Account</h2>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[#1B2A4A] font-medium">
                {member?.first_name} {member?.last_name}
              </p>
              {isAdmin && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-[#1B2A4A] text-white rounded-full">
                  Admin
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">{member?.email}</p>
          </div>

          <button
            onClick={signOut}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#D94F4F] bg-red-50 hover:bg-red-100 rounded-xl transition-colors w-full justify-center"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        {/* Section B: GHL Integration (Admin only) */}
        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#1B2A4A]">GoHighLevel Integration</h2>

            {ghlLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-[#1B2A4A] animate-spin" />
              </div>
            ) : ghlStatus?.connected ? (
              /* STATE 2: Connected */
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-green-700">Connected</span>
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <span className="font-medium text-gray-700">Location ID:</span>{' '}
                    {ghlStatus.locationId}
                  </p>
                  <p>
                    <span className="font-medium text-gray-700">Token expires:</span>{' '}
                    {ghlStatus.expiresAt
                      ? new Date(ghlStatus.expiresAt).toLocaleString()
                      : 'Unknown'}
                  </p>
                </div>

                {ghlStatus.isExpired && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Token expired — reconnect below
                  </div>
                )}

                <button
                  onClick={handleConnect}
                  disabled={connectLoading}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#1B2A4A] bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors w-full justify-center disabled:opacity-50"
                >
                  {connectLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LinkIcon className="w-4 h-4" />
                  )}
                  Reconnect
                </button>
              </div>
            ) : (
              /* STATE 1: Not connected */
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                  <span className="text-sm font-medium text-gray-500">Not Connected</span>
                </div>

                <button
                  onClick={handleConnect}
                  disabled={connectLoading}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#D94F4F] hover:bg-[#c74545] rounded-xl transition-colors w-full justify-center disabled:opacity-50"
                >
                  {connectLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LinkIcon className="w-4 h-4" />
                  )}
                  Connect to GoHighLevel
                </button>
              </div>
            )}

            {ghlError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {ghlError}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
