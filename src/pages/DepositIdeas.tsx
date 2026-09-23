import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronDown, Send } from 'lucide-react';
import { Layout } from '../components/Layout';
import { BottomNav } from '../components/BottomNav';
import { SuggestionBox } from '../components/home/SuggestionBox';
import { TodaysMeetingCard } from '../components/feedback/TodaysMeetingCard';
import { MyHistory } from '../components/feedback/MyHistory';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  IDEA_CATEGORIES,
  IMPACT_STORY_PLACEHOLDER,
  getCategoryColor,
  getCategoryLabel,
} from '../lib/ideaCategories';

interface ApprovedIdea {
  id: string;
  title: string;
  content: string | null;
  deposit_idea_category: string | null;
  created_at: string;
}

type Panel = 'idea' | 'suggestion' | null;

/**
 * Ideas, Surveys & Suggestions (route /deposit-ideas).
 * Today's Meeting survey at the top, then "Share an idea" / "Quick suggestion", then My history.
 * /deposit-ideas?survey=<id> highlights that survey (for WhatsApp links).
 */
export function DepositIdeas() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, member } = useAuth();
  const [panel, setPanel] = useState<Panel>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [approvedIdeas, setApprovedIdeas] = useState<ApprovedIdea[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [ideaError, setIdeaError] = useState('');

  const deepLinkSurveyId = searchParams.get('survey');
  const refreshHistory = () => setHistoryKey((k) => k + 1);

  useEffect(() => {
    loadApprovedIdeas();
  }, [user]);

  const loadApprovedIdeas = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .schema('p0012_rotary')
      .from('notes')
      .select('id, title, content, deposit_idea_category, created_at')
      .eq('deposit_idea', true)
      .eq('deposit_idea_approved', true)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) console.error('Error loading approved ideas:', error);
    setApprovedIdeas((data as ApprovedIdea[] | null) || []);
  };

  const handleSubmitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;

    setSubmitting(true);
    setIdeaError('');
    try {
      const { error } = await supabase.schema('p0012_rotary').from('notes').insert({
        user_id: user.id,
        member_id: member?.id || null,
        title: title.trim(),
        content: content.trim(),
        deposit_idea: true,
        deposit_idea_category: category || null,
      });
      if (error) throw error;

      setTitle('');
      setContent('');
      setCategory('');
      setPanel(null);
      setSuccessMsg('Your idea has been submitted for review!');
      setTimeout(() => setSuccessMsg(''), 4000);
      refreshHistory();
    } catch (error) {
      console.error('Error submitting idea:', error);
      setIdeaError('Your idea was not sent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F4F5F8] pb-20">
        <div className="bg-[#1B2A4A] px-4 py-3.5 flex items-center gap-3 rounded-b-2xl">
          <button
            // Opened straight from a link (e.g. WhatsApp): there is no page to go back to.
            onClick={() => (location.key === 'default' ? navigate('/') : navigate(-1))}
            aria-label="Back"
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-extrabold text-white flex-1 leading-tight">Ideas, Surveys &amp; Suggestions</h1>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {member && (
            <TodaysMeetingCard memberId={member.id} deepLinkSurveyId={deepLinkSurveyId} onSaved={refreshHistory} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              aria-expanded={panel === 'idea'}
              onClick={() => togglePanel('idea')}
              className={`h-14 rounded-2xl text-[15px] font-extrabold flex items-center justify-center gap-2 ${
                panel === 'idea' ? 'bg-[#1B2A4A] text-white' : 'bg-white text-[#1B2A4A]'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={panel === 'idea' ? '#FFFFFF' : '#C44444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" /></svg>
              Share an idea
            </button>
            <button
              type="button"
              aria-expanded={panel === 'suggestion'}
              onClick={() => togglePanel('suggestion')}
              className={`h-14 rounded-2xl text-[15px] font-extrabold flex items-center justify-center gap-2 ${
                panel === 'suggestion' ? 'bg-[#1B2A4A] text-white' : 'bg-white text-[#1B2A4A]'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={panel === 'suggestion' ? '#FFFFFF' : '#C44444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              Quick suggestion
            </button>
          </div>

          {successMsg && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-green-700 text-sm">{successMsg}</p>
            </div>
          )}

          {panel === 'idea' && (
            <form onSubmit={handleSubmitIdea} className="bg-white rounded-2xl p-5">
              <h3 className="font-extrabold text-[#1B2A4A] mb-4">Share an idea</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="idea-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    id="idea-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Brief summary of your idea"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C44444] focus:border-transparent outline-none transition text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="idea-category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <div className="relative">
                    <select
                      id="idea-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C44444] focus:border-transparent outline-none transition text-sm appearance-none bg-white"
                    >
                      <option value="">Select a category...</option>
                      {IDEA_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label htmlFor="idea-details" className="block text-sm font-medium text-gray-700 mb-1">Details</label>
                  <textarea
                    id="idea-details"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    placeholder={category === 'impact_story' ? IMPACT_STORY_PLACEHOLDER : 'Describe your idea in more detail...'}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C44444] focus:border-transparent outline-none transition text-sm resize-none"
                  />
                </div>
                {ideaError && <p role="alert" className="text-sm font-semibold text-[#C44444]">{ideaError}</p>}
                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="w-full bg-[#1B2A4A] hover:bg-[#2D3E5F] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Submitting...' : 'Submit Idea'}
                </button>
              </div>
            </form>
          )}

          {panel === 'suggestion' && (
            <div className="bg-white rounded-2xl p-5">
              <h3 className="font-extrabold text-[#1B2A4A] mb-3">Quick suggestion</h3>
              <SuggestionBox showList={false} onSubmitted={refreshHistory} />
            </div>
          )}

          {member && user && <MyHistory memberId={member.id} userId={user.id} refreshKey={historyKey} />}

          {approvedIdeas.length > 0 && (
            <section aria-labelledby="approved-title" className="bg-white rounded-2xl p-4">
              <h3 id="approved-title" className="text-lg font-extrabold text-[#1B2A4A] mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Approved ideas
              </h3>
              <div className="space-y-3">
                {approvedIdeas.map((idea) => (
                  <div key={idea.id} className="border border-[#E3E7ED] rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h4 className="font-bold text-[#1B2A4A]">{idea.title}</h4>
                      {idea.deposit_idea_category && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${getCategoryColor(idea.deposit_idea_category)}`}>
                          {getCategoryLabel(idea.deposit_idea_category)}
                        </span>
                      )}
                    </div>
                    {idea.content && <p className="text-gray-600 text-sm leading-relaxed">{idea.content}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
      <BottomNav />
    </Layout>
  );
}
