import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Suggestion {
  id: string;
  suggestion_text: string;
  created_at: string;
  member: {
    first_name: string;
    last_name: string;
  } | null;
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function SuggestionFeed() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('member_suggestions')
        .select('*, member:member_id(first_name, last_name)')
        .eq('share_with_leadership', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-6">
        No suggestions shared yet
      </p>
    );
  }

  return (
    <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
      {suggestions.map((s) => (
        <div
          key={s.id}
          className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-gray-800">
              {s.member
                ? `${s.member.first_name} ${s.member.last_name}`
                : 'Anonymous'}
            </span>
            <span className="text-xs text-gray-400">
              {getRelativeTime(s.created_at)}
            </span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            {s.suggestion_text}
          </p>
        </div>
      ))}
    </div>
  );
}
