import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Lock, Check } from 'lucide-react';
import { Layout } from '../components/Layout';
import { BottomNav } from '../components/BottomNav';
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

interface CalendarEvent {
  id: string;
  event_name: string;
  start_date: string;
}

interface RowItem {
  dateStr: string;
  date: Date;
  isMeeting: boolean;
  isSocial: boolean;
  event?: CalendarEvent;
}

export function AttendancePlans() {
  const navigate = useNavigate();
  const { member } = useAuth();
  const [windowStart, setWindowStart] = useState<Date>(getStartWednesday);
  const [plans, setPlans] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [rows, setRows] = useState<RowItem[]>([]);

  const wednesdays = generateWednesdays(windowStart, 4);
  const windowEndDate = new Date(wednesdays[wednesdays.length - 1]);
  windowEndDate.setHours(23, 59, 59, 999);
  const windowStartDate = new Date(windowStart);
  windowStartDate.setHours(0, 0, 0, 0);

  const buildRows = useCallback(
    (evts: CalendarEvent[]): RowItem[] => {
      const meetingDateStrs = wednesdays.map(toDateString);

      const evtByDate: Record<string, CalendarEvent> = {};
      evts.forEach((evt) => {
        const evtDate = new Date(evt.start_date);
        evtDate.setHours(12, 0, 0, 0);
        evtByDate[toDateString(evtDate)] = evt;
      });

      const items: RowItem[] = wednesdays.map((date) => {
        const ds = toDateString(date);
        return {
          dateStr: ds,
          date,
          isMeeting: true,
          isSocial: isFourthWednesday(date),
          event: evtByDate[ds],
        };
      });

      evts.forEach((evt) => {
        const evtDate = new Date(evt.start_date);
        evtDate.setHours(12, 0, 0, 0);
        const evtDateStr = toDateString(evtDate);
        if (!meetingDateStrs.includes(evtDateStr)) {
          items.push({
            dateStr: evtDateStr,
            date: evtDate,
            isMeeting: false,
            isSocial: false,
            event: evt,
          });
        }
      });

      items.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
      return items;
    },
    [windowStart]
  );

  const loadPlans = useCallback(async () => {
    if (!member) return;
    try {
      const startStr = toDateString(windowStart);
      const endStr = toDateString(wednesdays[wednesdays.length - 1]);

      const [plansRes, eventsRes] = await Promise.all([
        supabase
          .schema('p0012_rotary')
          .from('attendance_plans')
          .select('meeting_date, is_attending')
          .eq('member_id', member.id)
          .gte('meeting_date', startStr)
          .lte('meeting_date', endStr),
        supabase
          .schema('p0012_rotary')
          .from('calendar_events')
          .select('id, event_name, start_date')
          .gte('start_date', windowStartDate.toISOString())
          .lte('start_date', windowEndDate.toISOString())
          .eq('status', 'Active'),
      ]);

      if (plansRes.error) throw plansRes.error;
      if (eventsRes.error) throw eventsRes.error;

      const planMap: Record<string, boolean> = {};
      (plansRes.data || []).forEach((p: { meeting_date: string; is_attending: boolean }) => {
        planMap[p.meeting_date] = p.is_attending;
      });
      setPlans(planMap);

      const evts: CalendarEvent[] = (eventsRes.data || []).map(
        (e: { id: string; event_name: string; start_date: string }) => ({
          id: e.id,
          event_name: e.event_name,
          start_date: e.start_date,
        })
      );
      setRows(buildRows(evts));
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

  const toggleAttendance = async (row: RowItem) => {
    if (!member) return;
    const { dateStr, event } = row;
    const defaultValue = (row.isMeeting && !row.isSocial) ? true : false;
    const currentValue = plans[dateStr] ?? defaultValue;
    const newValue = !currentValue;

    setToggling(dateStr);
    setPlans((prev) => ({ ...prev, [dateStr]: newValue }));

    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('attendance_plans')
        .upsert(
          {
            member_id: member.id,
            meeting_date: dateStr,
            is_attending: newValue,
            event_id: event?.id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'member_id,meeting_date' }
        );

      if (error) throw error;

      await supabase.schema('p0012_rotary').from('attendance_plan_history').insert({
        member_id: member.id,
        meeting_date: dateStr,
        event_id: event?.id ?? null,
        is_attending: newValue,
        toggled_by: member.id,
      });
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
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
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
              {rows.map((row) => {
                const { dateStr, date, isMeeting, isSocial, event } = row;
                const past = isPastMeeting(date);
                const locked = isMeetingLocked(date);
                const defaultValue = isMeeting ? true : false;
                const isAttending = plans[dateStr] ?? defaultValue;
                const isTogglingThis = toggling === dateStr;

                if (isSocial) {
                  const isGoing = plans[dateStr] ?? false;
                  const isTogglingThis2 = toggling === dateStr;
                  if (past) {
                    return (
                      <div
                        key={dateStr}
                        className="bg-gray-50 rounded-xl border border-gray-100 px-5 py-4 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-medium text-gray-500">{formatDisplayDate(date)}</span>
                          <span className="ml-2 text-xs text-gray-400 italic">Social</span>
                        </div>
                        {isGoing ? (
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
                            <Check className="w-4 h-4" />
                            Went
                          </span>
                        ) : (
                          <span className="text-sm font-semibold text-gray-400">Skipped</span>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={dateStr}
                      className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium text-gray-700">{formatDisplayDate(date)}</span>
                        <span className="ml-2 text-xs text-gray-500 italic">Social</span>
                      </div>
                      <button
                        onClick={() => toggleAttendance(row)}
                        disabled={isTogglingThis2}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                          isTogglingThis2
                            ? 'opacity-60 cursor-wait'
                            : isGoing
                            ? 'bg-green-500'
                            : 'bg-yellow-400'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                            isGoing ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  );
                }

                if (past) {
                  return (
                    <div
                      key={dateStr}
                      className={`rounded-xl shadow-sm border px-5 py-4 flex items-center justify-between ${
                        event ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100'
                      }`}
                    >
                      <div>
                        <span className="font-medium text-gray-500">
                          {formatDisplayDate(date)}
                        </span>
                        {event && (
                          <span className="ml-2 text-sm text-blue-500 font-medium">
                            ({event.event_name})
                          </span>
                        )}
                      </div>
                      {isAttending ? (
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
                          <Check className="w-4 h-4" />
                          {isMeeting ? 'Attended' : 'Went'}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-gray-400">
                          {isMeeting ? 'Busy' : 'Skipped'}
                        </span>
                      )}
                    </div>
                  );
                }

                if (locked && isMeeting) {
                  return (
                    <div
                      key={dateStr}
                      className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium text-gray-800">
                          {formatDisplayDate(date)}
                        </span>
                        {event && (
                          <span className="ml-2 text-sm text-gray-500 font-medium">
                            ({event.event_name})
                          </span>
                        )}
                      </div>
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
                    className={`rounded-xl shadow-sm border px-5 py-4 flex items-center justify-between ${
                      event ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100'
                    }`}
                  >
                    <div>
                      <span className="font-medium text-gray-800">
                        {formatDisplayDate(date)}
                      </span>
                      {event && (
                        <span className="ml-2 text-sm text-blue-600 font-medium">
                          ({event.event_name})
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleAttendance(row)}
                      disabled={isTogglingThis}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                        isTogglingThis
                          ? 'opacity-60 cursor-wait'
                          : isAttending
                          ? 'bg-green-500'
                          : event
                          ? 'bg-yellow-400'
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
      <BottomNav />
    </Layout>
  );
}
