import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, X } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { BottomNav } from '../../components/BottomNav';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { generateSlug } from '../../lib/slugUtils';

export function StoryForm() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      loadStory();
    }
  }, [slug]);

  const loadStory = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('stories')
        .select('*')
        .eq('public_slug', slug)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingId(data.id);
        setTitle(data.title);
        setBody(data.body);
        setImageUrls(data.image_urls || []);
        setIsPublished(data.is_published);
      }
    } catch (error) {
      console.error('Error loading story:', error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from('0012-sr-story-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('0012-sr-story-images').getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      setImageUrls([...imageUrls, ...uploadedUrls]);
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Failed to upload images. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const handleSave = async (publish: boolean) => {
    if (!title.trim() || !body.trim()) {
      alert('Please fill in title and body');
      return;
    }

    if (!user) return;

    setLoading(true);

    try {
      const storyData = {
        title,
        body,
        image_urls: imageUrls,
        is_published: publish,
        author_id: user.id,
        public_slug: existingId ? undefined : generateSlug(title),
      };

      if (existingId) {
        const { error } = await supabase
          .schema('p0012_rotary')
          .from('stories')
          .update(storyData)
          .eq('id', existingId);

        if (error) throw error;
      } else {
        const { error } = await supabase.schema('p0012_rotary').from('stories').insert([storyData]);

        if (error) throw error;
      }

      navigate('/stories');
    } catch (error) {
      console.error('Error saving story:', error);
      alert('Failed to save story. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-xl font-bold text-white flex-1">
            {existingId ? 'Edit Story' : 'New Story'}
          </h1>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-white rounded-xl shadow-md p-4">
            <label className="block text-sm font-semibold text-gray-800 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Story title"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
            />
          </div>

          <div className="bg-white rounded-xl shadow-md p-4">
            <label className="block text-sm font-semibold text-gray-800 mb-2">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Tell your story..."
              rows={12}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A] resize-none"
            />
          </div>

          <div className="bg-white rounded-xl shadow-md p-4">
            <label className="block text-sm font-semibold text-gray-800 mb-2">Images</label>

            {imageUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                {imageUrls.map((url, index) => (
                  <div key={index} className="relative">
                    <img
                      src={url}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#1B2A4A] transition-colors">
              <Upload className="w-5 h-5 text-gray-600" />
              <span className="text-gray-600">
                {uploading ? 'Uploading...' : 'Upload Images'}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-5 h-5 text-[#1B2A4A] border-gray-300 rounded focus:ring-[#1B2A4A]"
              />
              <span className="text-sm font-semibold text-gray-800">Publish story</span>
            </label>
            <p className="text-xs text-gray-600 mt-1 ml-8">
              Published stories are visible to all members and can be shared publicly
            </p>
          </div>

          <div className="flex gap-3 pb-6">
            <button
              onClick={() => handleSave(false)}
              disabled={loading}
              className="flex-1 py-3 px-4 border-2 border-[#1B2A4A] text-[#1B2A4A] font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={loading}
              className="flex-1 py-3 px-4 bg-[#D94F4F] text-white font-semibold rounded-lg hover:bg-[#B83E3E] transition-colors disabled:opacity-50"
            >
              {loading ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
      <BottomNav />
    </Layout>
  );
}
