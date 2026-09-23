import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Phone, Mail, MapPin, Share2, Camera, X } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { BottomNav } from '../../components/BottomNav';
import { AccordionSection } from '../../components/AccordionSection';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface SocialMedia {
  id: string;
  platform: string;
  url: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY_MS = 1000;
const SAVED_FADE_MS = 2000;
const DATE_FIELDS = ['birthday', 'wedding_anniversary'] as const;
const NAME_FIELDS = ['first_name', 'last_name'] as const;
type DateField = typeof DATE_FIELDS[number];

// Member-editable columns written by auto-save. Photo and the read-only status block are excluded.
const SAVE_FIELDS = [
  'first_name', 'last_name', 'birthday', 'wedding_anniversary',
  'preferred_phone', 'mobile_phone', 'home_phone', 'office_phone',
  'preferred_email_type', 'home_email', 'office_email',
  'home_address_1', 'home_address_2', 'home_address_3', 'home_city', 'home_state',
  'home_county', 'home_province', 'home_postal_code', 'home_country',
  'office_address_1', 'office_address_2', 'office_address_3', 'office_city', 'office_state',
  'office_county', 'office_province', 'office_postal_code', 'office_country',
  'share_contact_info',
] as const;
type SaveField = typeof SAVE_FIELDS[number];

const isCompleteDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [addingSocial, setAddingSocial] = useState(false);
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
  const [newSocial, setNewSocial] = useState({ platform: '', url: '' });

  // Auto-save state lives in refs so debounce timers, blur and unmount all see current values.
  const formRef = useRef<FormData>(formData);
  const lastSavedRef = useRef<Partial<Record<SaveField, string | boolean | null>> | null>(null);
  const clearedDatesRef = useRef<Set<DateField>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const saveAgainRef = useRef(false);
  const retryRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const memberIdRef = useRef(member?.id);
  memberIdRef.current = member?.id;

  useEffect(() => {
    if (member) {
      loadMemberData();
    }
  }, [member]);

  const showStatus = (status: SaveStatus) => {
    if (!mountedRef.current) return;
    if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
    setSaveStatus(status);
    if (status === 'saved') {
      savedFadeRef.current = setTimeout(() => {
        if (mountedRef.current) setSaveStatus('idle');
      }, SAVED_FADE_MS);
    }
  };

  const failed = (text: string, retry: () => void, error: unknown) => {
    console.error(text, error);
    retryRef.current = retry;
    showStatus('error');
    if (mountedRef.current) {
      const detail = (error as { message?: string } | null)?.message;
      setMessage({ type: 'error', text: detail ? `${text} (${detail})` : text });
    }
  };

  /** Fields whose current value differs from the last saved snapshot and passes the guards. */
  const collectChanges = () => {
    const saved = lastSavedRef.current;
    if (!saved || !memberIdRef.current) return {};
    const form = formRef.current;
    const changes: Partial<Record<SaveField, string | boolean | null>> = {};
    for (const field of SAVE_FIELDS) {
      let value: string | boolean | null = form[field];
      if ((NAME_FIELDS as readonly string[]).includes(field) && String(value).trim() === '') continue;
      if ((DATE_FIELDS as readonly string[]).includes(field)) {
        const date = value as string;
        if (date === '') {
          // A date input reads '' while half-typed; only a deliberate clear (on blur) erases it.
          if (!clearedDatesRef.current.has(field as DateField)) continue;
          value = null;
        } else if (!isCompleteDate(date)) {
          continue;
        }
      }
      if (value !== saved[field]) changes[field] = value;
    }
    return changes;
  };

  /** Save pending member changes. Saves run one at a time; a request during a save queues one more pass. */
  const flushSave = (): Promise<void> => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (inFlightRef.current) {
      saveAgainRef.current = true;
      return inFlightRef.current;
    }
    const run = async () => {
      do {
        saveAgainRef.current = false;
        const changes = collectChanges();
        if (Object.keys(changes).length === 0) break;
        showStatus('saving');
        const { error } = await supabase
          .schema('p0012_rotary')
          .from('members')
          .update(changes)
          .eq('id', memberIdRef.current!);
        if (error) {
          failed('Not saved', () => { void flushSave(); }, error);
          return;
        }
        lastSavedRef.current = { ...lastSavedRef.current, ...changes };
        for (const field of DATE_FIELDS) {
          if (field in changes) clearedDatesRef.current.delete(field);
        }
        if (mountedRef.current) setMessage(null);
        showStatus('saved');
      } while (saveAgainRef.current);
    };
    inFlightRef.current = run().finally(() => {
      inFlightRef.current = null;
    });
    return inFlightRef.current;
  };

  const scheduleSave = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void flushSave(); }, AUTOSAVE_DELAY_MS);
  };

  // Flush on unmount (back button, bottom nav) and when the tab is hidden or closed.
  useEffect(() => {
    mountedRef.current = true;
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flushSave();
    };
    const onUnload = () => { void flushSave(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onUnload);
      mountedRef.current = false;
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
      void flushSave();
    };
  }, []);

  const loadMemberData = async () => {
    try {
      const { data: memberData, error: memberError } = await supabase
        .schema('p0012_rotary')
        .from('members')
        .select('*')
        .eq('id', member!.id)
        .maybeSingle();

      if (memberError) throw memberError;

      if (memberData) {
        const loaded: FormData = {
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
        };
        formRef.current = loaded;
        setFormData(loaded);
        const snapshot: Partial<Record<SaveField, string | boolean | null>> = {};
        for (const field of SAVE_FIELDS) {
          const value = loaded[field];
          snapshot[field] = (DATE_FIELDS as readonly string[]).includes(field) && value === '' ? null : value;
        }
        lastSavedRef.current = snapshot;
      }

      const { data: socialData, error: socialError } = await supabase
        .schema('p0012_rotary')
        .from('member_social_media')
        .select('*')
        .eq('member_id', member!.id);

      if (socialError) throw socialError;

      setSocialMedia(socialData || []);
    } catch (error) {
      console.error('Error loading member data:', error);
      setMessage({ type: 'error', text: 'Failed to load your profile' });
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
        .schema('p0012_rotary')
        .from('members')
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

  /** Text fields: debounced save. Toggles/selects pass `immediate` and save right away. */
  const handleChange = (field: keyof FormData, value: string | boolean, immediate = false) => {
    formRef.current = { ...formRef.current, [field]: value };
    setFormData(prev => ({ ...prev, [field]: value }));
    if ((DATE_FIELDS as readonly string[]).includes(field) && value !== '') {
      clearedDatesRef.current.delete(field as DateField);
    }
    if (immediate) void flushSave();
    else scheduleSave();
  };

  const handlePhoneChange = (field: keyof FormData, value: string) => {
    handleChange(field, formatPhone(value));
  };

  // Any field losing focus saves right away (blur events bubble up to the form container).
  const handleFieldBlur = () => {
    void flushSave();
  };

  // An empty date input on blur is a deliberate clear only if the browser has no half-typed value.
  const handleDateBlur = (field: DateField, e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '' && !e.target.validity.badInput) clearedDatesRef.current.add(field);
  };

  const addSocialMedia = async (platform: string, url: string) => {
    setAddingSocial(true);
    showStatus('saving');
    const { data, error } = await supabase
      .schema('p0012_rotary')
      .from('member_social_media')
      .insert({ member_id: member!.id, platform, url })
      .select('id, platform, url')
      .single();
    setAddingSocial(false);
    if (error || !data) {
      failed('Not saved: social media link', () => { void addSocialMedia(platform, url); }, error);
      return;
    }
    setSocialMedia(prev => [...prev, data as SocialMedia]);
    setNewSocial({ platform: '', url: '' });
    setShowAddSocial(false);
    setMessage(null);
    showStatus('saved');
  };

  const handleAddSocialMedia = () => {
    if (newSocial.platform && newSocial.url && !addingSocial) {
      void addSocialMedia(newSocial.platform, newSocial.url);
    }
  };

  const removeSocialMedia = async (social: SocialMedia, index: number) => {
    setSocialMedia(prev => prev.filter(s => s.id !== social.id));
    showStatus('saving');
    const { error } = await supabase
      .schema('p0012_rotary')
      .from('member_social_media')
      .delete()
      .eq('id', social.id)
      .eq('member_id', member!.id);
    if (error) {
      // Put it back where it was so the screen matches the database.
      setSocialMedia(prev => {
        if (prev.some(s => s.id === social.id)) return prev;
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, social);
        return next;
      });
      failed('Not saved: removing social media link', () => { void removeSocialMedia(social, index); }, error);
      return;
    }
    setMessage(null);
    showStatus('saved');
  };

  const handleRetry = () => {
    const retry = retryRef.current;
    retryRef.current = null;
    if (retry) retry();
    else void flushSave();
  };

  const firstNameBlank = formData.first_name.trim() === '';
  const lastNameBlank = formData.last_name.trim() === '';

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
            <p className="mt-4 text-gray-600">Loading your profile...</p>
          </div>
        </div>
        <BottomNav />
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
          <h1 className="text-xl font-bold text-white">My Profile</h1>
          <div className="min-w-[5.5rem] flex justify-end text-sm font-medium" aria-live="polite">
            {saveStatus === 'saving' && <span className="text-white/80">Saving…</span>}
            {saveStatus === 'saved' && <span className="text-white">Saved ✓</span>}
            {saveStatus === 'error' && (
              <button
                onClick={handleRetry}
                className="px-3 py-1.5 bg-[#D94F4F] text-white font-semibold rounded-lg hover:bg-[#C44444]"
              >
                Not saved — Retry
              </button>
            )}
          </div>
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

        <div className="p-4" onBlur={handleFieldBlur}>
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
                {firstNameBlank && <p className="mt-1 text-sm text-red-600">Name can't be blank.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Last Name</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                />
                {lastNameBlank && <p className="mt-1 text-sm text-red-600">Name can't be blank.</p>}
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
                  onBlur={(e) => handleDateBlur('birthday', e)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Wedding Anniversary</label>
                <input
                  type="date"
                  value={formData.wedding_anniversary}
                  onChange={(e) => handleChange('wedding_anniversary', e.target.value)}
                  onBlur={(e) => handleDateBlur('wedding_anniversary', e)}
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
                  onChange={(e) => handleChange('preferred_email_type', e.target.value, true)}
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
                <div key={social.id} className="flex items-center gap-3 bg-white p-3 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800">{social.platform}</div>
                    <div className="text-sm text-gray-600 truncate">{social.url}</div>
                  </div>
                  <button
                    onClick={() => { void removeSocialMedia(social, index); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {showAddSocial ? (
                <div className="bg-white p-4 rounded-lg space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Platform</label>
                    <select
                      value={newSocial.platform}
                      onChange={(e) => setNewSocial(prev => ({ ...prev, platform: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                    >
                      <option value="">Select platform</option>
                      <option value="Facebook">Facebook</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Instagram">Instagram</option>
                      <option value="X/Twitter">X/Twitter</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">URL</label>
                    <input
                      type="url"
                      value={newSocial.url}
                      onChange={(e) => setNewSocial(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddSocialMedia}
                      disabled={addingSocial}
                      className="flex-1 py-2 bg-[#D94F4F] text-white font-semibold rounded-lg hover:bg-[#C44444] disabled:opacity-50"
                    >
                      {addingSocial ? 'Adding…' : 'Add'}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddSocial(false);
                        setNewSocial({ platform: '', url: '' });
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
              onClick={() => handleChange('share_contact_info', !formRef.current.share_contact_info, true)}
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
      <BottomNav />
    </Layout>
  );
}
