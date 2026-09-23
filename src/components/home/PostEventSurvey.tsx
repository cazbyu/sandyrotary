import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { PostEventSurvey as Survey } from '../../lib/supabase';
import { lastOpenDayLabel } from '../../lib/surveyWindow';
import { findOpenMeetingSurvey, loadMyResponse } from '../../lib/meetingSurvey';

/**
 * Home nudge: when a meeting survey is open and the member hasn't answered, link to the
 * Ideas, Surveys & Suggestions page (the full form, the "Include my name" switch and
 * one-answer-per-member all live there). Renders nothing otherwise.
 */
export function PostEventSurvey() {
  const { member } = useAuth();
  const [survey, setSurvey] = useState<Survey | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!member) return;
      try {
        const open = await findOpenMeetingSurvey();
        if (!open) return;
        const mine = await loadMyResponse(open.id, member.id);
        if (!cancelled && !mine) setSurvey(open);
      } catch (error) {
        console.error('Error loading the meeting survey:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [member?.id]);

  if (!survey) return null;

  return (
    <Link
      to="/deposit-ideas"
      className="mx-4 mt-4 flex items-center gap-3 bg-white rounded-2xl border-2 border-[#1B2A4A] p-4 shadow-sm"
    >
      <div className="w-10 h-10 rounded-full bg-[#1B2A4A] flex items-center justify-center flex-shrink-0">
        <Star className="w-5 h-5 text-[#E0A526] fill-[#E0A526]" />
      </div>
      <div className="flex-1">
        <div className="text-[15px] font-extrabold text-[#1B2A4A]">How was the meeting?</div>
        <div className="text-[13px] text-[#5B6472]">
          Rate the meeting and the meal — open until {lastOpenDayLabel(survey)}.
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-[#5B6472]" />
    </Link>
  );
}
