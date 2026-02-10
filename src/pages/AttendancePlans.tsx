import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Users, User } from 'lucide-react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getAttendanceStatus } from '../lib/attendanceUtils';

interface Meeting {
  id: string;
  event_name: string;
  start_date: string;
}

interface AttendanceRecord {
  id: string;
  event_id: string;
  rsvp_status: string;
  actually_attended: boolean | null;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    profile_photo_url?: string;
  };
}

export function AttendancePlans() {
  const navigate = useNavigate();
  const { member, isLeader } = useAuth();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [attendanceByMeeting, setAttendanceByMeeting] = useState<Record<string, AttendanceRecord[]>>({});
  const [loadingAttendance, setLoadingAttendance] = useState<string | null>(null);

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('0012-sr-calendar-events')
        .select('id, event_name, start_date')
        .eq('category', 'Club Meeting')
        .eq('status', 'Active')
        .order('start_date', { ascending: false })
        .limit(20);

      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async (eventId: string) => {
    if (attendanceByMeeting[eventId]) return;

    setLoadingAttendance(eventId);
    try {
      let query = supabase
        .from('0012-sr-meeting-attendance')
        .select(`
          id,
          event_id,
          rsvp_status,
          actually_attended,
          member:member_id (
            id,
            first_name,
            last_name,
            profile_photo_url
          )
        `)
        .eq('event_id', eventId);

      if (!isLeader && member) {
        query = query.eq('member_id', member.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const records = (data || []) as unknown as AttendanceRecord[];
      records.sort((a, b) =>
        `${a.member.last_name} ${a.member.first_name}`.localeCompare(
          `${b.member.last_name} ${b.member.first_name}`
        )
      );

      setAttendanceByMeeting((prev) => ({ ...prev, [eventId]: records }));
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoadingAttendance(null);
    }
  };

  const toggleMeeting = (meetingId: string) => {
    if (expandedMeetingId === meetingId) {
      setExpandedMeetingId(null);
    } else {
      setExpandedMeetingId(meetingId);
      loadAttendance(meetingId);
    }
  };

  const formatMeetingDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatMeetingTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusCounts = (records: AttendanceRecord[], meetingDate: string) => {
    let attending = 0;
    let busy = 0;
    let noShow = 0;

    records.forEach((r) => {
      if (r.rsvp_status === 'not_attending') {
        busy++;
      } else if (r.actually_attended === false) {
        noShow++;
      } else {
        attending++;
      }
    });

    return { attending, busy, noShow, total: records.length };
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
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Attendance Plans</h1>
            <p className="text-white/70 text-sm">
              {isLeader ? 'All members' : 'Your attendance'}
            </p>
          </div>
          {isLeader ? (
            <Users className="w-5 h-5 text-white/60" />
          ) : (
            <User className="w-5 h-5 text-white/60" />
          )}
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
                <p className="mt-4 text-gray-600">Loading meetings...</p>
              </div>
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No meetings found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map((meeting) => {
                const isExpanded = expandedMeetingId === meeting.id;
                const records = attendanceByMeeting[meeting.id];
                const isLoadingThis = loadingAttendance === meeting.id;
                const isPast = new Date() > new Date(meeting.start_date);

                return (
                  <div
                    key={meeting.id}
                    className="bg-white rounded-xl shadow-md overflow-hidden transition-all"
                  >
                    <button
                      onClick={() => toggleMeeting(meeting.id)}
                      className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className={`flex-shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center ${
                          isPast ? 'bg-gray-400' : 'bg-[#1B2A4A]'
                        } text-white`}
                      >
                        <span className="text-xs font-semibold uppercase">
                          {new Date(meeting.start_date).toLocaleString('en-US', { month: 'short' })}
                        </span>
                        <span className="text-xl font-bold leading-tight">
                          {new Date(meeting.start_date).getDate()}
                        </span>
                      </div>

                      <div className="flex-1 text-left min-w-0">
                        <h3 className="font-bold text-gray-800 text-base truncate">
                          {meeting.event_name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {formatMeetingDate(meeting.start_date)} at {formatMeetingTime(meeting.start_date)}
                        </p>
                      </div>

                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100">
                        {isLoadingThis ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#1B2A4A]"></div>
                          </div>
                        ) : records && records.length > 0 ? (
                          <>
                            {isLeader && (
                              <SummaryBar
                                counts={getStatusCounts(records, meeting.start_date)}
                                isPast={isPast}
                              />
                            )}
                            <div className="divide-y divide-gray-100">
                              {records.map((record) => (
                                <AttendanceRow
                                  key={record.id}
                                  record={record}
                                  meetingDate={meeting.start_date}
                                  isLeaderView={isLeader}
                                />
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-6">
                            <p className="text-sm text-gray-500">No attendance records</p>
                          </div>
                        )}
                      </div>
                    )}
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

function SummaryBar({
  counts,
  isPast,
}: {
  counts: { attending: number; busy: number; noShow: number; total: number };
  isPast: boolean;
}) {
  return (
    <div className="px-4 py-3 bg-gray-50 flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
        <span className="text-gray-700 font-medium">{counts.attending}</span>
        <span className="text-gray-500">Attending</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-gray-500 inline-block" />
        <span className="text-gray-700 font-medium">{counts.busy}</span>
        <span className="text-gray-500">Busy</span>
      </div>
      {isPast && counts.noShow > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          <span className="text-gray-700 font-medium">{counts.noShow}</span>
          <span className="text-gray-500">No-Show</span>
        </div>
      )}
      <div className="ml-auto text-gray-500">
        {counts.total} total
      </div>
    </div>
  );
}

function AttendanceRow({
  record,
  meetingDate,
  isLeaderView,
}: {
  record: AttendanceRecord;
  meetingDate: string;
  isLeaderView: boolean;
}) {
  const status = getAttendanceStatus(
    record.rsvp_status,
    record.actually_attended,
    new Date(meetingDate),
    isLeaderView
  );

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
        {record.member.profile_photo_url ? (
          <img
            src={record.member.profile_photo_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 font-semibold text-sm">
            {record.member.first_name[0]}
            {record.member.last_name[0]}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 text-sm truncate">
          {record.member.first_name} {record.member.last_name}
        </p>
      </div>

      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white ${status.color}`}
      >
        {status.label}
      </span>
    </div>
  );
}
