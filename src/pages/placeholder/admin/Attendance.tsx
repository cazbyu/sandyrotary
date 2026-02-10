import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Download } from 'lucide-react';
import { Layout } from '../../../components/Layout';
import { supabase } from '../../../lib/supabase';
import { getAttendanceStatus } from '../../../lib/attendanceUtils';

interface Meeting {
  id: string;
  event_name: string;
  start_date: string;
}

interface AttendanceRecord {
  id: string;
  rsvp_status: string;
  actually_attended: boolean | null;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    profile_photo_url?: string;
    member_status: string;
  };
}

export function Attendance() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [showFilter, setShowFilter] = useState<'all' | 'no-shows'>('all');

  useEffect(() => {
    loadMeetings();
  }, []);

  useEffect(() => {
    if (selectedMeeting) {
      loadAttendanceForMeeting(selectedMeeting.id);
    }
  }, [selectedMeeting]);

  const loadMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('0012-sr-calendar-events')
        .select('id, event_name, start_date')
        .eq('category', 'Club Meeting')
        .eq('status', 'Active')
        .order('start_date', { ascending: false });

      if (error) throw error;

      setMeetings(data || []);
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceForMeeting = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('0012-sr-meeting-attendance')
        .select(`
          id,
          rsvp_status,
          actually_attended,
          member:member_id (
            id,
            first_name,
            last_name,
            profile_photo_url,
            member_status
          )
        `)
        .eq('event_id', eventId);

      if (error) throw error;

      setAttendanceRecords((data || []) as unknown as AttendanceRecord[]);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const markAttendance = async (attendanceId: string, attended: boolean) => {
    try {
      const { error } = await supabase
        .from('0012-sr-meeting-attendance')
        .update({
          actually_attended: attended,
          marked_at: new Date().toISOString(),
        })
        .eq('id', attendanceId);

      if (error) throw error;

      if (selectedMeeting) {
        await loadAttendanceForMeeting(selectedMeeting.id);
      }
    } catch (error) {
      console.error('Error marking attendance:', error);
    }
  };

  const markAllPresent = async () => {
    if (!selectedMeeting) return;

    const attendingRecords = attendanceRecords.filter(
      (r) => r.rsvp_status === 'attending'
    );

    try {
      await Promise.all(
        attendingRecords.map((record) =>
          supabase
            .from('0012-sr-meeting-attendance')
            .update({
              actually_attended: true,
              marked_at: new Date().toISOString(),
            })
            .eq('id', record.id)
        )
      );

      await loadAttendanceForMeeting(selectedMeeting.id);
    } catch (error) {
      console.error('Error marking all present:', error);
    }
  };

  const exportReport = () => {
    if (!selectedMeeting) return;

    const csvRows = [
      ['Name', 'RSVP Status', 'Actually Attended', 'Status'],
      ...attendanceRecords.map((record) => {
        const status = getAttendanceStatus(
          record.rsvp_status,
          record.actually_attended,
          new Date(selectedMeeting.start_date),
          true
        );
        return [
          `${record.member.first_name} ${record.member.last_name}`,
          record.rsvp_status,
          record.actually_attended === null ? 'N/A' : record.actually_attended ? 'Yes' : 'No',
          status.label,
        ];
      }),
    ];

    const csvContent = csvRows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${selectedMeeting.event_name.replace(/\s+/g, '-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStats = () => {
    const attended = attendanceRecords.filter((r) => r.actually_attended === true).length;
    const optedOut = attendanceRecords.filter((r) => r.rsvp_status === 'not_attending').length;
    const noShows = attendanceRecords.filter(
      (r) => r.rsvp_status === 'attending' && r.actually_attended === false
    ).length;
    const total = attendanceRecords.length;

    return { attended, optedOut, noShows, total };
  };

  const filteredRecords =
    showFilter === 'no-shows'
      ? attendanceRecords.filter(
          (r) => r.rsvp_status === 'attending' && r.actually_attended === false
        )
      : attendanceRecords;

  if (loading) {
    return (
      <Layout showHeader={false}>
        <div className="min-h-screen bg-[#F5F7FA]">
          <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-xl font-bold text-white flex-1">Attendance</h1>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
              <p className="mt-4 text-gray-600">Loading meetings...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (selectedMeeting) {
    const stats = getStats();

    return (
      <Layout showHeader={false}>
        <div className="min-h-screen bg-[#F5F7FA]">
          <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
            <button
              onClick={() => setSelectedMeeting(null)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">{selectedMeeting.event_name}</h1>
              <p className="text-white/80 text-sm">
                {new Date(selectedMeeting.start_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div className="bg-white p-4 shadow-sm">
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.attended}</div>
                <div className="text-xs text-gray-600">Attended</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{stats.optedOut}</div>
                <div className="text-xs text-gray-600">Busy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.noShows}</div>
                <div className="text-xs text-gray-600">No-Shows</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#1B2A4A]">{stats.total}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={markAllPresent}
                className="flex-1 py-2 px-4 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors text-sm"
              >
                Mark All Present
              </button>
              <button
                onClick={exportReport}
                className="py-2 px-4 bg-[#1B2A4A] text-white font-semibold rounded-lg hover:bg-[#1B2A4A]/90 transition-colors flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
            <button
              onClick={() => setShowFilter('all')}
              className={`flex-1 py-3 text-center font-semibold transition-colors ${
                showFilter === 'all'
                  ? 'text-[#1B2A4A] border-b-2 border-[#D94F4F]'
                  : 'text-gray-500'
              }`}
            >
              All Members
            </button>
            <button
              onClick={() => setShowFilter('no-shows')}
              className={`flex-1 py-3 text-center font-semibold transition-colors ${
                showFilter === 'no-shows'
                  ? 'text-[#1B2A4A] border-b-2 border-[#D94F4F]'
                  : 'text-gray-500'
              }`}
            >
              No-Shows ({stats.noShows})
            </button>
          </div>

          <div className="p-4 space-y-2">
            {filteredRecords.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">
                  {showFilter === 'no-shows' ? 'No no-shows found' : 'No attendance records found'}
                </p>
              </div>
            ) : (
              filteredRecords.map((record) => {
                const status = getAttendanceStatus(
                  record.rsvp_status,
                  record.actually_attended,
                  new Date(selectedMeeting.start_date)
                );

                return (
                  <div
                    key={record.id}
                    className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                      {record.member.profile_photo_url ? (
                        <img
                          src={record.member.profile_photo_url}
                          alt={record.member.first_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 font-semibold">
                          {record.member.first_name[0]}
                          {record.member.last_name[0]}
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">
                        {record.member.first_name} {record.member.last_name}
                      </h3>
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-semibold text-white ${status.color} mt-1`}
                      >
                        {status.icon} {status.label}
                      </span>
                    </div>

                    {record.rsvp_status === 'attending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => markAttendance(record.id, true)}
                          className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
                            record.actually_attended === true
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 text-gray-600 hover:bg-green-100'
                          }`}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => markAttendance(record.id, false)}
                          className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
                            record.actually_attended === false
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-200 text-gray-600 hover:bg-red-100'
                          }`}
                        >
                          ✗
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F5F7FA]">
        <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Attendance</h1>
        </div>

        <div className="p-4 space-y-3">
          {meetings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No meetings found</p>
            </div>
          ) : (
            meetings.map((meeting) => (
              <button
                key={meeting.id}
                onClick={() => setSelectedMeeting(meeting)}
                className="w-full bg-white rounded-xl shadow-md p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 text-left">
                  <h3 className="font-bold text-gray-800 text-lg mb-1">{meeting.event_name}</h3>
                  <p className="text-sm text-gray-600">
                    {new Date(meeting.start_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <ChevronRight className="w-6 h-6 text-gray-400" />
              </button>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
