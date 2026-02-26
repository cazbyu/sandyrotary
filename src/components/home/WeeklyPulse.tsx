import { useState, useEffect } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ActiveSurvey {
  id: string;
  question_text: string;
  meeting_date: string;
  choices: string[] | null;
}

interface ExistingResponse {
  choice_index: number | null;
  comment: string | null;
}

function getSundayBefore(meetingDateStr: string): Date {
  const meetingDate = new Date(meetingDateStr + 'T00:00:00');
  const dayOfWeek = meetingDate.getDay(); // Wed = 3
  const daysBack = (dayOfWeek + 7 - 0) % 7; // Days back to Sunday
  const sunday = new Date(meetingDate);
  sunday.setDate(meetingDate.getDate() - daysBack);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

export function WeeklyPulse() {
  const { member } = useAuth();
  const [survey, setSurvey] = useState<ActiveSurvey | null>(null);
  const [existingResponse, setExistingResponse] = useState<ExistingResponse | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [comment, setComment] = useState('');
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
      const { data: surveyData, error: surveyError } = await supabase
        .schema('p0012_rotary')
        .from('weekly_surveys')
        .select('id, question_text, meeting_date, choices')
        .eq('is_active', true)
        .order('meeting_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (surveyError) throw surveyError;
      if (!surveyData) {
        setLoading(false);
        return;
      }

      // Check if today is on or after the Sunday before the meeting
      const sundayBefore = getSundayBefore(surveyData.meeting_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (today < sundayBefore) {
        // Survey not available yet
        setLoading(false);
        return;
      }

      setSurvey(surveyData);

      const { data: responseData, error: responseError } = await supabase
        .schema('p0012_rotary')
        .from('survey_responses')
        .select('choice_index, comment')
        .eq('survey_id', surveyData.id)
        .eq('member_id', member.id)
        .maybeSingle();

      if (responseError) throw responseError;

      if (responseData) {
        setExistingResponse(responseData);
      }
    } catch (error) {
      console.error('Error loading survey:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!member || !survey) return;
    if (survey.choices && survey.choices.length > 0 && selectedChoice === null && !comment.trim()) return;

    setSubmitting(true);

    try {
      // Insert into survey_responses
      const { error: responseError } = await supabase
        .schema('p0012_rotary')
        .from('survey_responses')
        .insert({
          survey_id: survey.id,
          member_id: member.id,
          choice_index: selectedChoice,
          comment: comment.trim() || null,
        });

      if (responseError) throw responseError;

      // Also record in notes table with pre_mtg_survey date
      const { error: noteError } = await supabase
        .schema('p0012_rotary')
        .from('notes')
        .insert({
          user_id: member.id,
          member_id: member.id,
          title: 'Pre-Meeting Survey Response',
          content: buildNoteContent(),
          pre_mtg_survey: survey.meeting_date,
        });

      if (noteError) {
        console.error('Error creating survey note:', noteError);
        // Don't fail the whole submission if note creation fails
      }

      setSubmitted(true);
      setExistingResponse({
        choice_index: selectedChoice,
        comment: comment.trim() || null,
      });
    } catch (error) {
      console.error('Error submitting survey response:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const buildNoteContent = (): string => {
    const parts: string[] = [];
    parts.push(`Q: ${survey?.question_text}`);
    if (selectedChoice !== null && survey?.choices) {
      parts.push(`A: ${survey.choices[selectedChoice]}`);
    }
    if (comment.trim()) {
      parts.push(`Comment: ${comment.trim()}`);
    }
    return parts.join('\n');
  };

  if (loading) return null;
  if (!survey) return null;

  // Already responded
  if (existingResponse !== null) {
    return (
      <div className="mb-3">
        <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Survey Completed</span>
          </div>
          {existingResponse.choice_index !== null && survey.choices && (
            <p className="text-xs text-green-600 ml-6">
              Your answer: {survey.choices[existingResponse.choice_index]}
            </p>
          )}
          {existingResponse.comment && (
            <p className="text-xs text-green-600 ml-6 mt-0.5">
              Comment: {existingResponse.comment}
            </p>
          )}
        </div>
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

  const hasChoices = survey.choices && survey.choices.length > 0;

  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-gray-700 mb-3">{survey.question_text}</p>

      {/* Multiple Choice Options */}
      {hasChoices && (
        <div className="space-y-2 mb-3">
          {survey.choices!.map((choice, index) => (
            <button
              key={index}
              onClick={() => setSelectedChoice(selectedChoice === index ? null : index)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                selectedChoice === index
                  ? 'border-[#D94F4F] bg-red-50 text-[#D94F4F] font-medium'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedChoice === index
                      ? 'border-[#D94F4F]'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedChoice === index && (
                    <span className="w-2 h-2 rounded-full bg-[#D94F4F]" />
                  )}
                </span>
                {choice}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Comment Area */}
      <div className="mb-3">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={hasChoices ? 'Add a comment (optional)...' : 'Share your thoughts...'}
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm resize-none bg-gray-50"
        />
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={submitting || (hasChoices && selectedChoice === null && !comment.trim())}
        className="flex items-center gap-1.5 bg-[#D94F4F] hover:bg-[#c04545] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="w-3.5 h-3.5" />
        {submitting ? 'Submitting...' : 'Submit Response'}
      </button>
    </div>
  );
}
