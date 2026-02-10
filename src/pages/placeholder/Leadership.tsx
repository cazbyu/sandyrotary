import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { supabase } from '../../lib/supabase';

interface Leader {
  id: string;
  role_name: string;
  sort_order: number;
  member_id: string;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    profile_photo_url?: string;
  };
}

export function Leadership() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [leaders, setLeaders] = useState<Leader[]>([]);

  useEffect(() => {
    loadLeadership();
  }, []);

  const loadLeadership = async () => {
    try {
      const currentYear = getCurrentRotaryYear();

      const { data, error } = await supabase
        .from('0012-sr-leadership-roles')
        .select(
          `
          *,
          member:member_id (
            id,
            first_name,
            last_name,
            profile_photo_url
          )
        `
        )
        .eq('year', currentYear)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setLeaders((data || []) as unknown as Leader[]);
    } catch (error) {
      console.error('Error loading leadership:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentRotaryYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (month >= 6) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
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
            <h1 className="text-xl font-bold text-white flex-1">Leadership</h1>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
              <p className="mt-4 text-gray-600">Loading leadership...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
        <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Leadership</h1>
        </div>

        <div className="p-4 space-y-3">
          {leaders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No leadership roles defined yet</p>
            </div>
          ) : (
            leaders.map((leader) => (
              <div
                key={leader.id}
                onClick={() => navigate(`/members/${leader.member.id}`)}
                className="bg-white rounded-xl shadow-md p-4 flex items-center gap-4 cursor-pointer hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                  {leader.member.profile_photo_url ? (
                    <img
                      src={leader.member.profile_photo_url}
                      alt={leader.member.first_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#1B2A4A]/10">
                      <User className="w-6 h-6 text-[#1B2A4A]/50" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-800 text-base">{leader.role_name}</div>
                  <div className="text-gray-600 text-sm">
                    {leader.member.first_name} {leader.member.last_name}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
