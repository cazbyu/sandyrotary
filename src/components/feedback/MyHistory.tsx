import { forwardRef, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getCategoryLabel } from '../../lib/ideaCategories';

type Kind = 'survey' | 'idea' | 'suggestion';
type Filter = 'all' | Kind;

interface HistoryItem {
  key: string;
  kind: Kind;
  typeLabel: string;
  title: string;
  meta: string;
  badge: string;
  at: string;
}

const CHIP_COLORS: Record<Kind, string> = {
  survey: 'bg-[#E6EAF2] text-[#1B2A4A]',
  idea: 'bg-[#EFE8F7] text-[#5B3B8C]',
  suggestion: 'bg-[#EEF0F3] text-[#434B57]',
};

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['survey', 'Surveys'],
  ['idea', 'Ideas'],
  ['suggestion', 'Suggestions'],
];

interface SurveyRow {
  id: string;
  ratings: Record<string, number> | null;
  share_name: boolean;
  created_at: string;
  survey: { event_name: string; event_date: string } | { event_name: string; event_date: string }[] | null;
}
interface IdeaRow {
  id: string;
  title: string;
  deposit_idea_category: string | null;
  deposit_idea_approved: boolean;
  created_at: string;
}
interface SuggestionRow {
  id: string;
  suggestion_text: string;
  share_with_leadership: boolean;
  share_name: boolean;
  created_at: string;
}

const stars = (n?: number) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '–');
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const eventDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

interface Props {
  memberId: string;
  userId: string;
  /** Bump to reload after the member submits something. */
  refreshKey: number;
}

/** The member's own surveys, ideas and suggestions. Only the member can read these rows (RLS). */
export const MyHistory = forwardRef<HTMLElement, Props>(function MyHistory({ memberId, userId, refreshKey }, ref) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [memberId, userId, refreshKey]);

  const load = async () => {
    try {
      const [surveysRes, ideasRes, suggestionsRes] = await Promise.all([
        supabase
          .schema('p0012_rotary')
          .from('post_event_responses')
          .select('id, ratings, share_name, created_at, survey:survey_id(event_name, event_date)')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .schema('p0012_rotary')
          .from('notes')
          .select('id, title, deposit_idea_category, deposit_idea_approved, created_at')
          .eq('user_id', userId)
          .eq('deposit_idea', true)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .schema('p0012_rotary')
          .from('member_suggestions')
          .select('id, suggestion_text, share_with_leadership, share_name, created_at')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      const all: HistoryItem[] = [];
      for (const r of (surveysRes.data || []) as unknown as SurveyRow[]) {
        const s = Array.isArray(r.survey) ? r.survey[0] : r.survey;
        all.push({
          key: `s-${r.id}`,
          kind: 'survey',
          typeLabel: 'Survey',
          // Leader-made survey names already carry the date ("Weekly Meeting - Wed, Sep 23").
          title: s
            ? /\b[A-Z][a-z]{2} \d{1,2}\b/.test(s.event_name) ? s.event_name : `${eventDay(s.event_date)} · ${s.event_name}`
            : 'Meeting survey',
          meta: `Speaker/Program ${stars(r.ratings?.speaker ?? undefined)} · Meal ${stars(r.ratings?.meal ?? undefined)}`,
          badge: r.share_name ? 'Name shared' : 'No name',
          at: r.created_at,
        });
      }
      for (const n of (ideasRes.data || []) as IdeaRow[]) {
        all.push({
          key: `i-${n.id}`,
          kind: 'idea',
          typeLabel: n.deposit_idea_category ? getCategoryLabel(n.deposit_idea_category) : 'Idea',
          title: n.title,
          meta: `Submitted ${shortDate(n.created_at)}`,
          badge: n.deposit_idea_approved ? 'Approved' : 'In review',
          at: n.created_at,
        });
      }
      for (const q of (suggestionsRes.data || []) as SuggestionRow[]) {
        const text: string = q.suggestion_text || '';
        all.push({
          key: `q-${q.id}`,
          kind: 'suggestion',
          typeLabel: 'Suggestion',
          title: text.length > 120 ? `${text.slice(0, 120).trimEnd()}…` : text,
          meta: q.share_with_leadership
            ? `Sent to leadership${q.share_name ? ' with your name' : ' without your name'} · ${shortDate(q.created_at)}`
            : `Private note · ${shortDate(q.created_at)}`,
          badge: q.share_with_leadership ? 'Shared with leadership' : 'Only you',
          at: q.created_at,
        });
      }
      all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setItems(all);
    } catch (e) {
      console.error('Error loading history:', e);
    } finally {
      setLoading(false);
    }
  };

  const shown = items.filter((i) => filter === 'all' || i.kind === filter);

  return (
    <section ref={ref} aria-labelledby="history-title" className="bg-white rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex justify-between items-baseline">
        <h3 id="history-title" className="m-0 text-lg font-extrabold text-[#1B2A4A]">My history</h3>
        <span className="text-[13px] text-[#5B6472]">Only you see this list</span>
      </div>
      <div role="group" aria-label="Filter history" className="flex gap-2 flex-wrap">
        {FILTERS.map(([key, label]) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(key)}
              className={`h-9 px-3.5 rounded-full border text-sm font-bold ${
                active ? 'bg-[#1B2A4A] text-white border-[#1B2A4A]' : 'bg-white text-[#1B2A4A] border-[#CBD2DC]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="h-[340px] overflow-y-auto flex flex-col gap-2.5 pr-1">
        {loading ? (
          <p className="text-sm text-[#5B6472] text-center py-6">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-[#5B6472] text-center py-6">Nothing here yet.</p>
        ) : (
          shown.map((h) => (
            <article key={h.key} className="border border-[#E3E7ED] rounded-xl p-3 flex flex-col gap-1.5">
              <div className="flex justify-between items-center gap-2">
                <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${CHIP_COLORS[h.kind]}`}>{h.typeLabel}</span>
                <span className="text-xs font-bold text-[#5B6472] text-right">{h.badge}</span>
              </div>
              <div className="text-[15px] font-bold text-[#1B2A4A] break-words">{h.title}</div>
              <div className="text-[13px] text-[#5B6472]">{h.meta}</div>
            </article>
          ))
        )}
      </div>
    </section>
  );
});
