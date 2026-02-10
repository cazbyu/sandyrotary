import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Lock, Check } from 'lucide-react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

function getStartWednesday(): Date {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const day = now.getDay();
  const offset = day <= 3 ? 3 - day : 10 - day;
  now.setDate(now.getDate() + offset);
  return now;
}

function generateWednesdays(start: Date, count: number): Date[] {
  const result: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    d.setHours(12, 0, 0, 0);
    result.push(d);
  }
  return result;
}

function isFourthWednesday(date: Date): boolean {
  return date.getDay() === 3 && Math.ceil(date.getDate() / 7) === 4;
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isPastMeeting(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const meetingDay = new Date(date);
  meetingDay.setHours(0, 0, 0, 0);
  return today > meetingDay;
}

function isMeetingLocked(meetingDate: Date): boolean {
  if (isPastMeeting(meetingDate)) return true;

  const fridayBefore = new Date(meetingDate);
  fridayBefore.setDate(fridayBefore.getDate() - 5);

  const nowMT = new Date().toLocaleString('sv-SE', { timeZone: 'America/Denver' });
  const deadlineDateMT = fridayBefore.toLocaleDateString('sv-SE', {
    timeZone: 'America/Denver',
  });
  const deadlineMT = deadlineDateMT + ' 23:59:00';

  return nowMT >= deadlineMT;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function AttendancePlans() {
  const navigate = useNavigate();
  const { member } = useAuth();
  const [windowStart, setWindowStart] = useState<Date>(getStartWednesday);
  const [plans, setPlans] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const wednesdays = generateWednesdays(windowStart, 4);

  const loadPlans = useCallback(async () => {
    if (!member) return;
    const dateStrings = wednesdays.map(toDateString);
    try {
      const { data, error } = await supabase
        .from('0012-sr-attendance-plans')
        .select('meeting_date, is_attending')
        .eq('member_id', member.id)
        .in('meeting_date', dateStrings);

      if (error) throw error;

      const planMap: Record<string, boolean> = {};
      (data || []).forEach((p: { meeting_date: string; is_attending: boolean }) => {
        planMap[p.meeting_date] = p.is_attending;
      });
      setPlans(planMap);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  }, [member?.id, windowStart]);

  useEffect(() => {
    setLoading(true);
    loadPlans();
  }, [loadPlans]);

  const toggleAttendance = async (date: Date) => {
    if (!member) return;
    const dateStr = toDateString(date);
    const currentValue = plans[dateStr] ?? true;
    const newValue = !currentValue;

    setToggling(dateStr);
    setPlans((prev) => ({ ...prev, [dateStr]: newValue }));

    try {
      const { error } = await supabase
        .from('0012-sr-attendance-plans')
        .upsert(
          {
            member_id: member.id,
            meeting_date: dateStr,
            is_attending: newValue,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'member_id,meeting_date' }
        );

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling attendance:', error);
      setPlans((prev) => ({ ...prev, [dateStr]: currentValue }));
    } finally {
      setToggling(null);
    }
  };

  const navigateWeeks = (direction: number) => {
    const newStart = new Date(windowStart);
    newStart.setDate(newStart.getDate() + direction * 28);
    setWindowStart(newStart);
  };

  const lastWed = wednesdays[wednesdays.length - 1];
  const rangeLabel = `${windowStart.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })} \u2013 ${lastWed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}`;

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F5F7FA]">
        <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Attendance Plans</h1>
        </div>

        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <button
            onClick={() => navigateWeeks(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-800 text-sm">{rangeLabel}</span>
          <button
            onClick={() => navigateWeeks(1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B2A4A]" />
            </div>
          ) : (
            <div className="space-y-3">
              {wednesdays.map((date) => {
                const dateStr = toDateString(date);
                const isSocial = isFourthWednesday(date);
                const past = isPastMeeting(date);
                const locked = isMeetingLocked(date);
                const isAttending = plans[dateStr] ?? true;
                const isTogglingThis = toggling === dateStr;

                if (isSocial) {
                  return (
                    <div
                      key={dateStr}
                      className="bg-gray-100 rounded-xl px-5 py-4 flex items-center justify-between"
                    >
                      <span className="font-medium text-gray-400">
                        {formatDisplayDate(date)}
                      </span>
                      <span className="text-sm font-semibold text-gray-400 italic">
                        Social
                      </span>
                    </div>
                  );
                }

                if (past) {
                  return (
                    <div
                      key={dateStr}
                      className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4 flex items-center justify-between"
                    >
                      <span className="font-medium text-gray-500">
                        {formatDisplayDate(date)}
                      </span>
                      {isAttending ? (
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
                          <Check className="w-4 h-4" />
                          Attended
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-gray-400">Busy</span>
                      )}
                    </div>
                  );
                }

                if (locked) {
                  return (
                    <div
                      key={dateStr}
                      className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4 flex items-center justify-between"
                    >
                      <span className="font-medium text-gray-800">
                        {formatDisplayDate(date)}
                      </span>
                      <div className="flex items-center gap-2">
                        <div
                          className={`relative inline-flex h-7 w-12 items-center rounded-full opacity-50 ${
                            isAttending ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ${
                              isAttending ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </div>
                        <Lock className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={dateStr}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4 flex items-center justify-between"
                  >
                    <span className="font-medium text-gray-800">
                      {formatDisplayDate(date)}
                    </span>
                    <button
                      onClick={() => toggleAttendance(date)}
                      disabled={isTogglingThis}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                        isTogglingThis
                          ? 'opacity-60 cursor-wait'
                          : isAttending
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                          isAttending ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
