import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { formatDate, shareContent } from '../lib/slugUtils';

interface Story {
  id: string;
  title: string;
  body: string;
  image_urls: string[];
  public_slug: string;
  created_at: string;
  author: {
    first_name: string;
    last_name: string;
    profile_photo_url?: string;
  };
}

export function StoryDetail() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<Story | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    loadStory();
  }, [slug]);

  const loadStory = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('stories')
        .select(
          `
          *,
          author:author_id (
            first_name,
            last_name,
            profile_photo_url
          )
        `
        )
        .eq('public_slug', slug)
        .eq('is_published', true)
        .maybeSingle();

      if (error) throw error;

      setStory(data as unknown as Story);
    } catch (error) {
      console.error('Error loading story:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!story) return;
    const publicUrl = `${window.location.origin}/share/story/${story.public_slug}`;
    await shareContent(story.title, 'Check out what Sandy Rotary Club is doing!', publicUrl);
  };

  const nextImage = () => {
    if (!story || !story.image_urls) return;
    setCurrentImageIndex((prev) => (prev + 1) % story.image_urls.length);
  };

  const prevImage = () => {
    if (!story || !story.image_urls) return;
    setCurrentImageIndex((prev) => (prev - 1 + story.image_urls.length) % story.image_urls.length);
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
            <h1 className="text-xl font-bold text-white flex-1">Story</h1>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
              <p className="mt-4 text-gray-600">Loading story...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!story) {
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
            <h1 className="text-xl font-bold text-white flex-1">Story</h1>
          </div>
          <div className="text-center py-12">
            <p className="text-gray-600">Story not found</p>
          </div>
        </div>
      </Layout>
    );
  }

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
          <h1 className="text-xl font-bold text-white flex-1">Story</h1>
          <button
            onClick={handleShare}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="bg-white">
          {story.image_urls && story.image_urls.length > 0 && (
            <div className="relative w-full h-64 bg-gray-200">
              <img
                src={story.image_urls[currentImageIndex]}
                alt={story.title}
                className="w-full h-full object-cover"
              />

              {story.image_urls.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6 text-white" />
                  </button>

                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                    {story.image_urls.map((_, index) => (
                      <div
                        key={index}
                        className={`w-2 h-2 rounded-full ${
                          index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{story.title}</h1>

            <div className="flex items-center gap-3 mb-6">
              {story.author.profile_photo_url && (
                <img
                  src={story.author.profile_photo_url}
                  alt={story.author.first_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              )}
              <div>
                <div className="font-semibold text-gray-800">
                  {story.author.first_name} {story.author.last_name}
                </div>
                <div className="text-sm text-gray-600">{formatDate(story.created_at)}</div>
              </div>
            </div>

            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{story.body}</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
