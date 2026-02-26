import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Plus } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, truncateText, shareContent } from '../../lib/slugUtils';

interface Story {
  id: string;
  title: string;
  body: string;
  image_urls: string[];
  public_slug: string;
  is_published: boolean;
  created_at: string;
  author: {
    first_name: string;
    last_name: string;
    profile_photo_url?: string;
  };
}

export function Stories() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState<Story[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadStories();
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

  const loadStories = async () => {
    try {
      let query = supabase
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
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        query = query.eq('is_published', true);
      }

      const { data, error } = await query;

      if (error) throw error;

      setStories((data || []) as unknown as Story[]);
    } catch (error) {
      console.error('Error loading stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (story: Story, e: React.MouseEvent) => {
    e.stopPropagation();
    const publicUrl = `${window.location.origin}/share/story/${story.public_slug}`;
    await shareContent(story.title, 'Check out what Sandy Rotary Club is doing!', publicUrl);
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
              <p className="mt-4 text-gray-600">Loading stories...</p>
            </div>
          </div>
        </div>
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
          <h1 className="text-xl font-bold text-white flex-1">Story</h1>
        </div>

        <div className="p-4 space-y-4">
          {stories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No stories yet</p>
            </div>
          ) : (
            stories.map((story) => (
              <div
                key={story.id}
                onClick={() => navigate(`/stories/${story.public_slug}`)}
                className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              >
                {!story.is_published && (
                  <div className="bg-yellow-500 text-white px-3 py-1 text-xs font-bold">DRAFT</div>
                )}

                {story.image_urls && story.image_urls.length > 0 && (
                  <div className="w-full h-48 overflow-hidden">
                    <img
                      src={story.image_urls[0]}
                      alt={story.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-4">
                  <h3 className="font-bold text-gray-800 text-lg mb-2">{story.title}</h3>

                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <span>{formatDate(story.created_at)}</span>
                    <span>•</span>
                    <span>
                      {story.author.first_name} {story.author.last_name}
                    </span>
                  </div>

                  <p className="text-gray-700 mb-4">{truncateText(story.body, 150)}</p>

                  <button
                    onClick={(e) => handleShare(story, e)}
                    className="flex items-center gap-2 text-[#D94F4F] hover:text-[#B83E3E] transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="text-sm font-semibold">Share</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {isAdmin && (
          <button
            onClick={() => navigate('/admin/stories/new')}
            className="fixed bottom-24 right-6 w-14 h-14 bg-[#1B2A4A] rounded-full shadow-lg flex items-center justify-center hover:bg-[#1B2A4A]/90 transition-colors z-50"
          >
            <Plus className="w-6 h-6 text-white" />
          </button>
        )}
      </div>
    </Layout>
  );
}
