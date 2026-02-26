import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, User } from 'lucide-react';
import { Layout } from '../../../components/Layout';
import { BottomNav } from '../../../components/BottomNav';
import { supabase } from '../../../lib/supabase';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_photo_url?: string;
  member_status: string;
  member_title: string;
  is_admin: boolean;
}

export function ManageMembers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('members')
        .select('*')
        .order('last_name', { ascending: true });

      if (error) throw error;

      setMembers(data || []);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
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
            <h1 className="text-xl font-bold text-white flex-1">Manage Members</h1>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
              <p className="mt-4 text-gray-600">Loading members...</p>
            </div>
          </div>
        </div>
        <BottomNav />
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
          <h1 className="text-xl font-bold text-white flex-1">Manage Members</h1>
        </div>

        <div className="p-4 space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="bg-white rounded-xl shadow-md p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                {member.profile_photo_url ? (
                  <img
                    src={member.profile_photo_url}
                    alt={member.first_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#1B2A4A]/10">
                    <User className="w-6 h-6 text-[#1B2A4A]/50" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-800 text-base">
                  {member.first_name} {member.last_name}
                </div>
                <div className="text-gray-600 text-sm flex items-center gap-2">
                  <span>{member.member_status}</span>
                  {member.is_admin && (
                    <>
                      <span>•</span>
                      <span className="text-[#D94F4F] font-semibold">Admin</span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedMember(member)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <Edit2 className="w-5 h-5 text-[#1B2A4A]" />
              </button>
            </div>
          ))}
        </div>

        {selectedMember && (
          <EditMemberModal
            member={selectedMember}
            onClose={() => setSelectedMember(null)}
            onSuccess={() => {
              setSelectedMember(null);
              loadMembers();
            }}
          />
        )}
      </div>
      <BottomNav />
    </Layout>
  );
}

function EditMemberModal({
  member,
  onClose,
  onSuccess,
}: {
  member: Member;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    isAdmin: member.is_admin,
    memberStatus: member.member_status,
    memberTitle: member.member_title,
  });

  const handleSave = async () => {
    setLoading(true);

    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('members')
        .update({
          is_admin: formData.isAdmin,
          member_status: formData.memberStatus,
          member_title: formData.memberTitle,
        })
        .eq('id', member.id);

      if (error) throw error;

      onSuccess();
    } catch (error) {
      console.error('Error updating member:', error);
      alert('Failed to update member. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            Edit {member.first_name} {member.last_name}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isAdmin}
                onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                className="w-5 h-5 text-[#1B2A4A] border-gray-300 rounded focus:ring-[#1B2A4A]"
              />
              <span className="text-sm font-semibold text-gray-800">Admin Role</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Member Status
            </label>
            <select
              value={formData.memberStatus}
              onChange={(e) => setFormData({ ...formData, memberStatus: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
            >
              <option value="Active">Active</option>
              <option value="Honorary">Honorary</option>
              <option value="Inactive">Inactive</option>
              <option value="Leave of Absence">Leave of Absence</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">Title</label>
            <input
              type="text"
              value={formData.memberTitle}
              onChange={(e) => setFormData({ ...formData, memberTitle: e.target.value })}
              placeholder="e.g., Member, President, etc."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 px-4 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-3 px-4 bg-[#1B2A4A] text-white font-semibold rounded-lg hover:bg-[#1B2A4A]/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
