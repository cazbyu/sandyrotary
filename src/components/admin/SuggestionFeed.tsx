import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SharedSuggestion {
  text: string;
  date: string; // YYYY-MM-DD (club time); no time of day
  name: string | null; // only when the member chose "Include my name"
}

/**
 * Suggestions members sent to leadership, via p0012_rotary.shared_suggestions():
 * the author's name appears only when they included it; otherwise "A member".
 */
export function SuggestionFeed() {
  const [suggestions, setSuggestions] = useState<SharedSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      const { data, error } = await supabase.schema('p0012_rotary').rpc('shared_suggestions');
      if (error) throw error;
      setSuggestions((data as SharedSuggestion[] | null) || []);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDay = (day: string) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

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
      {suggestions.map((s, i) => (
        <div
          key={i}
          className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-gray-800">
              {s.name ?? 'A member'}
            </span>
            <span className="text-xs text-gray-400">{formatDay(s.date)}</span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            {s.text}
          </p>
        </div>
      ))}
    </div>
  );
}
