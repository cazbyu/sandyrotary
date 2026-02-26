import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/slugUtils';

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
  };
}

export function PublicBulletin() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [clubWebsite, setClubWebsite] = useState('');

  useEffect(() => {
    loadBulletin();
    loadClubSettings();
  }, [slug]);

  const loadBulletin = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('bulletins')
        .select(
          `
          *,
          author:author_id (
            first_name,
            last_name
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

  const loadClubSettings = async () => {
    try {
      const { data } = await supabase
        .schema('p0012_rotary')
        .from('club_settings')
        .select('value')
        .eq('key', 'club_website')
        .maybeSingle();

      if (data?.value) {
        setClubWebsite(data.value);
      }
    } catch (error) {
      console.error('Error loading club settings:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!bulletin) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Bulletin Not Found</h1>
          <p className="text-gray-600">
            This bulletin may have been removed or is no longer available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="bg-[#1B2A4A] px-6 py-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-1">Sandy Rotary Club</h1>
        <p className="text-white/80 text-sm">District 5420</p>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-lg my-8">
          {bulletin.header_image_url && (
            <div className="w-full h-64 bg-gray-200">
              <img
                src={bulletin.header_image_url}
                alt={bulletin.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{bulletin.title}</h2>

            <div className="flex items-center gap-2 text-sm text-gray-600 mb-6 pb-6 border-b border-gray-200">
              <span>
                By {bulletin.author.first_name} {bulletin.author.last_name}
              </span>
              <span>—</span>
              <span>{formatDate(bulletin.created_at)}</span>
            </div>

            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-lg">
                {bulletin.body}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-lg p-6 text-center mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Learn More About Sandy Rotary Club
          </h3>
          {clubWebsite && (
            <a
              href={clubWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 px-6 py-3 bg-[#1B2A4A] text-white font-semibold rounded-lg hover:bg-[#1B2A4A]/90 transition-colors"
            >
              Visit Our Website
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
