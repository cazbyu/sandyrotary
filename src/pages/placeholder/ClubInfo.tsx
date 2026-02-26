import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info, Clipboard, MapPin, Copy } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { supabase } from '../../lib/supabase';

interface ClubSettings {
  club_number?: string;
  charter_date?: string;
  meeting_place_name?: string;
  meeting_time?: string;
  meeting_timezone?: string;
  meeting_address_line1?: string;
  meeting_city?: string;
  meeting_state?: string;
  meeting_postal_code?: string;
  meeting_country?: string;
}

export function ClubInfo() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ClubSettings>({});
  const [clubInfo, setClubInfo] = useState('');

  useEffect(() => {
    loadClubData();
  }, []);

  const loadClubData = async () => {
    try {
      const { data: settingsData, error: settingsError } = await supabase
        .schema('p0012_rotary')
        .from('club_settings')
        .select('key, value');

      if (settingsError) throw settingsError;

      const settingsMap: ClubSettings = {};
      (settingsData || []).forEach((row) => {
        settingsMap[row.key as keyof ClubSettings] = row.value;
      });

      setSettings(settingsMap);

      const { data: infoData, error: infoError } = await supabase
        .schema('p0012_rotary')
        .from('club_info')
        .select('content')
        .maybeSingle();

      if (infoError) throw infoError;

      if (infoData?.content) {
        setClubInfo(infoData.content);
      }
    } catch (error) {
      console.error('Error loading club data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGetDirections = () => {
    const address = [
      settings.meeting_address_line1,
      settings.meeting_city,
      settings.meeting_state,
      settings.meeting_postal_code,
    ]
      .filter(Boolean)
      .join(', ');

    const encodedAddress = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
  };

  const handleCopyClubInfo = () => {
    const text = `Club Number: ${settings.club_number || 'N/A'}\nCharter Date: ${settings.charter_date || 'N/A'}`;
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <Layout showHeader={false}>
        <div className="min-h-screen bg-[#F5F7FA]">
          <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-xl font-bold text-white flex-1">Club Information</h1>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
              <p className="mt-4 text-gray-600">Loading club information...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F5F7FA]">
        <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Club Information</h1>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-white rounded-xl shadow-md p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Info className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-[#1B2A4A]">Club Information</h2>
              </div>
              <button
                onClick={handleCopyClubInfo}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <Copy className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600 font-medium">Club Number:</span>
                <span className="text-gray-800 font-semibold">{settings.club_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600 font-medium">Charter Date:</span>
                <span className="text-gray-800 font-semibold">{settings.charter_date || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Clipboard className="w-4 h-4 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-[#1B2A4A]">Meeting Information</h2>
            </div>

            <div className="space-y-3">
              <div className="py-2">
                <span className="text-gray-600 font-medium block mb-1">Meeting Place:</span>
                <span className="text-gray-800 font-semibold">{settings.meeting_place_name || 'N/A'}</span>
              </div>
              <div className="py-2">
                <span className="text-gray-600 font-medium block mb-1">Meeting Time:</span>
                <span className="text-gray-800 font-semibold">
                  {settings.meeting_time || 'N/A'}
                  {settings.meeting_timezone && ` (${settings.meeting_timezone})`}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <MapPin className="w-4 h-4 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-[#1B2A4A]">Meeting Address</h2>
            </div>

            <div className="space-y-2 mb-4">
              {settings.meeting_address_line1 && (
                <p className="text-gray-800">{settings.meeting_address_line1}</p>
              )}
              {(settings.meeting_city || settings.meeting_state || settings.meeting_postal_code) && (
                <p className="text-gray-800">
                  {[settings.meeting_city, settings.meeting_state, settings.meeting_postal_code]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
              {settings.meeting_country && <p className="text-gray-800">{settings.meeting_country}</p>}
            </div>

            <button
              onClick={handleGetDirections}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-[#1B2A4A] text-[#1B2A4A] font-semibold rounded-lg hover:bg-[#1B2A4A] hover:text-white transition-colors"
            >
              <MapPin className="w-5 h-5" />
              Get Directions
            </button>
          </div>

          {clubInfo && (
            <div className="bg-white rounded-xl shadow-md p-5">
              <h2 className="text-lg font-semibold text-[#1B2A4A] mb-3">Additional Information</h2>
              <div className="text-gray-700 whitespace-pre-wrap">{clubInfo}</div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
