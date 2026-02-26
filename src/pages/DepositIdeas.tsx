import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Lightbulb,
  Plus,
  X,
  CheckCircle2,
  ChevronDown,
  Send,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface DepositIdea {
  id: string;
  title: string;
  content: string;
  deposit_idea_category: string | null;
  deposit_idea_approved: boolean;
  created_at: string;
  member_id: string | null;
  user_id: string;
}

const CATEGORIES = [
  { value: 'service_project', label: 'Service Project' },
  { value: 'fundraising', label: 'Fundraising' },
  { value: 'meeting', label: 'Meeting Structure' },
  { value: 'speaker', label: 'Guest Speaker Suggestion' },
  { value: 'speaker_feedback', label: 'Speaker / Event Feedback' },
  { value: 'committee', label: 'Committee Interest' },
  { value: 'other', label: 'Other' },
];

function getCategoryLabel(value: string | null) {
  if (!value) return 'General';
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function getCategoryColor(value: string | null) {
  switch (value) {
    case 'service_project':
      return 'bg-teal-100 text-teal-700';
    case 'fundraising':
      return 'bg-green-100 text-green-700';
    case 'meeting':
      return 'bg-blue-100 text-blue-700';
    case 'speaker':
      return 'bg-amber-100 text-amber-700';
    case 'speaker_feedback':
      return 'bg-orange-100 text-orange-700';
    case 'committee':
      return 'bg-sky-100 text-sky-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function DepositIdeas() {
  const navigate = useNavigate();
  const { user, member } = useAuth();
  const [approvedIdeas, setApprovedIdeas] = useState<DepositIdea[]>([]);
  const [myIdeas, setMyIdeas] = useState<DepositIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadIdeas();
  }, [user]);

  const loadIdeas = async () => {
    if (!user) return;
    try {
      const [approvedRes, myRes] = await Promise.all([
        supabase
          .schema('p0012_rotary')
          .from('notes')
          .select('*')
          .eq('deposit_idea', true)
          .eq('deposit_idea_approved', true)
          .order('created_at', { ascending: false }),
        supabase
          .schema('p0012_rotary')
          .from('notes')
          .select('*')
          .eq('deposit_idea', true)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (approvedRes.error) throw approvedRes.error;
      if (myRes.error) throw myRes.error;

      setApprovedIdeas(approvedRes.data || []);
      setMyIdeas(myRes.data || []);
    } catch (error) {
      console.error('Error loading deposit ideas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;

    setSubmitting(true);
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
      setShowForm(false);
      setSuccessMsg('Your idea has been submitted for review!');
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadIdeas();
    } catch (error) {
      console.error('Error submitting idea:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F5F7FA]">
        <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Deposit Ideas</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            {showForm ? (
              <X className="w-5 h-5 text-white" />
            ) : (
              <Plus className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        <div className="p-4">
          <div className="bg-white rounded-xl p-4 mb-4 border-l-4 border-[#D94F4F]">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-[#D94F4F] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Share suggestions that could improve or add value to our club.
                  Think service project ideas, fundraising concepts, meeting structure
                  improvements, guest speaker suggestions, feedback on events, or
                  committees you'd love to be a part of.
                </p>
              </div>
            </div>
          </div>

          {successMsg && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-green-700 text-sm">{successMsg}</p>
            </div>
          )}

          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-xl p-5 mb-4 shadow-sm"
            >
              <h3 className="font-semibold text-[#1B2A4A] mb-4">Submit an Idea</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Brief summary of your idea"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm appearance-none bg-white"
                    >
                      <option value="">Select a category...</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Details
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    placeholder="Describe your idea in more detail..."
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm resize-none"
                  />
                </div>

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

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
                <p className="mt-4 text-gray-600">Loading ideas...</p>
              </div>
            </div>
          ) : (
            <>
              {approvedIdeas.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-[#1B2A4A] mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    Approved Ideas
                  </h2>
                  <div className="space-y-3">
                    {approvedIdeas.map((idea) => (
                      <div
                        key={idea.id}
                        className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-semibold text-gray-800">
                            {idea.title}
                          </h3>
                          {idea.deposit_idea_category && (
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${getCategoryColor(
                                idea.deposit_idea_category
                              )}`}
                            >
                              {getCategoryLabel(idea.deposit_idea_category)}
                            </span>
                          )}
                        </div>
                        {idea.content && (
                          <p className="text-gray-600 text-sm leading-relaxed">
                            {idea.content}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          {formatDate(idea.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-lg font-bold text-[#1B2A4A] mb-3">
                  My Submissions
                </h2>
                {myIdeas.length === 0 ? (
                  <div className="bg-white rounded-xl p-6 text-center">
                    <Lightbulb className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">
                      You haven't submitted any ideas yet. Tap the + button to
                      share your first idea!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myIdeas.map((idea) => (
                      <div
                        key={idea.id}
                        className="bg-white rounded-xl p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <h3 className="font-semibold text-gray-800">
                            {idea.title}
                          </h3>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {idea.deposit_idea_category && (
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${getCategoryColor(
                                  idea.deposit_idea_category
                                )}`}
                              >
                                {getCategoryLabel(idea.deposit_idea_category)}
                              </span>
                            )}
                            {idea.deposit_idea_approved ? (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                Approved
                              </span>
                            ) : (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                        {idea.content && (
                          <p className="text-gray-600 text-sm leading-relaxed">
                            {idea.content}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          {formatDate(idea.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
