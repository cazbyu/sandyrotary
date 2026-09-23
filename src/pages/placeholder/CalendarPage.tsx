import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, ChevronDown, ChevronUp, Clock, Mic } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { BottomNav } from '../../components/BottomNav';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { isPastDeadline, formatDeadline } from '../../lib/attendanceUtils';
import { classifyWednesday, defaultAttending, eventDateKey, groupEventsByDate, isLunchEvent } from '../../lib/meetingSchedule';

// One style per category for the date box, card border and category tag.
// Every date box / tag pairing meets WCAG AA (4.5:1) for its small bold text.
const CATEGORY_STYLES: Record<string, { box: string; border: string; tag: string }> = {
  'Club Meeting': {
    box: 'bg-[#1B2A4A] text-white',
    border: 'border-transparent',
    tag: 'bg-[#1B2A4A] text-white',
  },
  'Club Service Project': {
    box: 'bg-[#C44444] text-white',
    border: 'border-[#C44444]',
    tag: 'bg-[#C44444] text-white',
  },
  'Club FundRaiser': {
    box: 'bg-[#15803D] text-white',
    border: 'border-[#15803D]',
    tag: 'bg-[#15803D] text-white',
  },
  'Club Event': {
    box: 'bg-[#BAE6FD] text-[#1B2A4A]',
    border: 'border-[#BAE6FD]',
    tag: 'bg-[#BAE6FD] text-[#1B2A4A]',
  },
  'No Meeting': {
    box: 'bg-[#6B7280] text-white',
    border: 'border-[#6B7280]',
    tag: 'bg-[#6B7280] text-white',
  },
};
const DEFAULT_STYLE = { box: 'bg-[#1B2A4A] text-white', border: 'border-transparent', tag: 'bg-gray-500 text-white' };

const categoryStyle = (category: string) => CATEGORY_STYLES[category] ?? DEFAULT_STYLE;

interface CalendarEvent {
  id: string;
  event_name: string;
  category: string;
  start_date: string;
  end_date: string;
  description?: string;
  address_line1?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  enable_rsvp: boolean;
  is_all_day?: boolean;
  status: string;
  speaker_name?: string;
  speaker_topic?: string;
  speaker_bio?: string;
}

interface AttendanceRecord {
  id: string;
  event_id: string;
  rsvp_status: string;
  rsvp_updated_at?: string;
}

