import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ActiveSurvey {
  id: string;
  question_text: string;
  meeting_date: string;
}

export function WeeklyPulse() {
  const { member } = useAuth();
  const [survey, setSurvey] = useState<ActiveSurvey | null>(null);
  const [existingRating, setExistingRating] = useState<number | null>(null);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(0);
  const [submitted, setSubmitted] = useState(false);
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
      const { data: surveyData, error: surveyError } = await supabase
        .schema('p0012_rotary')
        .from('weekly_surveys')
        .select('id, question_text, meeting_date')
        .eq('is_active', true)
        .order('meeting_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (surveyError) throw surveyError;
      if (!surveyData) {
        setLoading(false);
        return;
      }

      setSurvey(surveyData);

      const { data: responseData, error: responseError } = await supabase
        .schema('p0012_rotary')
        .from('survey_responses')
        .select('rating')
        .eq('survey_id', surveyData.id)
        .eq('member_id', member.id)
        .maybeSingle();

      if (responseError) throw responseError;

      if (responseData) {
        setExistingRating(responseData.rating);
      }
    } catch (error) {
      console.error('Error loading survey:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (rating: number) => {
    if (!member || !survey) return;

    setSelectedStar(rating);

    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('survey_responses')
        .insert({
          survey_id: survey.id,
          member_id: member.id,
          rating,
        });

      if (error) throw error;

      setSubmitted(true);
      setExistingRating(rating);
    } catch (error) {
      console.error('Error submitting survey response:', error);
      setSelectedStar(0);
    }
  };

  if (loading) return null;
  if (!survey) return null;

  if (existingRating !== null) {
    return (
      <div className="mb-3">
        <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full">
          You rated: {'★'.repeat(existingRating)}{'☆'.repeat(5 - existingRating)}
        </span>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mb-3">
        <p className="text-sm text-green-600 font-medium">Thanks for your feedback!</p>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <p className="text-sm text-gray-700 mb-2">{survey.question_text}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleSubmit(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="p-0.5 transition-transform hover:scale-110"
            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                star <= (hoveredStar || selectedStar)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
