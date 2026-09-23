import { useEffect, useRef, useState } from 'react';
import { supabase, PostEventSurvey, PostEventResponse } from '../../lib/supabase';
import { clubDateString, eventDateLabel, hasSurveyClosed, isSurveyOpen, lastOpenDayLabel } from '../../lib/surveyWindow';
import { findOpenMeetingSurvey, loadMyResponse, loadSurveyById, loadSurveyLabels, SurveyLabels } from '../../lib/meetingSurvey';

type RatingKey = 'speaker' | 'meal';
type LinkNote = null | 'closed' | 'not-open' | 'unavailable';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LINK_NOTES: Record<Exclude<LinkNote, null>, string> = {
  closed: 'That survey has closed. Your past answers are in My history below.',
  'not-open': 'That survey opens when the meeting starts.',
  unavailable: "That survey link isn't available. Your past answers are in My history below.",
};

function StarRow({ value, onChange, what }: { value: number; onChange: (v: number) => void; what: string }) {
  return (
    <div role="group" aria-label={`Rate the ${what}`} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        return (
          <button
            key={n}
            type="button"
            aria-label={`Rate the ${what} ${n} of 5`}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className="w-11 h-11 flex items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B2A4A]"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill={on ? '#E0A526' : 'none'}
                stroke={on ? '#C98E12' : '#8A93A1'}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  memberId: string;
  /** From /deposit-ideas?survey=<id> (a future WhatsApp link). */
  deepLinkSurveyId?: string | null;
  /** Called after an answer is saved, so My history can refresh. */
  onSaved?: () => void;
}

/**
 * Today's Meeting: rate the speaker/program and the meal for the open meeting survey.
 * Answers go to leaders without the member's name unless "Include my name" is on (off by default).
 */
export function TodaysMeetingCard({ memberId, deepLinkSurveyId, onSaved }: Props) {
  const cardRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const thanksRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState<PostEventSurvey | null>(null);
  const [labels, setLabels] = useState<SurveyLabels | null>(null);
  const [linkNote, setLinkNote] = useState<LinkNote>(null);
  const [response, setResponse] = useState<PostEventResponse | null>(null);
  const [editing, setEditing] = useState(true);
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({ speaker: 0, meal: 0 });
  const [comment, setComment] = useState('');
  const [shareName, setShareName] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    load();
  }, [memberId, deepLinkSurveyId]);

  const load = async () => {
    setLoading(true);
    try {
      let chosen: PostEventSurvey | null = null;
      if (deepLinkSurveyId) {
        // A bad or unknown link never hides the open survey: note it and fall through.
        let linked: PostEventSurvey | null = null;
        if (UUID_RE.test(deepLinkSurveyId)) {
          try {
            linked = await loadSurveyById(deepLinkSurveyId);
          } catch {
            linked = null;
          }
        }
        if (linked && isSurveyOpen(linked)) chosen = linked;
        else if (linked && hasSurveyClosed(linked)) setLinkNote('closed');
        else if (linked) setLinkNote('not-open');
        else setLinkNote('unavailable');
      }
      if (!chosen) chosen = await findOpenMeetingSurvey();
      setSurvey(chosen);
      if (!chosen) return;

      const [lbl, mine] = await Promise.all([loadSurveyLabels(chosen), loadMyResponse(chosen.id, memberId)]);
      setLabels(lbl);
      applyResponse(mine);
      if (deepLinkSurveyId && chosen.id === deepLinkSurveyId) setHighlight(true);
    } catch (e) {
      console.error('Error loading the meeting survey:', e);
    } finally {
      setLoading(false);
    }
  };

  const applyResponse = (mine: PostEventResponse | null) => {
    setResponse(mine);
    setEditing(!mine);
    setRatings({ speaker: mine?.ratings?.speaker ?? 0, meal: mine?.ratings?.meal ?? 0 });
    setComment(mine?.comment ?? '');
    setShareName(mine?.share_name ?? false);
  };

  useEffect(() => {
    if (highlight && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const t = setTimeout(() => setHighlight(false), 2500);
      return () => clearTimeout(t);
    }
  }, [highlight, loading]);

  const submit = async () => {
    if (!survey || !ratings.speaker || !ratings.meal) return;
    setSubmitting(true);
    setError('');
    const payload = {
      ratings: { speaker: ratings.speaker, meal: ratings.meal },
      comment: comment.trim() || null,
      share_name: shareName,
    };
    try {
      const cols = 'id, survey_id, member_id, ratings, comment, share_name, created_at, updated_at';
      let saved: PostEventResponse | null = null;
      if (response) {
        const { data, error: e } = await supabase
          .schema('p0012_rotary')
          .from('post_event_responses')
          .update(payload)
          .eq('id', response.id)
          .select(cols)
          .single();
        if (e) throw e;
        saved = data as PostEventResponse;
      } else {
        const { data, error: e } = await supabase
          .schema('p0012_rotary')
          .from('post_event_responses')
          .insert({ survey_id: survey.id, member_id: memberId, ...payload })
          .select(cols)
          .single();
        if (e && e.code === '23505') {
          // Already answered (another tab or device): save these choices over that answer.
          const mine = await loadMyResponse(survey.id, memberId);
          if (!mine) throw e;
          const { data: upd, error: e2 } = await supabase
            .schema('p0012_rotary')
            .from('post_event_responses')
            .update(payload)
            .eq('id', mine.id)
            .select(cols)
            .single();
          if (e2) throw e2;
          saved = upd as PostEventResponse;
        } else {
          if (e) throw e;
          saved = data as PostEventResponse;
        }
      }
      applyResponse(saved);
      onSaved?.();
      setTimeout(() => thanksRef.current?.focus(), 0);
    } catch (e) {
      console.error('Error saving feedback:', e);
      const msg = (e as { message?: string; code?: string } | null);
      if (msg?.code === '42501' || /closed|row-level security/i.test(msg?.message ?? '')) {
        setError('This survey has closed.');
      } else {
        setError('Your feedback was not saved. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  const note = linkNote ? (
    <div role="status" className="bg-white rounded-2xl p-4 border border-gray-200 text-sm text-gray-700">
      {LINK_NOTES[linkNote]}
    </div>
  ) : null;

  if (!survey) return note;

  const isToday = survey.event_date === clubDateString();
  const hadName = response?.share_name ?? false;
  const startEdit = () => {
    setEditing(true);
    setTimeout(() => titleRef.current?.focus(), 0);
  };
  const cancelEdit = () => {
    applyResponse(response);
    setTimeout(() => thanksRef.current?.focus(), 0);
  };

  return (
    <>
      {note}
      <section
        ref={cardRef}
        aria-labelledby="survey-title"
        className={`bg-white rounded-2xl p-[18px] flex flex-col gap-3.5 border-2 border-[#1B2A4A] transition-shadow ${
          highlight ? 'ring-4 ring-[#C44444]/40' : ''
        }`}
      >
        <div className="flex justify-between items-center">
          <span className="text-xs font-extrabold tracking-wider text-white bg-[#1B2A4A] px-2.5 py-1 rounded-full">
            {isToday ? "TODAY'S MEETING" : 'LAST MEETING'}
          </span>
          <span className="text-sm text-[#5B6472]">Open until {lastOpenDayLabel(survey)}</span>
        </div>
        <h2 id="survey-title" ref={titleRef} tabIndex={-1} className="m-0 text-xl font-extrabold text-[#1B2A4A] focus:outline-none">
          {eventDateLabel(survey.event_date)}
        </h2>

        {editing ? (
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <div className="text-[13px] font-bold text-[#5B6472] uppercase tracking-wide">{labels?.subjectHeading}</div>
              <div className="text-base font-bold text-[#1B2A4A]">{labels?.subject}</div>
              <StarRow
                value={ratings.speaker}
                onChange={(v) => setRatings((r) => ({ ...r, speaker: v }))}
                what={labels?.subjectHeading === 'Speaker' ? 'speaker' : 'program'}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="text-[13px] font-bold text-[#5B6472] uppercase tracking-wide">Meal</div>
              <div className="text-base font-bold text-[#1B2A4A]">{labels?.meal}</div>
              <StarRow value={ratings.meal} onChange={(v) => setRatings((r) => ({ ...r, meal: v }))} what="meal" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="survey-notes" className="text-[13px] font-bold text-[#5B6472] uppercase tracking-wide">
                Anything else? (optional)
              </label>
              <textarea
                id="survey-notes"
                rows={3}
                value={comment}
                maxLength={2000}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What worked, what could be better…"
                className="w-full box-border border border-[#CBD2DC] rounded-xl px-3 py-2.5 text-[15px] text-[#1B2A4A] bg-[#F9FAFB] resize-none"
              />
            </div>

            <div className="flex items-center gap-3 bg-[#F4F5F8] rounded-xl p-3">
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="text-[15px] font-bold text-[#1B2A4A]" id="include-name-label">Include my name</div>
                <div id="include-name-help" className="text-[13px] text-[#5B6472] leading-snug">
                  {shareName
                    ? 'Leaders will see your name with this feedback.'
                    : 'Leaders see your ratings and comments, not your name.'}
                  {!shareName && hadName && ' Leaders may already have seen your name with your earlier answer.'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={shareName}
                aria-labelledby="include-name-label"
                aria-describedby="include-name-help"
                onClick={() => setShareName((s) => !s)}
                className={`relative w-[52px] h-8 flex-shrink-0 rounded-full transition-colors ${shareName ? 'bg-[#1B2A4A]' : 'bg-[#9AA3B0]'}`}
              >
                <span
                  className="absolute top-1 w-6 h-6 rounded-full bg-white transition-all"
                  style={{ left: shareName ? 24 : 4 }}
                />
              </button>
            </div>

            {error && <p role="alert" className="text-sm font-semibold text-[#C44444]">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={submitting || !ratings.speaker || !ratings.meal}
              className="h-12 rounded-xl bg-[#C44444] text-white text-base font-extrabold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Sending…' : response ? 'Save changes' : 'Send feedback'}
            </button>
            {response && (
              <button
                type="button"
                onClick={cancelEdit}
                className="h-10 text-sm font-bold text-[#5B6472]"
              >
                Cancel
              </button>
            )}
          </div>
        ) : (
          <div ref={thanksRef} tabIndex={-1} role="status" className="bg-[#EAF6EE] rounded-xl p-4 flex flex-col gap-1.5 focus:outline-none">
            <div className="text-base font-extrabold text-[#15603A]">Thanks — feedback sent</div>
            <div className="text-sm text-[#2F4A3A] leading-snug">
              {response?.share_name
                ? 'Leaders will see your ratings with your name. It is saved in My history below.'
                : 'Leaders will see your ratings without your name. It is saved in My history below.'}
            </div>
            <button
              type="button"
              onClick={startEdit}
              className="self-start mt-1 h-9 px-3.5 border border-[#15603A] rounded-lg bg-transparent text-[#15603A] text-sm font-bold"
            >
              Edit my answer
            </button>
          </div>
        )}
      </section>
    </>
  );
}
