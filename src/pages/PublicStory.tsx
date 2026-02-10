import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/slugUtils';

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
  };
}

export function PublicStory() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<Story | null>(null);
  const [clubWebsite, setClubWebsite] = useState('');

  useEffect(() => {
    loadStory();
    loadClubSettings();
  }, [slug]);

  const loadStory = async () => {
    try {
      const { data, error } = await supabase
        .from('0012-sr-stories')
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

      setStory(data as unknown as Story);
    } catch (error) {
      console.error('Error loading story:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClubSettings = async () => {
    try {
      const { data } = await supabase
        .from('0012-sr-club-settings')
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

  if (!story) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Story Not Found</h1>
          <p className="text-gray-600">This story may have been removed or is no longer available.</p>
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
          {story.image_urls && story.image_urls.length > 0 && (
            <div className="w-full h-96 bg-gray-200">
              <img
                src={story.image_urls[0]}
                alt={story.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{story.title}</h2>

            <div className="flex items-center gap-2 text-sm text-gray-600 mb-6 pb-6 border-b border-gray-200">
              <span>
                By {story.author.first_name} {story.author.last_name}
              </span>
              <span>•</span>
              <span>{formatDate(story.created_at)}</span>
            </div>

            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-lg">
                {story.body}
              </p>
            </div>

            {story.image_urls && story.image_urls.length > 1 && (
              <div className="grid grid-cols-2 gap-4 mt-8">
                {story.image_urls.slice(1).map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`${story.title} ${index + 2}`}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                ))}
              </div>
            )}
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
