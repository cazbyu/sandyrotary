import { useState, useEffect } from 'react';
import {
  Camera,
  ChevronDown,
  Check,
  X,
  Loader2,
  Instagram,
  Facebook,
  Send,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface PendingSelfie {
  id: string;
  image_url: string;
  caption: string | null;
  uploaded_by: string;
  created_at: string;
  status: string;
  uploader: {
    first_name: string;
    last_name: string;
  };
}

type SocialFormat = 'instagram' | 'facebook' | 'original';

export function SelfieApprovalCard() {
  const { member } = useAuth();
  const [pending, setPending] = useState<PendingSelfie[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSection, setShowSection] = useState(true);
  const [selectedSelfie, setSelectedSelfie] = useState<PendingSelfie | null>(null);
  const [socialCaption, setSocialCaption] = useState('');
  const [activeFormat, setActiveFormat] = useState<SocialFormat>('instagram');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('service_selfies')
        .select(
          `
          *,
          uploader:uploaded_by (
            first_name,
            last_name
          )
        `
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPending((data || []) as unknown as PendingSelfie[]);
    } catch (error) {
      console.error('Error loading pending selfies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (selfie: PendingSelfie) => {
    if (!member) return;
    setProcessing(selfie.id);
    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('service_selfies')
        .update({
          status: 'approved',
          reviewed_by: member.id,
          reviewed_at: new Date().toISOString(),
          social_caption: socialCaption || selfie.caption || '',
        })
        .eq('id', selfie.id);

      if (error) throw error;

      setPending((prev) => prev.filter((p) => p.id !== selfie.id));
      setSelectedSelfie(null);
      setSocialCaption('');
    } catch (error) {
      console.error('Error approving selfie:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (selfie: PendingSelfie) => {
    if (!member) return;
    setProcessing(selfie.id);
    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('service_selfies')
        .update({
          status: 'rejected',
          reviewed_by: member.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selfie.id);

      if (error) throw error;

      setPending((prev) => prev.filter((p) => p.id !== selfie.id));
      setSelectedSelfie(null);
      setSocialCaption('');
    } catch (error) {
      console.error('Error rejecting selfie:', error);
    } finally {
      setProcessing(null);
    }
  };

  const openForReview = (selfie: PendingSelfie) => {
    setSelectedSelfie(selfie);
    setSocialCaption(selfie.caption || '');
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  // Aspect ratio classes for social media previews
  const formatConfig: Record<SocialFormat, { label: string; icon: typeof Instagram; aspect: string; desc: string }> = {
    instagram: { label: 'Instagram', icon: Instagram, aspect: 'aspect-square', desc: '1:1 Square' },
    facebook: { label: 'Facebook', icon: Facebook, aspect: 'aspect-video', desc: '16:9 Landscape' },
    original: { label: 'Original', icon: Camera, aspect: '', desc: 'As uploaded' },
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-5">
      {/* Header */}
      <button
        onClick={() => setShowSection(!showSection)}
        className="w-full flex items-center gap-3 mb-4"
      >
        <div className="w-10 h-10 rounded-full bg-[#D94F4F] flex items-center justify-center">
          <Camera className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 text-left">
          <h2 className="text-lg font-bold text-[#1B2A4A]">Public Image</h2>
          {pending.length > 0 && (
            <span className="text-xs text-amber-600 font-medium">
              {pending.length} photo{pending.length !== 1 ? 's' : ''} awaiting review
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
            showSection ? 'rotate-180' : ''
          }`}
        />
      </button>

      {showSection && (
        <>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-6">
              <Camera className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No photos pending review</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((selfie) => (
                <div
                  key={selfie.id}
                  onClick={() => openForReview(selfie)}
                  className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 cursor-pointer hover:bg-amber-100 transition-colors"
                >
                  <img
                    src={selfie.image_url}
                    alt="Pending selfie"
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {selfie.caption || 'No caption'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selfie.uploader.first_name} {selfie.uploader.last_name} &middot; {formatDate(selfie.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(selfie);
                      }}
                      disabled={processing === selfie.id}
                      className="w-8 h-8 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center transition-colors disabled:opacity-50"
                      title="Quick approve"
                    >
                      {processing === selfie.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReject(selfie);
                      }}
                      disabled={processing === selfie.id}
                      className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors disabled:opacity-50"
                      title="Reject"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* GHL Social Planner Placeholder */}
          <div className="mt-4 border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <Send className="w-4 h-4 text-[#1B2A4A]" />
              <span className="text-sm font-semibold text-[#1B2A4A]">GHL Social Planner</span>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Coming Soon</span>
            </div>
            <p className="text-xs text-gray-500">
              Approved photos will be formatted and sent to GoHighLevel Social Planner
              for scheduling across your club's social media channels.
            </p>
          </div>
        </>
      )}

      {/* Full Review Modal */}
      {selectedSelfie && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setSelectedSelfie(null);
            setSocialCaption('');
          }}
        >
          <div
            className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#1B2A4A]">Review Photo</h3>
                <button
                  onClick={() => {
                    setSelectedSelfie(null);
                    setSocialCaption('');
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                By {selectedSelfie.uploader.first_name} {selectedSelfie.uploader.last_name} &middot; {formatDate(selectedSelfie.created_at)}
              </p>
            </div>

            {/* Social Media Format Tabs */}
            <div className="flex border-b border-gray-200">
              {(Object.entries(formatConfig) as [SocialFormat, typeof formatConfig[SocialFormat]][]).map(
                ([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setActiveFormat(key)}
                    className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors ${
                      activeFormat === key
                        ? 'text-[#D94F4F] border-b-2 border-[#D94F4F]'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {config.label}
                  </button>
                )
              )}
            </div>

            {/* Image Preview with Format */}
            <div className="p-4 bg-gray-100">
              <div
                className={`mx-auto overflow-hidden rounded-lg bg-black max-w-sm ${
                  formatConfig[activeFormat].aspect
                }`}
              >
                <img
                  src={selectedSelfie.image_url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-center text-[10px] text-gray-400 mt-2">
                {formatConfig[activeFormat].desc}
              </p>
            </div>

            {/* Social Caption Editor */}
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Social Media Caption
                </label>
                <textarea
                  value={socialCaption}
                  onChange={(e) => setSocialCaption(e.target.value)}
                  rows={3}
                  placeholder="Edit caption for social media post..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none text-sm resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {socialCaption.length}/2200 characters
                </p>
              </div>

              {/* Hashtag Suggestions */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1.5">Quick hashtags:</p>
                <div className="flex flex-wrap gap-1.5">
                  {['#SandyRotary', '#ServiceAboveSelf', '#Rotary', '#CommunityService', '#RotaryInAction'].map(
                    (tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setSocialCaption((prev) =>
                            prev.includes(tag) ? prev : `${prev} ${tag}`.trim()
                          )
                        }
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors"
                      >
                        {tag}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleReject(selectedSelfie)}
                  disabled={processing === selectedSelfie.id}
                  className="flex-1 py-2.5 px-4 border-2 border-red-300 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 text-sm"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(selectedSelfie)}
                  disabled={processing === selectedSelfie.id}
                  className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                >
                  {processing === selectedSelfie.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Approve
                    </>
                  )}
                </button>
              </div>

              {/* GHL Send Placeholder */}
              <button
                disabled
                className="w-full py-2.5 px-4 bg-gray-100 text-gray-400 font-semibold rounded-lg text-sm flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <ExternalLink className="w-4 h-4" />
                Send to GHL Social Planner (Coming Soon)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
