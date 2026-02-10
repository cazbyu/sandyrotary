import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { formatDate, shareContent } from '../lib/slugUtils';

interface Bulletin {
  id: string;
  title: string;
  body: string;
  header_image_url?: string;
  public_slug: string;
  created_at: string;
  author: {
    first_name: string;
    last_name: string;
    profile_photo_url?: string;
  };
}

export function BulletinDetail() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);

  useEffect(() => {
    loadBulletin();
  }, [slug]);

  const loadBulletin = async () => {
    try {
      const { data, error } = await supabase
        .from('0012-sr-bulletins')
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

      setBulletin(data as unknown as Bulletin);
    } catch (error) {
      console.error('Error loading bulletin:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!bulletin) return;
    const publicUrl = `${window.location.origin}/share/bulletin/${bulletin.public_slug}`;
    await shareContent(bulletin.title, 'Check out the latest from Sandy Rotary Club!', publicUrl);
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
            <h1 className="text-xl font-bold text-white flex-1">Bulletin</h1>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
              <p className="mt-4 text-gray-600">Loading bulletin...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!bulletin) {
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
            <h1 className="text-xl font-bold text-white flex-1">Bulletin</h1>
          </div>
          <div className="text-center py-12">
            <p className="text-gray-600">Bulletin not found</p>
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
          <h1 className="text-xl font-bold text-white flex-1">Bulletin</h1>
          <button
            onClick={handleShare}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="bg-white">
          {bulletin.header_image_url && (
            <div className="w-full h-48 bg-gray-200">
              <img
                src={bulletin.header_image_url}
                alt={bulletin.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{bulletin.title}</h1>

            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
              {bulletin.author.profile_photo_url && (
                <img
                  src={bulletin.author.profile_photo_url}
                  alt={bulletin.author.first_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              )}
              <div>
                <div className="font-semibold text-gray-800">
                  By {bulletin.author.first_name} {bulletin.author.last_name}
                </div>
                <div className="text-sm text-gray-600">{formatDate(bulletin.created_at)}</div>
              </div>
            </div>

            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{bulletin.body}</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
