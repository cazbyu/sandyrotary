import { useState, useEffect } from 'react';
import { Star, Send, CheckCircle2 } from 'lucide-react';
import { supabase, MEETING_RATING_CATEGORIES, SERVICE_RATING_CATEGORIES, FUNDRAISER_RATING_CATEGORIES } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ActivePostSurvey {
  id: string;
  event_type: 'meeting' | 'service' | 'fundraiser';
  event_name: string;
  event_date: string;
}

function getCategoriesForType(eventType: string) {
  switch (eventType) {
    case 'meeting': return MEETING_RATING_CATEGORIES;
    case 'service': return SERVICE_RATING_CATEGORIES;
    case 'fundraiser': return FUNDRAISER_RATING_CATEGORIES;
    default: return MEETING_RATING_CATEGORIES;
  }
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              star <= (hovered || value)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function PostEventSurvey() {
  const { member } = useAuth();
  const [survey, setSurvey] = useState<ActivePostSurvey | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [existingResponse, setExistingResponse] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (member) {
      loadSurvey();
    } else {
      setLoading(false);
    }
  }, [member]);

  const loadSurvey = async () => {
    if (!member) return;

    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('post_event_surveys')
        .select('id, event_type, event_name, event_date')
        .eq('is_active', true)
        .order('event_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) { setLoading(false); return; }

      setSurvey(data);

      const { data: resp } = await supabase
        .schema('p0012_rotary')
        .from('post_event_responses')
        .select('id')
        .eq('survey_id', data.id)
        .eq('member_id', member.id)
        .maybeSingle();

      if (resp) setExistingResponse(true);
    } catch (error) {
      console.error('Error loading post-event survey:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!member || !survey) return;
    const categories = getCategoriesForType(survey.event_type);
    const allRated = categories.every((c) => ratings[c.key] && ratings[c.key] > 0);
    if (!allRated) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('post_event_responses')
        .insert({
          survey_id: survey.id,
          member_id: member.id,
          ratings,
          comment: comment.trim() || null,
        });

      if (error) throw error;
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting post-event response:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (!survey) return null;
  if (existingResponse || submitted) {
    return (
      <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2.5 mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">
            {submitted ? 'Thanks for your feedback!' : 'You\'ve already rated this event'}
          </span>
        </div>
      </div>
    );
  }

  const categories = getCategoriesForType(survey.event_type);
  const allRated = categories.every((c) => ratings[c.key] && ratings[c.key] > 0);
  const titleMap: Record<string, string> = {
    meeting: 'How would you rate today\'s meeting?',
    service: 'How would you rate this service activity?',
    fundraiser: 'How would you rate this fundraiser?',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
      <h3 className="text-sm font-bold text-[#1B2A4A] mb-1">
        {titleMap[survey.event_type] || 'Post-Event Survey'}
      </h3>
      <p className="text-xs text-gray-500 mb-4">{survey.event_name}</p>

      <div className="space-y-3 mb-4">
        {categories.map((cat) => (
          <div key={cat.key} className="flex items-center justify-between">
            <span className="text-sm text-gray-700 font-medium">{cat.label}</span>
            <StarRating
              value={ratings[cat.key] || 0}
              onChange={(v) => setRatings({ ...ratings, [cat.key]: v })}
            />
          </div>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comments / Suggestions (optional)..."
        rows={2}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm resize-none bg-gray-50 mb-3"
      />

      <button
        onClick={handleSubmit}
        disabled={submitting || !allRated}
        className="flex items-center gap-1.5 bg-[#D94F4F] hover:bg-[#c04545] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="w-3.5 h-3.5" />
        {submitting ? 'Submitting...' : 'Submit Ratings'}
      </button>
    </div>
  );
}
