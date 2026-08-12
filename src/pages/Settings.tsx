import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Key, LogOut, Info, Shield, Bell, Link as LinkIcon, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BottomNav } from '../components/BottomNav';
import { getGHLStatus, initGHLAuth, GHLStatus } from '../lib/ghl';

interface ClubSetting {
  key: string;
  value: string;
}

export function Settings() {
  const navigate = useNavigate();
  const { member, isAdmin, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [shareContactInfo, setShareContactInfo] = useState(member?.share_contact_info ?? true);
  const [meetingReminders, setMeetingReminders] = useState(() => {
    const saved = localStorage.getItem('meetingReminders');
    return saved ? JSON.parse(saved) : true;
  });
  const [newStoriesNotif, setNewStoriesNotif] = useState(() => {
    const saved = localStorage.getItem('newStoriesNotif');
    return saved ? JSON.parse(saved) : true;
  });

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [clubSettings, setClubSettings] = useState<Record<string, string>>({});
  const [savingAdmin, setSavingAdmin] = useState(false);

  // GHL integration state
  const [ghlStatus, setGhlStatus] = useState<GHLStatus | null>(null);
  const [ghlLoading, setGhlLoading] = useState(false);
  const [ghlConnecting, setGhlConnecting] = useState(false);
  const [ghlError, setGhlError] = useState<string | null>(null);
  const [ghlBanner, setGhlBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchClubSettings();
    }
  }, [isAdmin]);

  // Check URL params for GHL OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ghl = params.get('ghl');
    const reason = params.get('reason');

    if (ghl === 'connected') {
      setGhlBanner({ type: 'success', text: 'GoHighLevel connected successfully!' });
    } else if (ghl === 'error') {
      setGhlBanner({ type: 'error', text: `GoHighLevel connection failed: ${reason || 'unknown error'}` });
    }

    if (ghl) {
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  // Fetch GHL status on mount (admin only)
  useEffect(() => {
    if (!isAdmin) return;
    setGhlLoading(true);
    getGHLStatus()
      .then(setGhlStatus)
      .catch((err) => setGhlError(err.message))
      .finally(() => setGhlLoading(false));
  }, [isAdmin]);

  const fetchClubSettings = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('club_settings')
        .select('*');

      if (error) {
        console.error('Error fetching club settings:', error);
        return;
      }

      const settingsMap: Record<string, string> = {};
      data?.forEach((setting: ClubSetting) => {
        settingsMap[setting.key] = setting.value || '';
      });

      setClubSettings(settingsMap);
    } catch (error) {
      console.error('Error fetching club settings:', error);
    }
  };

  const handleSavePrivacy = async () => {
    if (!member) return;

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('members')
        .update({ share_contact_info: shareContactInfo })
        .eq('id', member.id);

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'success', text: 'Privacy settings saved!' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save privacy settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationToggle = (key: string, value: boolean) => {
    localStorage.setItem(key, JSON.stringify(value));
    if (key === 'meetingReminders') {
      setMeetingReminders(value);
    } else if (key === 'newStoriesNotif') {
      setNewStoriesNotif(value);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setShowChangePassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  const handleGHLConnect = async () => {
    setGhlConnecting(true);
    setGhlError(null);
    try {
      const url = await initGHLAuth();
      window.location.href = url;
    } catch (err) {
      setGhlError(err instanceof Error ? err.message : 'Connection failed');
      setGhlConnecting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSaveClubSettings = async () => {
    setSavingAdmin(true);
    setMessage(null);

    try {
      const updates = Object.entries(clubSettings).map(([key, value]) => ({
        key,
        value,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .schema('p0012_rotary')
          .from('club_settings')
          .update({ value: update.value })
          .eq('key', update.key);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Club settings saved successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save club settings' });
    } finally {
      setSavingAdmin(false);
    }
  };

  const updateClubSetting = (key: string, value: string) => {
    setClubSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20">
      <header className="bg-[#1B2A4A] shadow-lg pb-8">
        <div className="container mx-auto px-4 pt-6">
          <div className="flex items-center mb-6">
            <button
              onClick={() => navigate('/')}
              className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-2xl font-bold text-white ml-4">Settings</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {ghlBanner && (
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
              ghlBanner.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {ghlBanner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="flex-1">{ghlBanner.text}</span>
            <button
              onClick={() => setGhlBanner(null)}
              className="text-lg leading-none opacity-60 hover:opacity-100"
            >
              &times;
            </button>
          </div>
        )}

        {message && (
          <div
            className={`px-4 py-3 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-600'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              {member?.profile_photo_url ? (
                <img
                  src={member.profile_photo_url}
                  alt={`${member.first_name} ${member.last_name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-gray-400" />
              )}
            </div>

            <div className="flex-1">
              <h2 className="text-xl font-bold text-[#1B2A4A]">
                {member?.first_name} {member?.last_name}
              </h2>
              <p className="text-gray-600">{member?.home_email}</p>
              {member?.member_status && (
                <span className="inline-block mt-1 px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                  {member.member_status}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => navigate('/my-data')}
            className="w-full text-[#D94F4F] hover:underline text-sm font-medium text-left"
          >
            Edit My Data →
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-[#1B2A4A]" />
            <h3 className="text-lg font-bold text-[#1B2A4A]">Privacy</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">Share contact info with members</p>
                <p className="text-sm text-gray-600">Allow other members to see your contact details</p>
              </div>
              <button
                onClick={() => {
                  setShareContactInfo(!shareContactInfo);
                  handleSavePrivacy();
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  shareContactInfo ? 'bg-[#D94F4F]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    shareContactInfo ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-[#1B2A4A]" />
            <h3 className="text-lg font-bold text-[#1B2A4A]">Notifications</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">Meeting reminders</p>
                <p className="text-sm text-gray-600">Get notified before upcoming meetings</p>
              </div>
              <button
                onClick={() => handleNotificationToggle('meetingReminders', !meetingReminders)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  meetingReminders ? 'bg-[#D94F4F]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    meetingReminders ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">New stories & bulletins</p>
                <p className="text-sm text-gray-600">Get notified when new content is published</p>
              </div>
              <button
                onClick={() => handleNotificationToggle('newStoriesNotif', !newStoriesNotif)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  newStoriesNotif ? 'bg-[#D94F4F]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    newStoriesNotif ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-[#1B2A4A]" />
            <h3 className="text-lg font-bold text-[#1B2A4A]">Account</h3>
          </div>

          <div className="space-y-3">
            {!showChangePassword ? (
              <button
                onClick={() => setShowChangePassword(true)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors font-medium text-gray-700"
              >
                Change Password
              </button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                    placeholder="At least 6 characters"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                    placeholder="Re-enter password"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-[#D94F4F] hover:bg-[#C44444] text-white font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePassword(false);
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-3 border-2 border-red-500 text-red-500 hover:bg-red-50 rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-[#1B2A4A]" />
            <h3 className="text-lg font-bold text-[#1B2A4A]">About</h3>
          </div>

          <div className="space-y-2 text-gray-600">
            <p className="font-medium">Sandy Rotary Club v1.0</p>
            <p className="text-sm">Powered by Sandy Rotary Club</p>
            <p className="text-sm">District 5420</p>
          </div>
        </div>

        {isAdmin && (
          <>
          {/* GoHighLevel Integration Card */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <LinkIcon className="w-5 h-5 text-[#1B2A4A]" />
              <h3 className="text-lg font-bold text-[#1B2A4A]">GoHighLevel Integration</h3>
            </div>

            {ghlLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 text-[#1B2A4A] animate-spin" />
              </div>
            ) : ghlStatus?.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-green-700">Connected</span>
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <span className="font-medium text-gray-700">Location ID:</span>{' '}
                    {ghlStatus.locationId}
                  </p>
                  <p>
                    <span className="font-medium text-gray-700">Token expires:</span>{' '}
                    {ghlStatus.expiresAt
                      ? new Date(ghlStatus.expiresAt).toLocaleString()
                      : 'Unknown'}
                  </p>
                </div>

                {ghlStatus.isExpired && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Token expired — please reconnect
                  </div>
                )}

                <button
                  onClick={handleGHLConnect}
                  disabled={ghlConnecting}
                  className="w-full px-4 py-3 text-sm font-medium text-[#1B2A4A] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {ghlConnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LinkIcon className="w-4 h-4" />
                  )}
                  Reconnect
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                  <span className="text-sm font-medium text-gray-500">Not Connected</span>
                </div>

                <p className="text-sm text-gray-600">
                  Connect to sync contacts, send meeting reminders, and automate social posts.
                </p>

                <button
                  onClick={handleGHLConnect}
                  disabled={ghlConnecting}
                  className="w-full bg-[#D94F4F] hover:bg-[#C44444] text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {ghlConnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LinkIcon className="w-4 h-4" />
                  )}
                  Connect GoHighLevel
                </button>
              </div>
            )}

            {ghlError && (
              <div className="flex items-center gap-2 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {ghlError}
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-[#1B2A4A] to-[#2D3E5F] rounded-xl shadow-md p-6 text-white">
            <h3 className="text-xl font-bold mb-4">Club Administration</h3>

            <div className="space-y-3">
              <button
                onClick={() => setShowAdminSettings(!showAdminSettings)}
                className="w-full text-left px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors font-medium"
              >
                {showAdminSettings ? 'Hide' : 'Show'} Club Settings
              </button>

              {showAdminSettings && (
                <div className="bg-white rounded-lg p-4 space-y-4 text-gray-800">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      WhatsApp Group Link
                    </label>
                    <input
                      type="url"
                      value={clubSettings['whatsapp_group_link'] || ''}
                      onChange={(e) => updateClubSetting('whatsapp_group_link', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                      placeholder="https://chat.whatsapp.com/..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Club Website URL
                    </label>
                    <input
                      type="url"
                      value={clubSettings['club_website_url'] || ''}
                      onChange={(e) => updateClubSetting('club_website_url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                      placeholder="https://sandyrotary.org"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Google Calendar ID
                    </label>
                    <input
                      type="text"
                      value={clubSettings['google_calendar_id'] || ''}
                      onChange={(e) => updateClubSetting('google_calendar_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                      placeholder="calendar-id@group.calendar.google.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meeting Place Name
                    </label>
                    <input
                      type="text"
                      value={clubSettings['meeting_place_name'] || ''}
                      onChange={(e) => updateClubSetting('meeting_place_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                      placeholder="e.g., Sandy Community Center"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meeting Time
                    </label>
                    <input
                      type="text"
                      value={clubSettings['meeting_time'] || ''}
                      onChange={(e) => updateClubSetting('meeting_time', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                      placeholder="e.g., Thursdays at 7:00 AM"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meeting Address Line 1
                    </label>
                    <input
                      type="text"
                      value={clubSettings['meeting_address_line1'] || ''}
                      onChange={(e) => updateClubSetting('meeting_address_line1', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                      placeholder="Street address"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={clubSettings['meeting_city'] || ''}
                        onChange={(e) => updateClubSetting('meeting_city', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        value={clubSettings['meeting_state'] || ''}
                        onChange={(e) => updateClubSetting('meeting_state', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Zip Code
                      </label>
                      <input
                        type="text"
                        value={clubSettings['meeting_zip'] || ''}
                        onChange={(e) => updateClubSetting('meeting_zip', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Country
                      </label>
                      <input
                        type="text"
                        value={clubSettings['meeting_country'] || ''}
                        onChange={(e) => updateClubSetting('meeting_country', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      RSVP Deadline (days before meeting)
                    </label>
                    <input
                      type="number"
                      value={clubSettings['rsvp_deadline_days'] || ''}
                      onChange={(e) => updateClubSetting('rsvp_deadline_days', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                      placeholder="e.g., 3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meal Cost (optional)
                    </label>
                    <input
                      type="text"
                      value={clubSettings['meal_cost'] || ''}
                      onChange={(e) => updateClubSetting('meal_cost', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                      placeholder="e.g., $15.00"
                    />
                  </div>

                  <button
                    onClick={handleSaveClubSettings}
                    disabled={savingAdmin}
                    className="w-full bg-[#D94F4F] hover:bg-[#C44444] text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
                  >
                    {savingAdmin ? 'Saving...' : 'Save Club Settings'}
                  </button>
                </div>
              )}

              <button
                onClick={() => navigate('/admin/members')}
                className="w-full text-left px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors font-medium"
              >
                Manage Members →
              </button>

              <button
                onClick={() => navigate('/leadership')}
                className="w-full text-left px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors font-medium"
              >
                Manage Leadership →
              </button>
            </div>
          </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
