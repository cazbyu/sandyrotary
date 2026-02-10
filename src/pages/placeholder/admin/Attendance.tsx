import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Layout } from '../../../components/Layout';
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

function isPastMeeting(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const meetingDay = new Date(date);
  meetingDay.setHours(0, 0, 0, 0);
  return today > meetingDay;
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
}

interface AttendanceRecord {
  member_id: string;
  meeting_date: string;
  status: 'attended' | 'busy' | 'no_show';
}

type CellStatus = 'attending' | 'busy' | 'attended' | 'no_show' | 'social' | null;

export function Attendance() {
  const navigate = useNavigate();
  const { member: currentUser } = useAuth();
  const [windowStart, setWindowStart] = useState<Date>(getStartWednesday);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Record<string, AttendancePlan[]>>({});
  const [records, setRecords] = useState<Record<string, AttendanceRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const wednesdays = generateWednesdays(windowStart, 4);

  const loadData = useCallback(async () => {
    try {
      const [membersRes, plansRes, recordsRes] = await Promise.all([
        supabase
          .from('0012-sr-members')
          .select('*')
          .eq('member_status', 'Active')
          .order('last_name', { ascending: true }),
        supabase
          .from('0012-sr-attendance-plans')
          .select('member_id, meeting_date, is_attending')
          .in('meeting_date', wednesdays.map(toDateString)),
        supabase
          .from('0012-sr-attendance-records')
          .select('member_id, meeting_date, status')
          .in('meeting_date', wednesdays.map(toDateString)),
      ]);

      if (membersRes.error) throw membersRes.error;
      if (plansRes.error) throw plansRes.error;
      if (recordsRes.error) throw recordsRes.error;

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

  const getCellStatus = (memberId: string, date: Date): CellStatus => {
    if (isFourthWednesday(date)) return 'social';

    const dateStr = toDateString(date);
    const isPast = isPastMeeting(date);

    if (isPast) {
      const record = records[dateStr]?.find((r) => r.member_id === memberId);
      if (record) return record.status;

      const plan = plans[dateStr]?.find((p) => p.member_id === memberId);
      if (plan && !plan.is_attending) return 'busy';

      return null;
    } else {
      const plan = plans[dateStr]?.find((p) => p.member_id === memberId);
      return plan ? (plan.is_attending ? 'attending' : 'busy') : 'attending';
    }
  };

  const updateAttendance = async (memberId: string, date: Date, status: 'attended' | 'busy' | 'no_show') => {
    if (!currentUser) return;

    const dateStr = toDateString(date);
    const key = `${memberId}-${dateStr}`;
    setUpdating(key);

    try {
      const { error } = await supabase
        .from('0012-sr-attendance-records')
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

  const getColumnTotals = (date: Date): { attended: number; busy: number; noShow: number } => {
    if (isFourthWednesday(date)) return { attended: 0, busy: 0, noShow: 0 };

    let attended = 0;
    let busy = 0;
    let noShow = 0;

    members.forEach((member) => {
      const status = getCellStatus(member.id, date);
      if (status === 'attended') attended++;
      else if (status === 'busy') busy++;
      else if (status === 'no_show') noShow++;
    });

    return { attended, busy, noShow };
  };

  const renderCell = (member: Member, date: Date) => {
    const status = getCellStatus(member.id, date);
    const dateStr = toDateString(date);
    const isPast = isPastMeeting(date);
    const key = `${member.id}-${dateStr}`;
    const isUpdating = updating === key;

    if (status === 'social') {
      return (
        <div className="h-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs italic">
          Social
        </div>
      );
    }

    if (!isPast) {
      const isAttending = status === 'attending';
      return (
        <div
          className={`h-full flex items-center justify-center text-xs font-medium ${
            isAttending ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
          }`}
        >
          {isAttending ? 'Attending' : 'Busy'}
        </div>
      );
    }

    if (isUpdating) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[#1B2A4A]" />
        </div>
      );
    }

    return (
      <div className="h-full flex items-center justify-center gap-1">
        <button
          onClick={() => updateAttendance(member.id, date, 'attended')}
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
          onClick={() => updateAttendance(member.id, date, 'busy')}
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
          onClick={() => updateAttendance(member.id, date, 'no_show')}
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
  };

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
          <h1 className="text-xl font-bold text-white flex-1">Attendance Roster</h1>
        </div>

        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
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
          <div className="p-4 overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="grid grid-cols-[200px_repeat(4,1fr)] gap-px bg-gray-300 border border-gray-300 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-3 font-bold text-gray-700 text-sm">Member</div>
                {wednesdays.map((date) => (
                  <div
                    key={toDateString(date)}
                    className="bg-gray-100 px-2 py-3 font-bold text-gray-700 text-center text-xs"
                  >
                    <div>{formatColumnDate(date)}</div>
                    <div className="text-[10px] font-normal text-gray-500">
                      {isPastMeeting(date) ? 'Past' : 'Plan'}
                    </div>
                  </div>
                ))}

                {members.map((member) => (
                  <>
                    <div
                      key={`name-${member.id}`}
                      className="bg-white px-4 py-3 text-sm font-medium text-gray-800 flex items-center"
                    >
                      {member.first_name} {member.last_name}
                    </div>
                    {wednesdays.map((date) => (
                      <div key={`${member.id}-${toDateString(date)}`} className="bg-white">
                        {renderCell(member, date)}
                      </div>
                    ))}
                  </>
                ))}

                <div className="bg-gray-50 px-4 py-3 font-bold text-gray-700 text-sm border-t-2 border-gray-400">
                  Totals
                </div>
                {wednesdays.map((date) => {
                  const totals = getColumnTotals(date);
                  const isSocial = isFourthWednesday(date);
                  return (
                    <div
                      key={`total-${toDateString(date)}`}
                      className="bg-gray-50 px-2 py-3 text-xs text-center border-t-2 border-gray-400"
                    >
                      {isSocial ? (
                        <div className="text-gray-400 italic">-</div>
                      ) : (
                        <>
                          <div className="text-green-600 font-bold">✓ {totals.attended}</div>
                          <div className="text-yellow-600 font-bold">○ {totals.busy}</div>
                          <div className="text-red-600 font-bold">✗ {totals.noShow}</div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
