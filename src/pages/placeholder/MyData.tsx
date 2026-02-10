import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Phone, Mail, MapPin, Share2, Camera, X } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { AccordionSection } from '../../components/AccordionSection';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface SocialMedia {
  id?: string;
  platform: string;
  handle: string;
  isNew?: boolean;
}

interface FormData {
  first_name: string;
  last_name: string;
  birthday: string;
  wedding_anniversary: string;
  preferred_phone: string;
  mobile_phone: string;
  home_phone: string;
  office_phone: string;
  preferred_email_type: string;
  home_email: string;
  office_email: string;
  home_address_1: string;
  home_address_2: string;
  home_address_3: string;
  home_city: string;
  home_state: string;
  home_county: string;
  home_province: string;
  home_postal_code: string;
  home_country: string;
  office_address_1: string;
  office_address_2: string;
  office_address_3: string;
  office_city: string;
  office_state: string;
  office_county: string;
  office_province: string;
  office_postal_code: string;
  office_country: string;
  share_contact_info: boolean;
  profile_photo_url: string;
  member_status: string;
  member_title: string;
  membership_start_date: string;
}

export function MyData() {
  const navigate = useNavigate();
  const { member } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<FormData>({
    first_name: '',
    last_name: '',
    birthday: '',
    wedding_anniversary: '',
    preferred_phone: '',
    mobile_phone: '',
    home_phone: '',
    office_phone: '',
    preferred_email_type: 'home',
    home_email: '',
    office_email: '',
    home_address_1: '',
    home_address_2: '',
    home_address_3: '',
    home_city: '',
    home_state: '',
    home_county: '',
    home_province: '',
    home_postal_code: '',
    home_country: 'USA',
    office_address_1: '',
    office_address_2: '',
    office_address_3: '',
    office_city: '',
    office_state: '',
    office_county: '',
    office_province: '',
    office_postal_code: '',
    office_country: 'USA',
    share_contact_info: true,
    profile_photo_url: '',
    member_status: '',
    member_title: '',
    membership_start_date: '',
  });

  const [socialMedia, setSocialMedia] = useState<SocialMedia[]>([]);
  const [showAddSocial, setShowAddSocial] = useState(false);
  const [newSocial, setNewSocial] = useState({ platform: '', handle: '' });

  useEffect(() => {
    if (member) {
      loadMemberData();
    }
  }, [member]);

  const loadMemberData = async () => {
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('0012-sr-members')
        .select('*')
        .eq('id', member!.id)
        .maybeSingle();

      if (memberError) throw memberError;

      if (memberData) {
        setFormData({
          first_name: memberData.first_name || '',
          last_name: memberData.last_name || '',
          birthday: memberData.birthday || '',
          wedding_anniversary: memberData.wedding_anniversary || '',
          preferred_phone: memberData.preferred_phone || '',
          mobile_phone: memberData.mobile_phone || '',
          home_phone: memberData.home_phone || '',
          office_phone: memberData.office_phone || '',
          preferred_email_type: memberData.preferred_email_type || 'home',
          home_email: memberData.home_email || '',
          office_email: memberData.office_email || '',
          home_address_1: memberData.home_address_1 || '',
          home_address_2: memberData.home_address_2 || '',
          home_address_3: memberData.home_address_3 || '',
          home_city: memberData.home_city || '',
          home_state: memberData.home_state || '',
          home_county: memberData.home_county || '',
          home_province: memberData.home_province || '',
          home_postal_code: memberData.home_postal_code || '',
          home_country: memberData.home_country || 'USA',
          office_address_1: memberData.office_address_1 || '',
          office_address_2: memberData.office_address_2 || '',
          office_address_3: memberData.office_address_3 || '',
          office_city: memberData.office_city || '',
          office_state: memberData.office_state || '',
          office_county: memberData.office_county || '',
          office_province: memberData.office_province || '',
          office_postal_code: memberData.office_postal_code || '',
          office_country: memberData.office_country || 'USA',
          share_contact_info: memberData.share_contact_info ?? true,
          profile_photo_url: memberData.profile_photo_url || '',
          member_status: memberData.member_status || '',
          member_title: memberData.member_title || '',
          membership_start_date: memberData.membership_start_date || '',
        });
      }

      const { data: socialData, error: socialError } = await supabase
        .from('0012-sr-member-social-media')
        .select('*')
        .eq('member_id', member!.id);

      if (socialError) throw socialError;

      setSocialMedia(socialData || []);
    } catch (error) {
      console.error('Error loading member data:', error);
      setMessage({ type: 'error', text: 'Failed to load your data' });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${member!.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('0012-sr-profile-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('0012-sr-profile-photos')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, profile_photo_url: publicUrl }));

      const { error: updateError } = await supabase
        .from('0012-sr-members')
        .update({ profile_photo_url: publicUrl })
        .eq('id', member!.id);

      if (updateError) throw updateError;

      setMessage({ type: 'success', text: 'Photo updated successfully!' });
    } catch (error) {
      console.error('Error uploading photo:', error);
      setMessage({ type: 'error', text: 'Failed to upload photo' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      return [match[1], match[2], match[3]].filter(Boolean).join('.');
    }
    return value;
  };

  const handlePhoneChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: formatPhone(value) }));
  };

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddSocialMedia = () => {
    if (newSocial.platform && newSocial.handle) {
      setSocialMedia(prev => [...prev, { ...newSocial, isNew: true }]);
      setNewSocial({ platform: '', handle: '' });
      setShowAddSocial(false);
    }
  };

  const handleRemoveSocialMedia = (index: number) => {
    setSocialMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const { error: updateError } = await supabase
        .from('0012-sr-members')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          birthday: formData.birthday || null,
          wedding_anniversary: formData.wedding_anniversary || null,
          preferred_phone: formData.preferred_phone,
          mobile_phone: formData.mobile_phone,
          home_phone: formData.home_phone,
          office_phone: formData.office_phone,
          preferred_email_type: formData.preferred_email_type,
          home_email: formData.home_email,
          office_email: formData.office_email,
          home_address_1: formData.home_address_1,
          home_address_2: formData.home_address_2,
          home_address_3: formData.home_address_3,
          home_city: formData.home_city,
          home_state: formData.home_state,
          home_county: formData.home_county,
          home_province: formData.home_province,
          home_postal_code: formData.home_postal_code,
          home_country: formData.home_country,
          office_address_1: formData.office_address_1,
          office_address_2: formData.office_address_2,
          office_address_3: formData.office_address_3,
          office_city: formData.office_city,
          office_state: formData.office_state,
          office_county: formData.office_county,
          office_province: formData.office_province,
          office_postal_code: formData.office_postal_code,
          office_country: formData.office_country,
          share_contact_info: formData.share_contact_info,
        })
        .eq('id', member!.id);

      if (updateError) throw updateError;

      const existingSocialIds = socialMedia.filter(s => s.id && !s.isNew).map(s => s.id);
      const { error: deleteError } = await supabase
        .from('0012-sr-member-social-media')
        .delete()
        .eq('member_id', member!.id)
        .not('id', 'in', `(${existingSocialIds.join(',')})`);

      if (deleteError && existingSocialIds.length > 0) throw deleteError;

      const newSocialMedia = socialMedia.filter(s => s.isNew || !s.id);
      if (newSocialMedia.length > 0) {
        const { error: insertError } = await supabase
          .from('0012-sr-member-social-media')
          .insert(
            newSocialMedia.map(s => ({
              member_id: member!.id,
              platform: s.platform,
              handle: s.handle,
            }))
          );

        if (insertError) throw insertError;
      }

      setMessage({ type: 'success', text: 'Your data has been saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving data:', error);
      setMessage({ type: 'error', text: 'Failed to save your data. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
            <p className="mt-4 text-gray-600">Loading your data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F5F7FA]">
        <div className="bg-[#1B2A4A] px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">My Data</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[#D94F4F] text-white font-semibold rounded-lg hover:bg-[#C44444] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {message && (
          <div
            className={`mx-4 mt-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="p-4">
          <div className="bg-white rounded-2xl p-6 mb-4 flex flex-col items-center">
            <div className="relative">
              <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                {formData.profile_photo_url ? (
                  <img
                    src={formData.profile_photo_url}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-gray-400" />
                )}
              </div>
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              )}
            </div>
            <button
              onClick={handlePhotoClick}
              className="mt-3 text-[#D94F4F] font-medium flex items-center gap-1"
            >
              Change Picture <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

          <AccordionSection title="Member Information" icon={User} defaultOpen>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">First Name</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => handleChange('first_name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Last Name</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                />
              </div>

              <div className="bg-gray-100 p-3 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Member Status:</span>
                  <span className="text-sm font-medium text-gray-800">{formData.member_status || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Member Title:</span>
                  <span className="text-sm font-medium text-gray-800">{formData.member_title || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Membership Start:</span>
                  <span className="text-sm font-medium text-gray-800">
                    {formData.membership_start_date ? new Date(formData.membership_start_date).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Birthday</label>
                <input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => handleChange('birthday', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Wedding Anniversary</label>
                <input
                  type="date"
                  value={formData.wedding_anniversary}
                  onChange={(e) => handleChange('wedding_anniversary', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                />
              </div>
            </div>
          </AccordionSection>

          <AccordionSection title="Phone Numbers" icon={Phone}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Preferred Phone</label>
                <input
                  type="tel"
                  value={formData.preferred_phone}
                  onChange={(e) => handlePhoneChange('preferred_phone', e.target.value)}
                  placeholder="xxx.xxx.xxxx"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Mobile Phone</label>
                <input
                  type="tel"
                  value={formData.mobile_phone}
                  onChange={(e) => handlePhoneChange('mobile_phone', e.target.value)}
                  placeholder="xxx.xxx.xxxx"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Home Phone</label>
                <input
                  type="tel"
                  value={formData.home_phone}
                  onChange={(e) => handlePhoneChange('home_phone', e.target.value)}
                  placeholder="xxx.xxx.xxxx"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Office Phone</label>
                <input
                  type="tel"
                  value={formData.office_phone}
                  onChange={(e) => handlePhoneChange('office_phone', e.target.value)}
                  placeholder="xxx.xxx.xxxx"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                />
              </div>
            </div>
          </AccordionSection>

          <AccordionSection title="Email Addresses" icon={Mail}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Preferred Email</label>
                <select
                  value={formData.preferred_email_type}
                  onChange={(e) => handleChange('preferred_email_type', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                >
                  <option value="home">Home</option>
                  <option value="office">Office</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Home Email</label>
                <input
                  type="email"
                  value={formData.home_email}
                  onChange={(e) => handleChange('home_email', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Office Email</label>
                <input
                  type="email"
                  value={formData.office_email}
                  onChange={(e) => handleChange('office_email', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                />
              </div>
            </div>
          </AccordionSection>

          <AccordionSection title="Physical Addresses" icon={MapPin}>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-[#1B2A4A] mb-3">Home Address</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Address 1</label>
                    <input
                      type="text"
                      value={formData.home_address_1}
                      onChange={(e) => handleChange('home_address_1', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Address 2</label>
                    <input
                      type="text"
                      value={formData.home_address_2}
                      onChange={(e) => handleChange('home_address_2', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Address 3</label>
                    <input
                      type="text"
                      value={formData.home_address_3}
                      onChange={(e) => handleChange('home_address_3', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">City/Town</label>
                      <input
                        type="text"
                        value={formData.home_city}
                        onChange={(e) => handleChange('home_city', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">State/Province</label>
                      <input
                        type="text"
                        value={formData.home_state}
                        onChange={(e) => handleChange('home_state', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={formData.home_postal_code}
                        onChange={(e) => handleChange('home_postal_code', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Country</label>
                      <input
                        type="text"
                        value={formData.home_country}
                        onChange={(e) => handleChange('home_country', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-300 pt-6">
                <h3 className="font-semibold text-[#1B2A4A] mb-3">Office Address</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Address 1</label>
                    <input
                      type="text"
                      value={formData.office_address_1}
                      onChange={(e) => handleChange('office_address_1', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Address 2</label>
                    <input
                      type="text"
                      value={formData.office_address_2}
                      onChange={(e) => handleChange('office_address_2', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Address 3</label>
                    <input
                      type="text"
                      value={formData.office_address_3}
                      onChange={(e) => handleChange('office_address_3', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">City/Town</label>
                      <input
                        type="text"
                        value={formData.office_city}
                        onChange={(e) => handleChange('office_city', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">State/Province</label>
                      <input
                        type="text"
                        value={formData.office_state}
                        onChange={(e) => handleChange('office_state', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={formData.office_postal_code}
                        onChange={(e) => handleChange('office_postal_code', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Country</label>
                      <input
                        type="text"
                        value={formData.office_country}
                        onChange={(e) => handleChange('office_country', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AccordionSection>

          <AccordionSection title="Social Media" icon={Share2}>
            <div className="space-y-3">
              {socialMedia.map((social, index) => (
                <div key={index} className="flex items-center gap-3 bg-white p-3 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{social.platform}</div>
                    <div className="text-sm text-gray-600">@{social.handle}</div>
                  </div>
                  <button
                    onClick={() => handleRemoveSocialMedia(index)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {showAddSocial ? (
                <div className="bg-white p-4 rounded-lg space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Platform</label>
                    <input
                      type="text"
                      value={newSocial.platform}
                      onChange={(e) => setNewSocial(prev => ({ ...prev, platform: e.target.value }))}
                      placeholder="e.g., Twitter, LinkedIn"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Handle</label>
                    <input
                      type="text"
                      value={newSocial.handle}
                      onChange={(e) => setNewSocial(prev => ({ ...prev, handle: e.target.value }))}
                      placeholder="username"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddSocialMedia}
                      className="flex-1 py-2 bg-[#D94F4F] text-white font-semibold rounded-lg hover:bg-[#C44444]"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowAddSocial(false);
                        setNewSocial({ platform: '', handle: '' });
                      }}
                      className="flex-1 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddSocial(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-[#D94F4F] font-semibold hover:border-[#D94F4F] hover:bg-red-50 transition-colors"
                >
                  + Add Social Media
                </button>
              )}
            </div>
          </AccordionSection>

          <div className="bg-white rounded-lg p-4 flex items-center justify-between">
            <span className="text-gray-800 font-medium">Allow other users to share your digits?</span>
            <button
              onClick={() => handleChange('share_contact_info', !formData.share_contact_info)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                formData.share_contact_info ? 'bg-[#38A169]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  formData.share_contact_info ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="h-20"></div>
        </div>
      </div>
    </Layout>
  );
}
