import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ChevronDown, Lightbulb, ListChecks, Loader2, MessageSquare } from 'lucide-react';
import {
  supabase,
  PostEventResults,
  MEETING_RATING_CATEGORIES,
  SERVICE_RATING_CATEGORIES,
  FUNDRAISER_RATING_CATEGORIES,
} from '../../lib/supabase';
import { clubDateString, eventDateLabel, lastOpenDayLabel } from '../../lib/surveyWindow';
import { PulseChart } from './PulseChart';
import { SuggestionFeed } from './SuggestionFeed';
import { IdeaReviewFeed } from './IdeaReviewFeed';
import { useAuth } from '../../contexts/AuthContext';

type InsightTab = 'meetings' | 'service' | 'fundraisers';

interface SurveyOption {
  id: string;
  event_name: string;
  event_date: string;
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

function stars(n: number | undefined) {
  if (!n) return '';
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

/**
 * Leader view of post-event feedback. Reads only p0012_rotary.post_event_results(), which never
 * returns member ids or timestamps: while a survey is open it gives the count and comments from
 * members who shared their name; after it closes, averages and unnamed comments once 3+ members
 * (other than the viewer) answered without their name.
 */
export function InsightDashboardCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InsightTab>('meetings');
  const [surveys, setSurveys] = useState<SurveyOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [results, setResults] = useState<PostEventResults | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [savingIdea, setSavingIdea] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) loadSurveys(activeTab);
  }, [activeTab, isOpen]);

  useEffect(() => {
    if (selectedId) loadResults(selectedId);
    else setResults(null);
  }, [selectedId]);

  const loadSurveys = async (tab: InsightTab) => {
    setLoadingInsights(true);
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('post_event_surveys')
        .select('id, event_name, event_date')
        .eq('event_type', getEventType(tab))
        .lte('event_date', clubDateString())
        .order('event_date', { ascending: false })
        .limit(12);
      if (error) throw error;
      setSurveys(data || []);
      setSelectedId(data && data.length > 0 ? data[0].id : '');
      if (!data || data.length === 0) setResults(null);
    } catch (error) {
      console.error('Error loading surveys:', error);
    } finally {
      setLoadingInsights(false);
    }
  };

  const loadResults = async (surveyId: string) => {
    setLoadingInsights(true);
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .rpc('post_event_results', { p_survey_id: surveyId });
      if (error) throw error;
      setResults(data as PostEventResults | null);
    } catch (error) {
      console.error('Error loading survey results:', error);
      setResults(null);
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleAddToIdeaJar = async (text: string, index: number) => {
    if (!user || !results) return;
    setSavingIdea(index);
    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('idea_jar')
        .insert({
          title: text.substring(0, 100),
          description: text,
          source_type: 'survey_comment',
          source_id: results.survey_id,   // the survey, never the answer (answers stay unlinked from members)
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

  const handleProposedAction = (text: string) => {
    navigate('/admin/leadership-actions', { state: { prefill: text } });
  };

  const tabs: { key: InsightTab; label: string }[] = [
    { key: 'meetings', label: 'Meetings' },
    { key: 'service', label: 'Service' },
    { key: 'fundraisers', label: 'Fundraisers' },
  ];
  const categories = getCategoriesForType(activeTab);

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

      {/* Post-event feedback */}
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          {activeTab === 'meetings' ? 'Meeting Feedback' : 'Event Feedback'}
        </h3>

        {surveys.length === 0 && !loadingInsights ? (
          <p className="text-sm text-gray-500 text-center py-4">No surveys yet</p>
        ) : (
          <>
            <label htmlFor="insight-survey" className="sr-only">Meeting</label>
            <select
              id="insight-survey"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full h-11 border border-gray-300 rounded-lg px-3 text-sm font-semibold text-[#1B2A4A] bg-white mb-4"
            >
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>
                  {eventDateLabel(s.event_date)} · {s.event_name}
                </option>
              ))}
            </select>

            {loadingInsights ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : results ? (
              <>
                {!results.closed ? (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-4">
                    Open until {lastOpenDayLabel(results)} · {results.count}{' '}
                    {results.count === 1 ? 'response' : 'responses'} so far. Results appear after the survey closes.
                  </p>
                ) : !results.results_visible ? (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-4">
                    {results.count} {results.count === 1 ? 'response' : 'responses'}. Results appear after 3.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {categories.map((c) => {
                        const a = results.averages?.[c.key];
                        return (
                          <div key={c.key} className="bg-gray-50 rounded-xl p-3">
                            <div className="text-xs font-semibold text-gray-500">{c.label}</div>
                            <div className="text-2xl font-extrabold text-[#1B2A4A]">{a ? a.avg.toFixed(1) : '–'}</div>
                            <div className="text-xs text-gray-500">
                              {a ? `out of 5 · ${a.n} ${a.n === 1 ? 'response' : 'responses'}` : 'Not enough answers yet'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {categories.map((c) => {
                      const d = results.distribution?.[c.key];
                      if (!d || !d.n) return null;
                      return (
                        <div key={c.key} className="mb-4">
                          <div className="text-sm font-semibold text-[#1B2A4A] mb-2">{c.label} ratings</div>
                          {(['5', '4', '3', '2', '1'] as const).map((k) => (
                            <div key={k} className="flex items-center gap-2 mb-1">
                              <span className="w-7 text-xs font-semibold text-gray-600">{k}★</span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-[#1B2A4A] rounded-full" style={{ width: `${(d[k] / d.n) * 100}%` }} />
                              </div>
                              <span className="w-6 text-right text-xs text-gray-500">{d[k]}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Comments */}
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Comments</h4>
                </div>
                {results.comments.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-3">No comments to show</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                    {results.comments.map((c, i) => (
                      <div key={i} className={`rounded-lg p-3 border ${c.name ? 'border-[#1B2A4A]' : 'border-gray-200'}`}>
                        <p className="text-xs font-semibold text-gray-600 mb-1">
                          {c.name
                            ? `${c.name} (chose to share)${categories
                                .map((cat) => (c.ratings?.[cat.key] ? ` · ${cat.label} ${stars(c.ratings?.[cat.key])}` : ''))
                                .join('')}`
                            : 'A member'}
                        </p>
                        <p className="text-sm text-gray-800 leading-relaxed mb-2">{c.text}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddToIdeaJar(c.text, i)}
                            disabled={savingIdea === i}
                            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            <Lightbulb className="w-3 h-3" />
                            {savingIdea === i ? 'Saving...' : 'Idea Jar'}
                          </button>
                          <button
                            onClick={() => handleProposedAction(c.text)}
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
                <p className="text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg p-3 mt-4 leading-relaxed">
                  Names appear only when a member turns on "Include my name." Averages and other comments
                  appear after the survey closes, once at least 3 members (not counting you) answered without their name.
                </p>
              </>
            ) : null}
          </>
        )}
      </div>

      <hr className="border-gray-100 mb-5" />

      {/* Submitted ideas */}
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Submitted Ideas
        </h3>
        <IdeaReviewFeed />
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
