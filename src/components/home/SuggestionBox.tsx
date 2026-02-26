import { useState, useEffect } from 'react';
import { Send, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Suggestion {
  id: string;
  suggestion_text: string;
  share_with_leadership: boolean;
  created_at: string;
}

export function SuggestionBox() {
  const { member } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [text, setText] = useState('');
  const [shareWithLeadership, setShareWithLeadership] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (member) {
      loadSuggestions();
    } else {
      setLoading(false);
    }
  }, [member]);

  const loadSuggestions = async () => {
    if (!member) return;

    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('member_suggestions')
        .select('id, suggestion_text, share_with_leadership, created_at')
        .eq('member_id', member.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member || !text.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('member_suggestions')
        .insert({
          member_id: member.id,
          suggestion_text: text.trim(),
          share_with_leadership: shareWithLeadership,
        });

      if (error) throw error;

      setText('');
      setShareWithLeadership(false);
      setSuccessMsg('Suggestion submitted!');
      setTimeout(() => setSuccessMsg(''), 3000);
      await loadSuggestions();
    } catch (error) {
      console.error('Error submitting suggestion:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const truncateText = (textStr: string, maxLength: number) => {
    if (textStr.length <= maxLength) return textStr;
    return textStr.substring(0, maxLength).trimEnd() + '...';
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share a suggestion..."
          rows={3}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm resize-none bg-gray-50"
        />

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShareWithLeadership(!shareWithLeadership)}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              shareWithLeadership
                ? 'bg-[#1B2A4A] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {shareWithLeadership ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            Share with Leadership
          </button>

          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="flex items-center gap-1.5 bg-[#D94F4F] hover:bg-[#c04545] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? 'Sending...' : 'Submit'}
          </button>
        </div>
      </form>

      {successMsg && (
        <p className="text-sm text-green-600 font-medium mt-2">{successMsg}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#1B2A4A]" />
        </div>
      ) : suggestions.length > 0 ? (
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Your Suggestions
          </h4>
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100"
            >
              <p className="text-sm text-gray-700 leading-relaxed">
                {truncateText(suggestion.suggestion_text, 120)}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-gray-400">
                  {formatDate(suggestion.created_at)}
                </span>
                {suggestion.share_with_leadership && (
                  <span className="inline-flex items-center gap-1 text-xs text-[#1B2A4A] bg-blue-50 px-2 py-0.5 rounded-full">
                    <Eye className="w-3 h-3" />
                    Shared
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
