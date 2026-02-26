import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Layout } from '../../../components/Layout';
import { BottomNav } from '../../../components/BottomNav';
import { supabase, Member } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

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

function isTodayOrPast(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const meetingDay = new Date(date);
  meetingDay.setHours(0, 0, 0, 0);
  return today >= meetingDay;
}

function formatColumnDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

interface AttendancePlan {
  member_id: string;
  meeting_date: string;
  is_attending: boolean;
  event_id?: string | null;
}

interface AttendanceRecord {
  member_id: string;
  meeting_date: string;
  status: 'attended' | 'busy' | 'no_show';
}

interface CalendarEvent {
  id: string;
  event_name: string;
  start_date: string;
}

interface Column {
  dateStr: string;
  date: Date;
  isMeeting: boolean;
  isSocial: boolean;
  event?: CalendarEvent;
}

type CellStatus = 'attending' | 'busy' | 'attended' | 'no_show' | 'social' | null;

export function Attendance() {
  const navigate = useNavigate();
  const { member: currentUser } = useAuth();
  const [windowStart, setWindowStart] = useState<Date>(getStartWednesday);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Record<string, AttendancePlan[]>>({});
  const [records, setRecords] = useState<Record<string, AttendanceRecord[]>>({});
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const wednesdays = generateWednesdays(windowStart, 4);

  const windowEndDate = new Date(wednesdays[wednesdays.length - 1]);
  windowEndDate.setHours(23, 59, 59, 999);
  const windowStartDate = new Date(windowStart);
  windowStartDate.setHours(0, 0, 0, 0);

  const columns: Column[] = [];
  const meetingDateStrs = wednesdays.map(toDateString);

  const buildColumns = useCallback(
    (evts: CalendarEvent[]): Column[] => {
      const cols: Column[] = wednesdays.map((date) => ({
        dateStr: toDateString(date),
        date,
        isMeeting: true,
        isSocial: isFourthWednesday(date),
      }));

      evts.forEach((evt) => {
        const evtDate = new Date(evt.start_date);
        evtDate.setHours(12, 0, 0, 0);
        const evtDateStr = toDateString(evtDate);
        if (!meetingDateStrs.includes(evtDateStr)) {
          cols.push({
            dateStr: evtDateStr,
            date: evtDate,
            isMeeting: false,
            isSocial: false,
            event: evt,
          });
        }
      });

      cols.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
      return cols;
    },
    [windowStart]
  );

  const [columnList, setColumnList] = useState<Column[]>([]);

  const loadData = useCallback(async () => {
    try {
      const startStr = toDateString(windowStart);
      const endStr = toDateString(wednesdays[wednesdays.length - 1]);

      const [membersRes, plansRes, recordsRes, eventsRes] = await Promise.all([
        supabase
          .schema('p0012_rotary')
          .from('members')
          .select('*')
          .eq('member_status', 'Active')
          .order('last_name', { ascending: true }),
        supabase
          .schema('p0012_rotary')
          .from('attendance_plans')
          .select('member_id, meeting_date, is_attending, event_id')
          .gte('meeting_date', startStr)
          .lte('meeting_date', endStr),
        supabase
          .schema('p0012_rotary')
          .from('attendance_records')
          .select('member_id, meeting_date, status')
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

      if (membersRes.error) throw membersRes.error;
      if (plansRes.error) throw plansRes.error;
      if (recordsRes.error) throw recordsRes.error;
      if (eventsRes.error) throw eventsRes.error;

      setMembers(membersRes.data || []);

      const plansMap: Record<string, AttendancePlan[]> = {};
      (plansRes.data || []).forEach((p: AttendancePlan) => {
        if (!plansMap[p.meeting_date]) plansMap[p.meeting_date] = [];
        plansMap[p.meeting_date].push(p);
      });
      setPlans(plansMap);

      const recordsMap: Record<string, AttendanceRecord[]> = {};
      (recordsRes.data || []).forEach((r: AttendanceRecord) => {
        if (!recordsMap[r.meeting_date]) recordsMap[r.meeting_date] = [];
        recordsMap[r.meeting_date].push(r);
      });
      setRecords(recordsMap);

      const evts: CalendarEvent[] = (eventsRes.data || []).map((e: { id: string; event_name: string; start_date: string }) => ({
        id: e.id,
        event_name: e.event_name,
        start_date: e.start_date,
      }));
      setEvents(evts);
      setColumnList(buildColumns(evts));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [windowStart]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  useEffect(() => {
    setColumnList(buildColumns(events));
  }, [events, windowStart]);

  const getCellStatus = (memberId: string, col: Column): CellStatus => {
    const { dateStr } = col;
    const isActive = isTodayOrPast(col.date);

    if (isActive) {
      const record = records[dateStr]?.find((r) => r.member_id === memberId);
      if (record) return record.status;

      const plan = plans[dateStr]?.find((p) => p.member_id === memberId);
      if (plan) return plan.is_attending ? 'attending' : 'busy';

      if (!col.isMeeting) return 'busy';
      if (col.isSocial) return 'busy';

      return null;
    } else {
      const plan = plans[dateStr]?.find((p) => p.member_id === memberId);
      if (!col.isMeeting || col.isSocial) {
        return plan ? (plan.is_attending ? 'attending' : 'busy') : 'busy';
      }
      return plan ? (plan.is_attending ? 'attending' : 'busy') : 'attending';
    }
  };

  const updateAttendancePlan = async (
    memberId: string,
    col: Column,
    isAttending: boolean
  ) => {
    if (!currentUser) return;

    const { dateStr } = col;
    const key = `${memberId}-${dateStr}`;
    setUpdating(key);

    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('attendance_plans')
        .upsert(
          {
            member_id: memberId,
            meeting_date: dateStr,
            is_attending: isAttending,
            event_id: col.event?.id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'member_id,meeting_date' }
        );

      if (error) throw error;

      await supabase.schema('p0012_rotary').from('attendance_plan_history').insert({
        member_id: memberId,
        meeting_date: dateStr,
        event_id: col.event?.id ?? null,
        is_attending: isAttending,
        toggled_by: currentUser.id,
      });

      await loadData();
    } catch (error) {
      console.error('Error updating attendance plan:', error);
    } finally {
      setUpdating(null);
    }
  };

  const updateAttendance = async (
    memberId: string,
    col: Column,
    status: 'attended' | 'busy' | 'no_show'
  ) => {
    if (!currentUser) return;

    const { dateStr } = col;
    const key = `${memberId}-${dateStr}`;
    setUpdating(key);

    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('attendance_records')
        .upsert(
          {
            member_id: memberId,
            meeting_date: dateStr,
            status,
            marked_by: currentUser.id,
            marked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'member_id,meeting_date' }
        );

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error('Error updating attendance:', error);
    } finally {
      setUpdating(null);
    }
  };

  const navigateWeeks = (direction: number) => {
    const newStart = new Date(windowStart);
    newStart.setDate(newStart.getDate() + direction * 28);
    setWindowStart(newStart);
  };

  const getColumnTotals = (col: Column): { attended: number; busy: number; noShow: number } => {

    let attended = 0;
    let busy = 0;
    let noShow = 0;

    members.forEach((member) => {
      const status = getCellStatus(member.id, col);
      if (status === 'attended') attended++;
      else if (status === 'busy') busy++;
      else if (status === 'no_show') noShow++;
    });

    return { attended, busy, noShow };
  };

  const renderCell = (member: Member, col: Column) => {
    const status = getCellStatus(member.id, col);
    const { dateStr } = col;
    const isActive = isTodayOrPast(col.date);
    const key = `${member.id}-${dateStr}`;
    const isUpdating = updating === key;

    if (isUpdating) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[#1B2A4A]" />
        </div>
      );
    }

    if (col.isSocial) {
      const isAttending = status === 'attending';
      return (
        <div className="h-full flex items-center justify-center gap-1">
          <button
            onClick={() => updateAttendancePlan(member.id, col, true)}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              isAttending
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 hover:bg-green-100 text-gray-400'
            }`}
            title="Going"
          >
            ✓
          </button>
          <button
            onClick={() => updateAttendancePlan(member.id, col, false)}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              !isAttending
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-100 hover:bg-yellow-100 text-gray-400'
            }`}
            title="Not Going"
          >
            ○
          </button>
        </div>
      );
    }

    if (isActive) {
      if (!col.isMeeting) {
        const isAttending = status === 'attending';
        return (
          <div className="h-full flex items-center justify-center gap-1">
            <button
              onClick={() => updateAttendancePlan(member.id, col, true)}
              className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                isAttending
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 hover:bg-green-100 text-gray-400'
              }`}
              title="Going"
            >
              ✓
            </button>
            <button
              onClick={() => updateAttendancePlan(member.id, col, false)}
              className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                !isAttending
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 hover:bg-yellow-100 text-gray-400'
              }`}
              title="Not Going"
            >
              ○
            </button>
          </div>
        );
      }

      return (
        <div className="h-full flex items-center justify-center gap-1">
          <button
            onClick={() => updateAttendance(member.id, col, 'attended')}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              status === 'attended'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 hover:bg-green-100 text-gray-400'
            }`}
            title="Attended"
          >
            ✓
          </button>
          <button
            onClick={() => updateAttendance(member.id, col, 'busy')}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              status === 'busy'
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-100 hover:bg-yellow-100 text-gray-400'
            }`}
            title="Busy"
          >
            ○
          </button>
          <button
            onClick={() => updateAttendance(member.id, col, 'no_show')}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              status === 'no_show'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 hover:bg-red-100 text-gray-400'
            }`}
            title="No-Show"
          >
            ✗
          </button>
        </div>
      );
    }

    const isAttending = status === 'attending';
    return (
      <div className="h-full flex items-center justify-center gap-1">
        <button
          onClick={() => updateAttendancePlan(member.id, col, true)}
          className={`w-10 h-10 rounded flex items-center justify-center transition-colors text-xs font-semibold ${
            isAttending
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 hover:bg-green-100 text-gray-400'
          }`}
          title="Attending"
        >
          ✓
        </button>
        <button
          onClick={() => updateAttendancePlan(member.id, col, false)}
          className={`w-10 h-10 rounded flex items-center justify-center transition-colors text-xs font-semibold ${
            !isAttending
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-100 hover:bg-yellow-100 text-gray-400'
          }`}
          title="Busy"
        >
          ○
        </button>
      </div>
    );
  };

  return (
    <Layout showHeader={false}>
      <div className="h-screen flex flex-col bg-[#F5F7FA] pb-20">
        <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4 flex-shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Attendance Roster</h1>
        </div>

        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10 shadow-sm flex-shrink-0">
          <button
            onClick={() => navigateWeeks(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-800 text-sm">4 Week View</span>
          <button
            onClick={() => navigateWeeks(1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-[#1B2A4A]" />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="border-collapse" style={{ minWidth: `${160 + columnList.length * 130}px` }}>
              <thead>
                <tr>
                  <th
                    className="sticky top-0 left-0 z-30 bg-gray-100 border border-gray-300 px-4 py-3 text-left text-sm font-bold text-gray-700 whitespace-nowrap"
                    style={{ minWidth: 160 }}
                  >
                    Member
                  </th>
                  {columnList.map((col) => (
                    <th
                      key={col.dateStr}
                      className={`sticky top-0 z-20 border border-gray-300 px-2 py-3 text-center text-xs font-bold text-gray-700 ${
                        col.event ? 'bg-blue-50' : 'bg-gray-100'
                      }`}
                      style={{ minWidth: 130 }}
                    >
                      <div>{formatColumnDate(col.date)}</div>
                      {col.event && (
                        <div className="text-[10px] font-semibold text-blue-600 truncate max-w-[110px] mx-auto">
                          ({col.event.event_name})
                        </div>
                      )}
                      <div className="text-[10px] font-normal text-gray-500 mt-0.5">
                        {col.isSocial ? 'Social' : isTodayOrPast(col.date) ? 'Active' : col.event ? 'RSVP' : 'Plan'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((member, idx) => (
                  <tr key={member.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    <td
                      className="sticky left-0 z-10 border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                      style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}
                    >
                      {member.first_name} {member.last_name}
                    </td>
                    {columnList.map((col) => (
                      <td key={`${member.id}-${col.dateStr}`} className="border border-gray-200 p-0" style={{ height: 52 }}>
                        {renderCell(member, col)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td className="sticky left-0 z-10 border-t-2 border-gray-400 border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 bg-gray-50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    Totals
                  </td>
                  {columnList.map((col) => {
                    const totals = getColumnTotals(col);
                    return (
                      <td
                        key={`total-${col.dateStr}`}
                        className="border-t-2 border-gray-400 border border-gray-200 px-2 py-3 text-xs text-center"
                      >
                        <div className="text-green-600 font-bold">✓ {totals.attended}</div>
                        <div className="text-yellow-600 font-bold">○ {totals.busy}</div>
                        <div className="text-red-600 font-bold">✗ {totals.noShow}</div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      <BottomNav />
    </Layout>
  );
}