export function CalendarPage() {
  const navigate = useNavigate();
  const { user, member } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'events' | 'google'>('events');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [googleCalendarId, setGoogleCalendarId] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [rsvpDeadlineDays, setRsvpDeadlineDays] = useState(5);
  // attendance_plans for the signed-in member, keyed by meeting_date (read-only here).
  const [plans, setPlans] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadCalendarData();
  }, []);

  useEffect(() => {
    if (!member || events.length === 0) return;
    const first = eventDateKey(events[0]);
    const last = eventDateKey(events[events.length - 1]);
    supabase
      .schema('p0012_rotary')
      .from('attendance_plans')
      .select('meeting_date, is_attending')
      .eq('member_id', member.id)
      .gte('meeting_date', first)
      .lte('meeting_date', last)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error loading attendance plans:', error);
          return;
        }
        const planMap: Record<string, boolean> = {};
        (data || []).forEach((p: { meeting_date: string; is_attending: boolean }) => {
          planMap[p.meeting_date] = p.is_attending;
        });
        setPlans(planMap);
      });
  }, [member?.id, events]);

  const loadCalendarData = async () => {
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .schema('p0012_rotary')
        .from('calendar_events')
        .select('*')
        .eq('status', 'Active')
        .gte('start_date', new Date().toISOString().split('T')[0])
        .order('start_date', { ascending: true });

      if (eventsError) throw eventsError;

      setEvents(eventsData || []);

      const { data: settingsData, error: settingsError } = await supabase
        .schema('p0012_rotary')
        .from('club_settings')
        .select('key, value')
        .in('key', ['google_calendar_id', 'rsvp_deadline_days_before']);

      if (settingsError) throw settingsError;

      if (settingsData) {
        const settings = Object.fromEntries(settingsData.map((s) => [s.key, s.value]));
        if (settings.google_calendar_id) {
          setGoogleCalendarId(settings.google_calendar_id);
        }
        if (settings.rsvp_deadline_days_before) {
          setRsvpDeadlineDays(parseInt(settings.rsvp_deadline_days_before));
        }
      }

      if (user && eventsData && eventsData.length > 0) {
        const eventIds = eventsData.map((e) => e.id);
        const { data: attendanceData, error: attendanceError } = await supabase
          .schema('p0012_rotary')
          .from('meeting_attendance')
          .select('*')
          .eq('member_id', user.id)
          .in('event_id', eventIds);

        if (attendanceError) throw attendanceError;

        const recordsMap: Record<string, AttendanceRecord> = {};
        (attendanceData || []).forEach((record) => {
          recordsMap[record.event_id] = record;
        });
        setAttendanceRecords(recordsMap);
      }
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRSVP = async (eventId: string, currentStatus: string) => {
    if (!user) return;

    const newStatus = currentStatus === 'attending' ? 'not_attending' : 'attending';

    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('meeting_attendance')
        .update({
          rsvp_status: newStatus,
          rsvp_updated_at: new Date().toISOString(),
        })
        .eq('event_id', eventId)
        .eq('member_id', user.id);

      if (error) throw error;

      setAttendanceRecords((prev) => ({
        ...prev,
        [eventId]: {
          ...prev[eventId],
          rsvp_status: newStatus,
          rsvp_updated_at: new Date().toISOString(),
        },
      }));
    } catch (error) {
      console.error('Error updating RSVP:', error);
      alert('Failed to update RSVP status. Please try again.');
    }
  };

  /**
   * Event ids the member plans to attend, using the same rule as My Attendance Plans:
   * the Wednesday lunch event reads plans[date] ?? defaultAttending; a lunch-type event on
   * another day is a non-meeting row there (default not attending). No Meeting and
   * service/fundraiser events never get a checkmark.
   */
  const attendingEventIds = (() => {
    const ids = new Set<string>();
    const byDate = groupEventsByDate(events);
    for (const [dateKey, dayEvents] of Object.entries(byDate)) {
      const date = new Date(dayEvents[0].start_date);
      date.setHours(12, 0, 0, 0);
      const plan = plans[dateKey];
      if (date.getDay() === 3) {
        const { lunchEvent, isSocial, isNoMeeting } = classifyWednesday(date, dayEvents);
        if (!lunchEvent || isNoMeeting) continue;
        if (plan ?? defaultAttending({ isMeeting: true, isSocial, isNoMeeting })) ids.add(lunchEvent.id);
      } else {
        for (const evt of dayEvents) {
          if (!isLunchEvent(evt) || evt.category === 'No Meeting') continue;
          if (plan ?? defaultAttending({ isMeeting: false, isSocial: false })) ids.add(evt.id);
        }
      }
    }
    return ids;
  })();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    return { month, day };
  };

  const formatTimeFromTimestamp = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const buildAddress = (event: CalendarEvent) => {
    const parts = [event.address_line1, event.address_city, event.address_state, event.address_zip].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const handleGetDirections = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
  };

  const toggleEventExpansion = (eventId: string) => {
    setExpandedEventId(expandedEventId === eventId ? null : eventId);
  };

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
        <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Calendar</h1>
        </div>

        <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
          <button
            onClick={() => setActiveTab('events')}
            className={`flex-1 py-4 text-center font-semibold transition-colors ${
              activeTab === 'events'
                ? 'text-[#1B2A4A] border-b-2 border-[#D94F4F]'
                : 'text-gray-500'
            }`}
          >
            Club Events
          </button>
          {googleCalendarId && (
            <button
              onClick={() => setActiveTab('google')}
              className={`flex-1 py-4 text-center font-semibold transition-colors ${
                activeTab === 'google'
                  ? 'text-[#1B2A4A] border-b-2 border-[#D94F4F]'
                  : 'text-gray-500'
              }`}
            >
              Google Calendar
            </button>
          )}
        </div>

        {activeTab === 'events' ? (
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
                  <p className="mt-4 text-gray-600">Loading events...</p>
                </div>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No upcoming events</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => {
                  const { month, day } = formatDate(event.start_date);
                  const isExpanded = expandedEventId === event.id;
                  const style = categoryStyle(event.category);

                  return (
                    <div
                      key={event.id}
                      className={`bg-white rounded-xl shadow-md overflow-hidden transition-all border-2 ${style.border}`}
                    >
                      <button
                        onClick={() => toggleEventExpansion(event.id)}
                        className="w-full p-4 flex gap-4 items-start hover:bg-gray-50 transition-colors"
                      >
                        <div className={`flex-shrink-0 w-16 h-16 rounded-lg flex flex-col items-center justify-center ${style.box}`}>
                          <span className="text-xs font-semibold uppercase">{month}</span>
                          <span className="text-2xl font-bold">{day}</span>
                        </div>

                        <div className="flex-1 text-left">
                          <h3 className="font-bold text-gray-800 text-lg mb-1">{event.event_name}</h3>
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs font-semibold mb-2 ${style.tag}`}
                          >
                            {event.category}
                          </span>
                          {attendingEventIds.has(event.id) && (
                            <span className="inline-block ml-2 px-2 py-1 rounded-full text-xs font-semibold mb-2 bg-green-100 text-green-800">
                              ✓ Attending
                            </span>
                          )}
                          <p className="text-sm text-gray-600">
                            {event.is_all_day ? (
                              'All day'
                            ) : (
                              <>
                                {formatTimeFromTimestamp(event.start_date)}
                                {event.end_date && ` - ${formatTimeFromTimestamp(event.end_date)}`}
                              </>
                            )}
                          </p>
                          {!isExpanded && event.description && (
                            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                              {event.description}
                            </p>
                          )}
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
                        <div className="px-4 pb-4 border-t border-gray-100">
                          <div className="pt-4 space-y-3">
                            {event.description && (
                              <div>
                                <h4 className="font-semibold text-gray-800 mb-1">Description</h4>
                                <p className="text-gray-700 whitespace-pre-wrap">{event.description}</p>
                              </div>
                            )}

                            {event.speaker_name && (
                              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Mic className="w-4 h-4 text-purple-600" />
                                  <h4 className="font-semibold text-gray-800">Speaker</h4>
                                </div>
                                <p className="font-bold text-gray-800">{event.speaker_name}</p>
                                {event.speaker_topic && (
                                  <p className="text-gray-700 italic mt-1">{event.speaker_topic}</p>
                                )}
                                {event.speaker_bio && (
                                  <p className="text-gray-600 text-sm mt-2">{event.speaker_bio}</p>
                                )}
                              </div>
                            )}

                            {event.category === 'Club Meeting' && event.enable_rsvp && user && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h4 className="font-semibold text-gray-800 mb-2">Your Attendance</h4>
                                {(() => {
                                  const attendance = attendanceRecords[event.id];
                                  const rsvpStatus = attendance?.rsvp_status || 'attending';
                                  const deadlinePassed = isPastDeadline(
                                    new Date(event.start_date),
                                    rsvpDeadlineDays
                                  );

                                  return (
                                    <>
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-gray-700">
                                          {rsvpStatus === 'attending'
                                            ? 'You are attending'
                                            : 'Busy'}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleRSVP(event.id, rsvpStatus);
                                          }}
                                          disabled={deadlinePassed}
                                          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                                            deadlinePassed
                                              ? 'bg-gray-300 cursor-not-allowed'
                                              : rsvpStatus === 'attending'
                                              ? 'bg-green-500'
                                              : 'bg-gray-400'
                                          }`}
                                        >
                                          <span
                                            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                                              rsvpStatus === 'attending'
                                                ? 'translate-x-7'
                                                : 'translate-x-1'
                                            }`}
                                          />
                                        </button>
                                      </div>

                                      {deadlinePassed ? (
                                        <div className="flex items-start gap-2 text-sm text-amber-700">
                                          <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                          <span>RSVP deadline has passed</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-start gap-2 text-sm text-gray-600">
                                          <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                          <span>
                                            Opt out by {formatDeadline(new Date(event.start_date), rsvpDeadlineDays)}
                                          </span>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}

                            {(() => {
                              const address = buildAddress(event);
                              if (!address) return null;
                              return (
                                <div>
                                  <h4 className="font-semibold text-gray-800 mb-2">Location</h4>
                                  <p className="text-gray-700 mb-2">{address}</p>
                                  <button
                                    onClick={() => handleGetDirections(address)}
                                    className="flex items-center gap-2 py-2 px-4 border-2 border-[#1B2A4A] text-[#1B2A4A] font-semibold rounded-lg hover:bg-[#1B2A4A] hover:text-white transition-colors"
                                  >
                                    <MapPin className="w-4 h-4" />
                                    Get Directions
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            {googleCalendarId ? (
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <iframe
                  src={`https://calendar.google.com/calendar/embed?src=${googleCalendarId}&ctz=America/Denver`}
                  style={{ width: '100%', height: '600px', border: 0 }}
                  title="Google Calendar"
                />
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600">Google Calendar not configured</p>
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </Layout>
  );
}
