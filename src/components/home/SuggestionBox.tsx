import { useState, useEffect } from 'react';
import { Send, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Suggestion {
  id: string;
  suggestion_text: string;
  share_with_leadership: boolean;
  share_name: boolean;
  created_at: string;
}

interface Props {
  /** Show the member's own list under the composer (the Ideas page shows My history instead). */
  showList?: boolean;
  onSubmitted?: () => void;
}

/**
 * Quick suggestion composer. "Send to leadership" shares the text; "Include my name" (off by default,
 * only with Send to leadership) lets leaders see who wrote it.
 */
export function SuggestionBox({ showList = true, onSubmitted }: Props = {}) {
  const { member } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [text, setText] = useState('');
  const [shareWithLeadership, setShareWithLeadership] = useState(false);
  const [shareName, setShareName] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (member && showList) {
      loadSuggestions();
    } else {
      setLoading(false);
    }
  }, [member, showList]);

  const loadSuggestions = async () => {
    if (!member) return;

    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('member_suggestions')
        .select('id, suggestion_text, share_with_leadership, share_name, created_at')
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
    setErrorMsg('');
    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('member_suggestions')
        .insert({
          member_id: member.id,
          suggestion_text: text.trim(),
          share_with_leadership: shareWithLeadership,
          share_name: shareWithLeadership && shareName,
        });

      if (error) throw error;

      setText('');
      setShareWithLeadership(false);
      setShareName(false);
      setSuccessMsg(shareWithLeadership ? 'Sent to leadership!' : 'Saved to your notes.');
      setTimeout(() => setSuccessMsg(''), 3000);
      if (showList) await loadSuggestions();
      onSubmitted?.();
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      setErrorMsg('Your suggestion was not sent. Please try again.');
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
        <label htmlFor="quick-suggestion" className="sr-only">Quick suggestion</label>
        <textarea
          id="quick-suggestion"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share a suggestion..."
          rows={3}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm resize-none bg-gray-50"
        />

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            aria-pressed={shareWithLeadership}
            onClick={() => {
              setShareWithLeadership(!shareWithLeadership);
              if (shareWithLeadership) setShareName(false);
            }}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-full transition-colors ${
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
            Send to leadership
          </button>

          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="flex items-center gap-1.5 bg-[#C44444] hover:bg-[#a83939] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? 'Sending...' : 'Submit'}
          </button>
        </div>

        {shareWithLeadership && (
          <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#1B2A4A]" id="suggestion-name-label">Include my name</div>
              <div id="suggestion-name-help" className="text-xs text-gray-500">
                {shareName
                  ? 'Leaders will see your name with this suggestion.'
                  : 'Leaders see your suggestion, not your name.'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={shareName}
              aria-labelledby="suggestion-name-label"
              aria-describedby="suggestion-name-help"
              onClick={() => setShareName(!shareName)}
              className={`relative w-[52px] h-8 flex-shrink-0 rounded-full transition-colors ${shareName ? 'bg-[#1B2A4A]' : 'bg-[#9AA3B0]'}`}
            >
              <span className="absolute top-1 w-6 h-6 rounded-full bg-white transition-all" style={{ left: shareName ? 24 : 4 }} />
            </button>
          </div>
        )}
      </form>

      {successMsg && (
        <p role="status" className="text-sm text-green-600 font-medium mt-2">{successMsg}</p>
      )}
      {errorMsg && (
        <p role="alert" className="text-sm text-[#C44444] font-medium mt-2">{errorMsg}</p>
      )}

      {showList && (loading ? (
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
                    {suggestion.share_name ? 'Shared with your name' : 'Shared without your name'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null)}
    </div>
  );
}
