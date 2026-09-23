import { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getCategoryColor, getCategoryLabel } from '../../lib/ideaCategories';

interface SubmittedIdea {
  id: string;
  title: string;
  content: string | null;
  deposit_idea_category: string | null;
  deposit_idea_approved: boolean;
  created_at: string;
  user_id: string;
}

/**
 * Leaders review members' submitted ideas (RLS "Leaders can read deposit ideas") and approve them
 * ("Leaders can approve deposit ideas"; a trigger lets leaders change only the approval).
 * Ideas are not confidential: the author's name is shown.
 */
export function IdeaReviewFeed() {
  const [ideas, setIdeas] = useState<SubmittedIdea[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    loadIdeas();
  }, []);

  const loadIdeas = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('notes')
        .select('id, title, content, deposit_idea_category, deposit_idea_approved, created_at, user_id')
        .eq('deposit_idea', true)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data || []) as SubmittedIdea[];
      setIdeas(rows);

      const ids = [...new Set(rows.map((r) => r.user_id))];
      if (ids.length) {
        const { data: members } = await supabase
          .schema('p0012_rotary')
          .from('members')
          .select('id, first_name, last_name')
          .in('id', ids);
        const map: Record<string, string> = {};
        (members || []).forEach((m) => { map[m.id] = `${m.first_name} ${m.last_name}`; });
        setNames(map);
      }
    } catch (error) {
      console.error('Error loading submitted ideas:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleApproved = async (idea: SubmittedIdea) => {
    setSavingId(idea.id);
    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('notes')
        .update({ deposit_idea_approved: !idea.deposit_idea_approved })
        .eq('id', idea.id);
      if (error) throw error;
      setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, deposit_idea_approved: !i.deposit_idea_approved } : i)));
    } catch (error) {
      console.error('Error updating idea:', error);
      alert('Could not update the idea. Please try again.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (ideas.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-6">No ideas submitted yet</p>;
  }

  return (
    <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
      {ideas.map((idea) => (
        <div key={idea.id} className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-800">{idea.title}</span>
            {idea.deposit_idea_category && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${getCategoryColor(idea.deposit_idea_category)}`}>
                {getCategoryLabel(idea.deposit_idea_category)}
              </span>
            )}
          </div>
          {idea.content && <p className="text-sm text-gray-600 leading-relaxed mb-2">{idea.content}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400">
              {names[idea.user_id] ?? 'A member'} ·{' '}
              {new Date(idea.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <button
              onClick={() => toggleApproved(idea)}
              disabled={savingId === idea.id}
              className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 ${
                idea.deposit_idea_approved
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-[#1B2A4A] text-white hover:bg-[#2D3E5F]'
              }`}
            >
              {idea.deposit_idea_approved ? (
                <>
                  <Check className="w-3 h-3" /> Approved
                </>
              ) : (
                'Approve'
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
