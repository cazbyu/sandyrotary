import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, User, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface MemberResult {
  id: string;
  first_name: string;
  last_name: string;
  member_title: string | null;
  profile_photo_url: string | null;
}

export function ConnectGrowCard() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<MemberResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [referralUrl, setReferralUrl] = useState<string | null>(null);

  useEffect(() => {
    loadReferralUrl();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchMembers(searchQuery.trim());
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const loadReferralUrl = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('club_settings')
        .select('value')
        .eq('key', 'ghl_referral_form_url')
        .maybeSingle();

      if (error) throw error;
      if (data?.value) {
        setReferralUrl(data.value);
      }
    } catch (error) {
      console.error('Error loading referral URL:', error);
    }
  };

  const searchMembers = async (query: string) => {
    setSearching(true);
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('members')
        .select('id, first_name, last_name, member_title, profile_photo_url')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(5);

      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error('Error searching members:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleReferClick = () => {
    if (referralUrl) {
      window.open(referralUrl, '_blank');
    } else {
      navigate('/refer');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-[#1B2A4A]" />
        <h2 className="text-lg font-bold text-[#1B2A4A]">Connect & Grow</h2>
      </div>

      {/* Directory Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search members..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm bg-gray-50"
          />
        </div>

        {searching && (
          <div className="flex items-center justify-center py-3">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[#1B2A4A]" />
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-2 space-y-1">
            {results.map((m) => (
              <button
                key={m.id}
                onClick={() => navigate(`/members/${m.id}`)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                {m.profile_photo_url ? (
                  <img
                    src={m.profile_photo_url}
                    alt={`${m.first_name} ${m.last_name}`}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {m.first_name} {m.last_name}
                  </p>
                  {m.member_title && (
                    <p className="text-xs text-gray-500 truncate">{m.member_title}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => navigate('/members')}
          className="mt-2 text-sm text-[#D94F4F] font-medium hover:underline"
        >
          See All Members
        </button>
      </div>

      {/* Refer a Friend */}
      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={handleReferClick}
          className="w-full flex items-center justify-center gap-2 bg-[#1B2A4A] hover:bg-[#2D3E5F] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Refer a Friend
        </button>
      </div>
    </div>
  );
}
