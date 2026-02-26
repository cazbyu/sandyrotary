import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Trash2 } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { BottomNav } from '../../components/BottomNav';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../lib/slugUtils';

interface Selfie {
  id: string;
  image_url: string;
  caption: string;
  uploaded_by: string;
  created_at: string;
  uploader: {
    first_name: string;
    last_name: string;
    is_admin: boolean;
  };
}

export function Selfies() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selfies, setSelfies] = useState<Selfie[]>([]);
  const [selectedSelfie, setSelectedSelfie] = useState<Selfie | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadSelfies();
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    if (!user) return;
    const { data } = await supabase
      .schema('p0012_rotary')
      .from('members')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    setIsAdmin(data?.is_admin || false);
  };

  const loadSelfies = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('service_selfies')
        .select(
          `
          *,
          uploader:uploaded_by (
            first_name,
            last_name,
            is_admin
          )
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSelfies((data || []) as unknown as Selfie[]);
    } catch (error) {
      console.error('Error loading selfies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (selfie: Selfie) => {
    if (!confirm('Delete this photo?')) return;

    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('service_selfies')
        .delete()
        .eq('id', selfie.id);

      if (error) throw error;

      setSelfies(selfies.filter((s) => s.id !== selfie.id));
      setSelectedSelfie(null);
    } catch (error) {
      console.error('Error deleting selfie:', error);
      alert('Failed to delete photo');
    }
  };

  const canDelete = (selfie: Selfie) => {
    return selfie.uploaded_by === user?.id || isAdmin;
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
            <h1 className="text-xl font-bold text-white flex-1">Service Selfies</h1>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
              <p className="mt-4 text-gray-600">Loading photos...</p>
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
          <h1 className="text-xl font-bold text-white flex-1">Service Selfies</h1>
        </div>

        <div className="p-4">
          {selfies.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No photos yet. Be the first to share!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {selfies.map((selfie) => (
                <div
                  key={selfie.id}
                  onClick={() => setSelectedSelfie(selfie)}
                  className="aspect-square bg-gray-200 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <img
                    src={selfie.image_url}
                    alt={selfie.caption || 'Service selfie'}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="fixed bottom-24 right-6 w-14 h-14 bg-[#D94F4F] rounded-full shadow-lg flex items-center justify-center hover:bg-[#B83E3E] transition-colors z-50"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>

        {selectedSelfie && (
          <div
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedSelfie(null)}
          >
            <div
              className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <button
                  onClick={() => setSelectedSelfie(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors z-10"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
                <img
                  src={selectedSelfie.image_url}
                  alt={selectedSelfie.caption || 'Service selfie'}
                  className="w-full"
                />
              </div>

              <div className="p-6">
                {selectedSelfie.caption && (
                  <p className="text-gray-800 text-lg mb-4">{selectedSelfie.caption}</p>
                )}
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div>
                    <span>
                      By {selectedSelfie.uploader.first_name} {selectedSelfie.uploader.last_name}
                    </span>
                    <span className="mx-2">•</span>
                    <span>{formatDate(selectedSelfie.created_at)}</span>
                  </div>

                  {canDelete(selectedSelfie) && (
                    <button
                      onClick={() => handleDelete(selectedSelfie)}
                      className="flex items-center gap-2 text-red-600 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="font-semibold">Delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {showUploadModal && (
          <UploadModal
            onClose={() => setShowUploadModal(false)}
            onSuccess={() => {
              setShowUploadModal(false);
              loadSelfies();
            }}
          />
        )}
      </div>
      <BottomNav />
    </Layout>
  );
}

function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('0012-sr-service-selfies')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('0012-sr-service-selfies').getPublicUrl(fileName);

      const { error: insertError } = await supabase.schema('p0012_rotary').from('service_selfies').insert({
        image_url: publicUrl,
        caption: caption,
        uploaded_by: user.id,
      });

      if (insertError) throw insertError;

      onSuccess();
    } catch (error) {
      console.error('Error uploading selfie:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
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
          <h2 className="text-xl font-bold text-gray-800">Upload Photo</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {preview ? (
          <div className="mb-4">
            <img src={preview} alt="Preview" className="w-full rounded-lg" />
          </div>
        ) : (
          <label className="block mb-4">
            <div className="flex items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#1B2A4A] transition-colors">
              <div className="text-center">
                <Plus className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <span className="text-gray-600">Choose a photo</span>
              </div>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        )}

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            Caption (optional)
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A] resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="flex-1 py-3 px-4 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex-1 py-3 px-4 bg-[#D94F4F] text-white font-semibold rounded-lg hover:bg-[#B83E3E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
