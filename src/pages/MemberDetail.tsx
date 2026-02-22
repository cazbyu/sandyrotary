import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, MessageCircle, User, Mail, MapPin, Share2, UsersRound } from 'lucide-react';
import { Layout } from '../components/Layout';
import { AccordionSection } from '../components/AccordionSection';
import { supabase } from '../lib/supabase';

interface MemberData {
  id: string;
  first_name: string;
  last_name: string;
  profile_photo_url: string;
  member_status: string;
  member_title: string;
  share_contact_info: boolean;
  preferred_phone: string;
  mobile_phone: string;
  home_phone: string;
  office_phone: string;
  home_email: string;
  office_email: string;
  preferred_email: string;
  home_address_1: string;
  home_city: string;
  home_state: string;
  home_postal_code: string;
  office_address_1: string;
  office_city: string;
  office_state: string;
  office_postal_code: string;
  committees: string[] | null;
}

interface SocialMedia {
  platform: string;
  handle: string;
}

export function MemberDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<MemberData | null>(null);
  const [socialMedia, setSocialMedia] = useState<SocialMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadMemberData();
    }
  }, [id]);

  const loadMemberData = async () => {
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('0012-sr-members')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (memberError) throw memberError;

      setMember(memberData);

      const { data: socialData, error: socialError } = await supabase
        .from('0012-sr-member-social-media')
        .select('*')
        .eq('member_id', id);

      if (socialError) throw socialError;

      setSocialMedia(socialData || []);
    } catch (error) {
      console.error('Error loading member data:', error);
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

  const handleCall = () => {
    const phone = member?.preferred_phone || member?.mobile_phone;
    if (phone) {
      window.location.href = `tel:${phone.replace(/\D/g, '')}`;
    }
  };

  const handleText = () => {
    const phone = member?.preferred_phone || member?.mobile_phone;
    if (phone) {
      window.location.href = `sms:${phone.replace(/\D/g, '')}`;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
            <p className="mt-4 text-gray-600">Loading member...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!member) {
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
            <h1 className="text-xl font-bold text-white">Member</h1>
          </div>
          <div className="p-6 text-center">
            <p className="text-gray-600">Member not found</p>
          </div>
        </div>
      </Layout>
    );
  }

  const hasPhone = member.preferred_phone || member.mobile_phone;

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
          <h1 className="text-xl font-bold text-white">Member</h1>
        </div>

        <div className="p-4">
          <div className="bg-white rounded-2xl p-6 mb-4 text-center">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center mx-auto mb-4 border-2 border-blue-200">
              {member.profile_photo_url ? (
                <img
                  src={member.profile_photo_url}
                  alt={`${member.first_name} ${member.last_name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-gray-400" />
              )}
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {member.first_name} {member.last_name}
            </h2>

            {member.member_status && (
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                  member.member_status
                )}`}
              >
                {member.member_status}
              </span>
            )}

            {member.member_title && (
              <p className="text-gray-600 mt-2">{member.member_title}</p>
            )}
          </div>

          {member.share_contact_info && hasPhone && (
            <div className="bg-white rounded-2xl p-4 mb-4">
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleCall}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#1B2A4A] text-white py-3 px-6 rounded-lg hover:bg-[#2D3E5F] transition-colors"
                >
                  <Phone className="w-5 h-5" />
                  <span className="font-semibold">Call</span>
                </button>
                <button
                  onClick={handleText}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#D94F4F] text-white py-3 px-6 rounded-lg hover:bg-[#C44444] transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="font-semibold">Text</span>
                </button>
              </div>
            </div>
          )}

          {!member.share_contact_info && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-center">
              <p className="text-amber-800">
                This member has chosen not to share contact information.
              </p>
            </div>
          )}

          {member.share_contact_info && (
            <>
              {(member.preferred_phone || member.mobile_phone || member.home_phone || member.office_phone) && (
                <AccordionSection title="Phone Numbers" icon={Phone}>
                  <div className="space-y-3">
                    {member.preferred_phone && (
                      <div>
                        <div className="text-sm text-gray-600">Preferred Phone</div>
                        <div className="font-medium text-gray-800">{member.preferred_phone}</div>
                      </div>
                    )}
                    {member.mobile_phone && (
                      <div>
                        <div className="text-sm text-gray-600">Mobile Phone</div>
                        <div className="font-medium text-gray-800">{member.mobile_phone}</div>
                      </div>
                    )}
                    {member.home_phone && (
                      <div>
                        <div className="text-sm text-gray-600">Home Phone</div>
                        <div className="font-medium text-gray-800">{member.home_phone}</div>
                      </div>
                    )}
                    {member.office_phone && (
                      <div>
                        <div className="text-sm text-gray-600">Office Phone</div>
                        <div className="font-medium text-gray-800">{member.office_phone}</div>
                      </div>
                    )}
                  </div>
                </AccordionSection>
              )}

              {(member.home_email || member.office_email) && (
                <AccordionSection title="Email Addresses" icon={Mail}>
                  <div className="space-y-3">
                    {member.home_email && (
                      <div>
                        <div className="text-sm text-gray-600">Home Email</div>
                        <a
                          href={`mailto:${member.home_email}`}
                          className="font-medium text-[#3182CE] hover:underline"
                        >
                          {member.home_email}
                        </a>
                      </div>
                    )}
                    {member.office_email && (
                      <div>
                        <div className="text-sm text-gray-600">Office Email</div>
                        <a
                          href={`mailto:${member.office_email}`}
                          className="font-medium text-[#3182CE] hover:underline"
                        >
                          {member.office_email}
                        </a>
                      </div>
                    )}
                  </div>
                </AccordionSection>
              )}

              {(member.home_address_1 || member.office_address_1) && (
                <AccordionSection title="Addresses" icon={MapPin}>
                  <div className="space-y-4">
                    {member.home_address_1 && (
                      <div>
                        <div className="font-semibold text-gray-800 mb-2">Home Address</div>
                        <div className="text-gray-700">
                          {member.home_address_1}
                          {member.home_city && member.home_state && (
                            <>
                              <br />
                              {member.home_city}, {member.home_state} {member.home_postal_code}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    {member.office_address_1 && (
                      <div>
                        <div className="font-semibold text-gray-800 mb-2">Office Address</div>
                        <div className="text-gray-700">
                          {member.office_address_1}
                          {member.office_city && member.office_state && (
                            <>
                              <br />
                              {member.office_city}, {member.office_state} {member.office_postal_code}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionSection>
              )}
            </>
          )}

          {socialMedia.length > 0 && (
            <AccordionSection title="Social Media" icon={Share2}>
              <div className="space-y-3">
                {socialMedia.map((social, index) => (
                  <div key={index} className="bg-white p-3 rounded-lg">
                    <div className="font-medium text-gray-800">{social.platform}</div>
                    <div className="text-sm text-gray-600">@{social.handle}</div>
                  </div>
                ))}
              </div>
            </AccordionSection>
          )}

          {member.committees && member.committees.length > 0 && (
            <AccordionSection title="Committees" icon={UsersRound} defaultOpen>
              <div className="flex flex-wrap gap-2">
                {member.committees.map((committee, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-[#1B2A4A]/10 text-[#1B2A4A]"
                  >
                    {committee}
                  </span>
                ))}
              </div>
            </AccordionSection>
          )}

          <div className="h-20"></div>
        </div>
      </div>
    </Layout>
  );
}
