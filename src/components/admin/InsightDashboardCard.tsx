import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ChevronDown, Lightbulb, ListChecks, Loader2, MessageSquare } from 'lucide-react';
import { supabase, MEETING_RATING_CATEGORIES, SERVICE_RATING_CATEGORIES, FUNDRAISER_RATING_CATEGORIES } from '../../lib/supabase';
import { PulseChart } from './PulseChart';
import { SuggestionFeed } from './SuggestionFeed';
import { useAuth } from '../../contexts/AuthContext';

type InsightTab = 'meetings' | 'service' | 'fundraisers';

interface EventComment {
  id: string;
  survey_id: string;
  member_id: string;
  comment: string;
  event_name: string;
  event_type: string;
  created_at: string;
  member_name?: string;
}

interface RatingAvg {
  category: string;
  label: string;
  avg: number;
}

function getCategoriesForType(type: InsightTab) {
  switch (type) {
    case 'meetings': return MEETING_RATING_CATEGORIES;
    case 'service': return SERVICE_RATING_CATEGORIES;
    case 'fundraisers': return FUNDRAISER_RATING_CATEGORIES;
  }
}

function getEventType(tab: InsightTab): string {
  switch (tab) {
    case 'meetings': return 'meeting';
    case 'service': return 'service';
    case 'fundraisers': return 'fundraiser';
  }
}

export function InsightDashboardCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InsightTab>('meetings');
  const [comments, setComments] = useState<EventComment[]>([]);
  const [ratingAvgs, setRatingAvgs] = useState<RatingAvg[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [savingIdea, setSavingIdea] = useState<string | null>(null);

  useEffect(() => {
    loadInsights(activeTab);
  }, [activeTab]);

  const loadInsights = async (tab: InsightTab) => {
    setLoadingInsights(true);
    const eventType = getEventType(tab);
    const categories = getCategoriesForType(tab);

    try {
      const { data: surveys, error: sError } = await supabase
        .schema('p0012_rotary')
        .from('post_event_surveys')
        .select('id, event_name, event_type, event_date')
        .eq('event_type', eventType)
        .order('event_date', { ascending: false })
        .limit(10);

      if (sError) throw sError;
      if (!surveys || surveys.length === 0) {
        setComments([]);
        setRatingAvgs([]);
        setLoadingInsights(false);
        return;
      }

      const surveyIds = surveys.map((s) => s.id);
      const surveyMap: Record<string, { event_name: string; event_type: string }> = {};
      surveys.forEach((s) => { surveyMap[s.id] = { event_name: s.event_name, event_type: s.event_type }; });

      const { data: responses, error: rError } = await supabase
        .schema('p0012_rotary')
        .from('post_event_responses')
        .select('id, survey_id, member_id, ratings, comment, created_at')
        .in('survey_id', surveyIds);

      if (rError) throw rError;

      // Calculate average ratings
      const totals: Record<string, { sum: number; count: number }> = {};
      categories.forEach((c) => { totals[c.key] = { sum: 0, count: 0 }; });

      (responses || []).forEach((r) => {
        if (r.ratings && typeof r.ratings === 'object') {
          categories.forEach((c) => {
            const val = (r.ratings as Record<string, number>)[c.key];
            if (val && val > 0) {
              totals[c.key].sum += val;
              totals[c.key].count += 1;
            }
          });
        }
      });

      setRatingAvgs(categories.map((c) => ({
        category: c.key,
        label: c.label,
        avg: totals[c.key].count > 0 ? Math.round((totals[c.key].sum / totals[c.key].count) * 10) / 10 : 0,
      })));

      // Collect comments
      const commentsArr: EventComment[] = [];
      for (const r of (responses || [])) {
        if (r.comment && r.comment.trim()) {
          const info = surveyMap[r.survey_id];
          commentsArr.push({
            id: r.id,
            survey_id: r.survey_id,
            member_id: r.member_id,
            comment: r.comment,
            event_name: info?.event_name || '',
            event_type: info?.event_type || eventType,
            created_at: r.created_at,
          });
        }
      }

      // Resolve member names
      const memberIds = [...new Set(commentsArr.map((c) => c.member_id))];
      if (memberIds.length > 0) {
        const { data: members } = await supabase
          .schema('p0012_rotary')
          .from('members')
          .select('id, first_name, last_name')
          .in('id', memberIds);

        const nameMap: Record<string, string> = {};
        (members || []).forEach((m) => { nameMap[m.id] = `${m.first_name} ${m.last_name}`; });
        commentsArr.forEach((c) => { c.member_name = nameMap[c.member_id] || 'Member'; });
      }

      setComments(commentsArr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleAddToIdeaJar = async (c: EventComment) => {
    if (!user) return;
    setSavingIdea(c.id);
    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('idea_jar')
        .insert({
          title: c.comment.substring(0, 100),
          description: c.comment,
          source_type: 'survey_comment',
          source_id: c.id,
          created_by: user.id,
        });
      if (error) throw error;
      alert('Added to Idea Jar!');
    } catch (error) {
      console.error('Error adding to idea jar:', error);
    } finally {
      setSavingIdea(null);
    }
  };

  const handleProposedAction = (c: EventComment) => {
    navigate('/admin/leadership-actions', { state: { prefill: c.comment } });
  };

  const formatRelativeTime = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const tabs: { key: InsightTab; label: string }[] = [
    { key: 'meetings', label: 'Meetings' },
    { key: 'service', label: 'Service' },
    { key: 'fundraisers', label: 'Fundraisers' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-md p-5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-full bg-[#1B2A4A] flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-lg font-bold text-[#1B2A4A] flex-1 text-left">Insight Dashboard</h2>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (<div className="mt-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-[#1B2A4A] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pre-Meeting Survey Trends (meetings tab only) */}
      {activeTab === 'meetings' && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Pre-Meeting Survey Trends
          </h3>
          <PulseChart />
          <hr className="border-gray-100 my-5" />
        </div>
      )}

      {/* Rating Averages */}
      {loadingInsights ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : ratingAvgs.some((r) => r.avg > 0) ? (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Average Ratings
          </h3>
          <div className="space-y-2">
            {ratingAvgs.map((r) => (
              <div key={r.category} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-36">{r.label}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#D94F4F] rounded-full transition-all"
                    style={{ width: `${(r.avg / 5) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-700 w-8 text-right">
                  {r.avg > 0 ? r.avg : '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 text-center py-4 mb-4">
          No post-event survey data yet
        </p>
      )}

      <hr className="border-gray-100 mb-5" />

      {/* Comments & Feedback */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Comments &amp; Feedback
          </h3>
        </div>

        {comments.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No comments yet</p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
            {comments.map((c) => (
              <div key={c.id} className="border-b border-gray-100 pb-3 last:border-b-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-800">{c.member_name || 'Member'}</span>
                  <span className="text-xs text-gray-400">{formatRelativeTime(c.created_at)}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-1">{c.comment}</p>
                <p className="text-xs text-gray-400 mb-2">{c.event_name}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddToIdeaJar(c)}
                    disabled={savingIdea === c.id}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                  >
                    <Lightbulb className="w-3 h-3" />
                    {savingIdea === c.id ? 'Saving...' : 'Idea Jar'}
                  </button>
                  <button
                    onClick={() => handleProposedAction(c)}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <ListChecks className="w-3 h-3" />
                    Proposed Action
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className="border-gray-100 mb-5" />

      {/* Member Suggestions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Member Suggestions
        </h3>
        <SuggestionFeed />
      </div>
      </div>)}
    </div>
  );
}
