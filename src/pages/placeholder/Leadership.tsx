import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Phone, Mail } from 'lucide-react';
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
    preferred_phone?: string;
    home_email?: string;
    office_email?: string;
    preferred_email_type?: string;
  };
}

type TabKey = 'officers' | 'board' | 'past-presidents' | 'committees';

export function Leadership() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('officers');

  useEffect(() => {
    loadLeadership();
  }, []);

  const loadLeadership = async () => {
    try {
      const currentYear = getCurrentRotaryYear();

      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('leadership_roles')
        .select(
          `
          *,
          member:member_id (
            id,
            first_name,
            last_name,
            profile_photo_url,
            preferred_phone,
            home_email,
            office_email,
            preferred_email_type
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

  const getPreferredEmail = (leader: Leader) => {
    if (leader.member.preferred_email_type === 'office' && leader.member.office_email) {
      return leader.member.office_email;
    }
    return leader.member.home_email || leader.member.office_email;
  };

  const renderOfficers = () => {
    if (leaders.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-600">No leadership roles defined yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {leaders.map((leader) => (
          <div
            key={leader.id}
            className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div
                onClick={() => navigate(`/members/${leader.member.id}`)}
                className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 cursor-pointer"
              >
                {leader.member.profile_photo_url ? (
                  <img
                    src={leader.member.profile_photo_url}
                    alt={leader.member.first_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#1B2A4A]/10">
                    <User className="w-8 h-8 text-[#1B2A4A]/50" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div
                  onClick={() => navigate(`/members/${leader.member.id}`)}
                  className="font-bold text-[#1B2A4A] text-lg cursor-pointer hover:text-[#D94F4F]"
                >
                  {leader.member.first_name} {leader.member.last_name}
                </div>
                <div className="text-gray-600 text-sm mb-3">{leader.role_name}</div>

                <div className="flex gap-2">
                  {leader.member.preferred_phone && (
                    <a
                      href={`tel:${leader.member.preferred_phone}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="w-3 h-3" />
                      Call
                    </a>
                  )}
                  {getPreferredEmail(leader) && (
                    <a
                      href={`mailto:${getPreferredEmail(leader)}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Mail className="w-3 h-3" />
                      Email
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPlaceholder = (title: string) => {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">{title} coming soon</p>
      </div>
    );
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
      <div className="min-h-screen bg-[#F5F7FA] pb-32">
        <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Leadership</h1>
        </div>

        <div className="p-4">
          {activeTab === 'officers' && renderOfficers()}
          {activeTab === 'board' && renderPlaceholder('Board information')}
          {activeTab === 'past-presidents' && renderPlaceholder('Past Presidents')}
          {activeTab === 'committees' && renderPlaceholder('Committee assignments')}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-10">
          <div className="flex justify-around relative">
            <div
              className="absolute bottom-full left-0 right-0 h-0.5 bg-[#D94F4F] transition-all duration-300"
              style={{
                width: '25%',
                transform: `translateX(${['officers', 'board', 'past-presidents', 'committees'].indexOf(activeTab) * 100}%)`,
              }}
            />
            <button
              onClick={() => setActiveTab('officers')}
              className={`flex-1 text-center py-3 text-sm font-medium transition-colors ${
                activeTab === 'officers' ? 'text-[#D94F4F]' : 'text-gray-500'
              }`}
            >
              Current Officers
            </button>
            <button
              onClick={() => setActiveTab('board')}
              className={`flex-1 text-center py-3 text-sm font-medium transition-colors ${
                activeTab === 'board' ? 'text-[#D94F4F]' : 'text-gray-500'
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setActiveTab('past-presidents')}
              className={`flex-1 text-center py-3 text-sm font-medium transition-colors ${
                activeTab === 'past-presidents' ? 'text-[#D94F4F]' : 'text-gray-500'
              }`}
            >
              Past Presidents
            </button>
            <button
              onClick={() => setActiveTab('committees')}
              className={`flex-1 text-center py-3 text-sm font-medium transition-colors ${
                activeTab === 'committees' ? 'text-[#D94F4F]' : 'text-gray-500'
              }`}
            >
              Committees
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
