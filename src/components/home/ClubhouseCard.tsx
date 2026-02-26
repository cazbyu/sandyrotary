import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { WeeklyPulse } from './WeeklyPulse';

interface Bulletin {
  id: string;
  title: string;
  body: string;
  public_slug: string;
  created_at: string;
  author: {
    first_name: string;
    last_name: string;
  } | null;
}

export function ClubhouseCard() {
  const navigate = useNavigate();
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBulletin();
  }, []);

  const loadBulletin = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('bulletins')
        .select('*, author:author_id(first_name, last_name)')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setBulletin(data);
    } catch (error) {
      console.error('Error loading bulletin:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trimEnd() + '...';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-5 h-5 text-[#1B2A4A]" />
        <h2 className="text-lg font-bold text-[#1B2A4A]">The Clubhouse</h2>
      </div>

      <WeeklyPulse />

      <div className="border-t border-gray-100 pt-3">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#1B2A4A]" />
          </div>
        ) : bulletin ? (
          <button
            onClick={() => navigate(`/bulletins/${bulletin.public_slug}`)}
            className="w-full text-left hover:bg-gray-50 -mx-2 px-2 py-2 rounded-lg transition-colors"
          >
            <h3 className="font-semibold text-gray-800 text-sm mb-1">
              {bulletin.title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span>{formatDate(bulletin.created_at)}</span>
              {bulletin.author && (
                <>
                  <span className="text-gray-300">|</span>
                  <span>
                    {bulletin.author.first_name} {bulletin.author.last_name}
                  </span>
                </>
              )}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {truncateText(bulletin.body, 150)}
            </p>
          </button>
        ) : (
          <p className="text-sm text-gray-400 py-2">No bulletins yet</p>
        )}
      </div>
    </div>
  );
}
