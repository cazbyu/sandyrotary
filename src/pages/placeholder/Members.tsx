import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, ChevronRight, User } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { supabase } from '../../lib/supabase';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  profile_photo_url: string;
  member_status: string;
  member_title: string;
}

export function Members() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredMembers(members);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = members.filter(
        (member) =>
          member.first_name.toLowerCase().includes(query) ||
          member.last_name.toLowerCase().includes(query)
      );
      setFilteredMembers(filtered);
    }
  }, [searchQuery, members]);

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('members')
        .select('id, first_name, last_name, profile_photo_url, member_status, member_title')
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });

      if (error) throw error;

      setMembers(data || []);
      setFilteredMembers(data || []);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('active')) return 'bg-blue-100 text-blue-700';
    if (statusLower.includes('honorary')) return 'bg-purple-100 text-purple-700';
    if (statusLower.includes('inactive')) return 'bg-gray-100 text-gray-600';
    return 'bg-gray-100 text-gray-600';
  };

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
          <h1 className="text-xl font-bold text-white flex-1">Find Member</h1>
        </div>

        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
                <p className="mt-4 text-gray-600">Loading members...</p>
              </div>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No members found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => navigate(`/members/${member.id}`)}
                  className="w-full bg-white rounded-lg p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors active:scale-98"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 border-2 border-blue-200">
                    {member.profile_photo_url ? (
                      <img
                        src={member.profile_photo_url}
                        alt={`${member.first_name} ${member.last_name}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-800">
                      {member.first_name} {member.last_name}
                    </div>
                    {member.member_status && (
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getStatusColor(
                          member.member_status
                        )}`}
                      >
                        {member.member_status}
                      </span>
                    )}
                    {member.member_title && (
                      <div className="text-sm text-gray-600 mt-1">{member.member_title}</div>
                    )}
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
