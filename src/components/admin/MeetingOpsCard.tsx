import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, ChevronRight, Loader2 } from 'lucide-react';
import { supabase, WeeklySurvey } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Celebration {
  id: string;
  name: string;
  emoji: string;
  label: string;
  month: number;
  day: number;
}

function getNextWednesday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilWednesday = (3 - dayOfWeek + 7) % 7 || 7;
  const nextWed = new Date(today);
  nextWed.setDate(today.getDate() + daysUntilWednesday);
  return nextWed.toISOString().split('T')[0];
}

function formatMeetingDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function MeetingOpsCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [loadingCelebrations, setLoadingCelebrations] = useState(true);
  const [questionText, setQuestionText] = useState('');
  const [meetingDate, setMeetingDate] = useState(getNextWednesday());
  const [submitting, setSubmitting] = useState(false);
  const [activeSurvey, setActiveSurvey] = useState<WeeklySurvey | null>(null);
  const [loadingSurvey, setLoadingSurvey] = useState(true);

  useEffect(() => {
    loadCelebrations();
    loadActiveSurvey();
  }, []);

  const loadCelebrations = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('members')
        .select('id, first_name, last_name, birthday, wedding_anniversary, membership_start_date');

      if (error) throw error;

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const currentYear = now.getFullYear();
      const allCelebrations: Celebration[] = [];

      (data || []).forEach((member) => {
        if (member.birthday) {
          const date = new Date(member.birthday);
          const month = date.getMonth() + 1;
          const day = date.getDate();
          if (month === currentMonth || month === nextMonth) {
            allCelebrations.push({
              id: `${member.id}-birthday`,
              name: `${member.first_name} ${member.last_name}`,
              emoji: '\uD83C\uDF82',
              label: `Birthday`,
              month,
              day,
            });
          }
        }

        if (member.wedding_anniversary) {
          const date = new Date(member.wedding_anniversary);
          const month = date.getMonth() + 1;
          const day = date.getDate();
          if (month === currentMonth || month === nextMonth) {
            const years = currentYear - date.getFullYear();
            allCelebrations.push({
              id: `${member.id}-wedding`,
              name: `${member.first_name} ${member.last_name}`,
              emoji: '\uD83D\uDC8D',
              label: years > 0 ? `Wedding (${years} yrs)` : 'Wedding Anniversary',
              month,
              day,
            });
          }
        }

        if (member.membership_start_date) {
          const date = new Date(member.membership_start_date);
          const month = date.getMonth() + 1;
          const day = date.getDate();
          if (month === currentMonth || month === nextMonth) {
            const years = currentYear - date.getFullYear();
            allCelebrations.push({
              id: `${member.id}-membership`,
              name: `${member.first_name} ${member.last_name}`,
              emoji: '\uD83C\uDF97\uFE0F',
              label: years > 0 ? `Member (${years} yrs)` : 'Membership Anniversary',
              month,
              day,
            });
          }
        }
      });

      allCelebrations.sort((a, b) => {
        if (a.month !== b.month) return a.month === currentMonth ? -1 : 1;
        return a.day - b.day;
      });

      setCelebrations(allCelebrations.slice(0, 5));
    } catch (error) {
      console.error('Error loading celebrations:', error);
    } finally {
      setLoadingCelebrations(false);
    }
  };

  const loadActiveSurvey = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('weekly_surveys')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setActiveSurvey(data);
    } catch (error) {
      console.error('Error loading active survey:', error);
    } finally {
      setLoadingSurvey(false);
    }
  };

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !questionText.trim()) return;

    setSubmitting(true);
    try {
      // Deactivate any existing active surveys
      await supabase
        .schema('p0012_rotary')
        .from('weekly_surveys')
        .update({ is_active: false })
        .eq('is_active', true);

      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('weekly_surveys')
        .insert({
          question_text: questionText.trim(),
          survey_type: 'weekly',
          meeting_date: meetingDate,
          created_by: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setActiveSurvey(data);
      setQuestionText('');
      setMeetingDate(getNextWednesday());
    } catch (error) {
      console.error('Error creating survey:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivateSurvey = async () => {
    if (!activeSurvey) return;

    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('weekly_surveys')
        .update({ is_active: false })
        .eq('id', activeSurvey.id);

      if (error) throw error;
      setActiveSurvey(null);
    } catch (error) {
      console.error('Error deactivating survey:', error);
    }
  };

  const getMonthDayLabel = (month: number, day: number): string => {
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return `${monthNames[month - 1]} ${day}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-[#1B2A4A] flex items-center justify-center">
          <ClipboardCheck className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-lg font-bold text-[#1B2A4A]">Meeting Ops</h2>
      </div>

      {/* Section 1: Take Attendance */}
      <div className="mb-5">
        <button
          onClick={() => navigate('/admin/attendance')}
          className="w-full bg-[#1B2A4A] hover:bg-[#2D3E5F] text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base"
        >
          Take Attendance
        </button>
      </div>

      {/* Section 2: Upcoming Celebrations */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Upcoming Celebrations
          </h3>
          <button
            onClick={() => navigate('/birthdays')}
            className="text-sm text-[#D94F4F] hover:text-[#B83E3E] font-medium flex items-center gap-1"
          >
            See All
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loadingCelebrations ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : celebrations.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">No upcoming celebrations</p>
        ) : (
          <div className="space-y-2">
            {celebrations.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 py-1.5 text-sm"
              >
                <span className="text-lg">{c.emoji}</span>
                <span className="font-medium text-gray-800 flex-1">{c.name}</span>
                <span className="text-gray-500 text-xs">
                  {c.label} &middot; {getMonthDayLabel(c.month, c.day)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <hr className="border-gray-100 mb-5" />

      {/* Section 3: Set Weekly Survey Question */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Set Weekly Survey Question
        </h3>

        {loadingSurvey ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : activeSurvey ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">Active Survey</p>
                <p className="text-sm text-green-700 mt-1">
                  &ldquo;{activeSurvey.question_text}&rdquo;
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Meeting: {formatMeetingDate(activeSurvey.meeting_date)}
                </p>
              </div>
            </div>
            <button
              onClick={handleDeactivateSurvey}
              className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
            >
              Deactivate Survey
            </button>
          </div>
        ) : null}

        <form onSubmit={handleCreateSurvey} className="space-y-3">
          <div>
            <input
              type="text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Enter survey question..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Meeting Date</label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !questionText.trim()}
            className="w-full bg-[#D94F4F] hover:bg-[#B83E3E] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {submitting ? 'Creating...' : activeSurvey ? 'Replace Survey' : 'Create Survey'}
          </button>
        </form>
      </div>
    </div>
  );
}
