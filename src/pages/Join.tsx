import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Join() {
  const membershipEmail = import.meta.env.VITE_MEMBERSHIP_EMAIL;
  const mailtoHref = membershipEmail
    ? `mailto:${membershipEmail}?subject=${encodeURIComponent('Interested in joining Sandy Rotary')}`
    : undefined;

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase
          .schema('p0012_rotary')
          .from('club_settings')
          .select('key, value')
          .in('key', [
            'meeting_place_name',
            'meeting_time',
            'meeting_address_line1',
            'meeting_city',
            'meeting_state',
            'meeting_zip',
            'club_website_url',
          ]);

        const map: Record<string, string> = {};
        (data || []).forEach((row: { key: string; value: string }) => {
          if (row.value) map[row.key] = row.value;
        });
        setSettings(map);
      } catch {
        // silently fail — placeholders will show
      } finally {
        setLoaded(true);
      }
    };
    loadSettings();
  }, []);

  const place = settings.meeting_place_name || '—';
  const time = settings.meeting_time || '—';
  const addressParts = [
    settings.meeting_address_line1,
    settings.meeting_city,
    settings.meeting_state,
    settings.meeting_zip,
  ].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(', ') : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1B2A4A] to-[#2D3E5F] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="flex justify-center mb-6">
            <img src="/logo-login.png" alt="Sandy Rotary Club" className="w-24 h-24 rounded-full object-contain shadow-lg" />
          </div>

          <h1 className="text-2xl font-bold text-[#1B2A4A] mb-2">
            Join Sandy Rotary
          </h1>

          <div className="text-gray-600 text-sm text-left space-y-3 mb-6">
            {loaded && (
              <p>
                Sandy Rotary Club meets {time} at {place}.
                {address && <><br /><span className="text-gray-500 text-xs">{address}</span></>}
                {' '}We're part of Rotary District 5420.
              </p>
            )}
            <p>
              As a Rotarian you'll join a global network of 1.4 million
              community leaders dedicated to service above self. Membership
              includes weekly fellowship, professional networking, and hands-on
              service projects.
            </p>
            <p>
              Interested? Reach out to our Membership Chair and we'll invite
              you to a meeting as our guest — no commitment required.
            </p>
          </div>

          <div className="space-y-3">
            {mailtoHref ? (
              <a
                href={mailtoHref}
                className="w-full bg-[#1B2A4A] hover:bg-[#2D3E5F] text-white font-semibold py-3 px-6 rounded-lg transition duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <Mail className="w-5 h-5" />
                Email the Membership Chair
              </a>
            ) : (
              <button
                disabled
                className="w-full bg-gray-300 text-gray-500 font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Mail className="w-5 h-5" />
                Email the Membership Chair
              </button>
            )}
            {!membershipEmail && (
              <p className="text-xs text-gray-400">Contact address not configured</p>
            )}

            <Link
              to="/login"
              className="w-full bg-white hover:bg-gray-50 text-[#1B2A4A] font-semibold py-3 px-6 rounded-lg transition duration-200 border-2 border-[#1B2A4A] flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Sign In
            </Link>
          </div>
        </div>

        <p className="text-white text-center mt-6 text-sm">
          Sandy Rotary Club &bull; District 5420
        </p>
      </div>
    </div>
  );
}
