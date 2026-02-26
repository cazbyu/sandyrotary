import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { SuggestionBox } from './SuggestionBox';

function getRotaryYearRange(): { startDate: string; endDate: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  let startYear: number;
  let endYear: number;

  if (month >= 6) {
    // July (6) onward: current year - next year
    startYear = year;
    endYear = year + 1;
  } else {
    // Jan-June: previous year - current year
    startYear = year - 1;
    endYear = year;
  }

  return {
    startDate: `${startYear}-07-01`,
    endDate: `${endYear}-06-30`,
    label: `${startYear}-${endYear}`,
  };
}

export function MyRotaryImpactCard() {
  const navigate = useNavigate();
  const { member } = useAuth();
  const [attendancePercent, setAttendancePercent] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (member) {
      loadAttendance();
    } else {
      setLoading(false);
    }
  }, [member]);

  const loadAttendance = async () => {
    if (!member) return;

    try {
      const { startDate, endDate } = getRotaryYearRange();

      const [myAttendanceRes, allMeetingsRes] = await Promise.all([
        supabase
          .schema('p0012_rotary')
          .from('attendance_records')
          .select('id', { count: 'exact' })
          .eq('member_id', member.id)
          .eq('status', 'attended')
          .gte('meeting_date', startDate)
          .lte('meeting_date', endDate),
        supabase
          .schema('p0012_rotary')
          .from('attendance_records')
          .select('meeting_date')
          .gte('meeting_date', startDate)
          .lte('meeting_date', endDate),
      ]);

      if (myAttendanceRes.error) throw myAttendanceRes.error;
      if (allMeetingsRes.error) throw allMeetingsRes.error;

      const myCount = myAttendanceRes.count || 0;

      // Count distinct meeting dates
      const distinctDates = new Set(
        (allMeetingsRes.data || []).map((r: { meeting_date: string }) => r.meeting_date)
      );
      const totalMeetings = distinctDates.size;

      if (totalMeetings > 0) {
        setAttendancePercent(Math.round((myCount / totalMeetings) * 100));
      } else {
        setAttendancePercent(0);
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-[#1B2A4A]" />
        <h2 className="text-lg font-bold text-[#1B2A4A]">My Rotary Impact</h2>
      </div>

      {/* Attendance Section */}
      <button
        onClick={() => navigate('/attendance-plans')}
        className="w-full text-left mb-5 hover:bg-gray-50 -mx-2 px-2 py-2 rounded-lg transition-colors"
      >
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          My Attendance
        </h3>
        {loading ? (
          <div className="flex items-center justify-center py-3">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#1B2A4A]" />
          </div>
        ) : (
          <div>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-3xl font-bold text-[#1B2A4A]">
                {attendancePercent ?? 0}%
              </span>
              <span className="text-sm text-gray-400 pb-1">this year</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="h-2.5 rounded-full transition-all duration-500"
                style={{
                  width: `${attendancePercent ?? 0}%`,
                  backgroundColor:
                    (attendancePercent ?? 0) >= 75
                      ? '#22c55e'
                      : (attendancePercent ?? 0) >= 50
                      ? '#eab308'
                      : '#D94F4F',
                }}
              />
            </div>
          </div>
        )}
      </button>

      {/* Suggestion Box Section */}
      <div className="border-t border-gray-100 pt-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Suggestion Box
        </h3>
        <SuggestionBox />
      </div>
    </div>
  );
}
