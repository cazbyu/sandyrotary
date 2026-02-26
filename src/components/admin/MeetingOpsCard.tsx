import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  ChevronRight,
  ChevronDown,
  Loader2,
  Plus,
  X,
  Calendar,
  Clock,
  Users,
  Megaphone,
  Check,
  XCircle,
} from 'lucide-react';
import {
  supabase,
  WeeklySurvey,
  PostEventSurvey,
  MeetingAgenda,
  MeetingAssignment,
  MEETING_ROLES,
} from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Celebration {
  id: string;
  name: string;
  emoji: string;
  label: string;
  dateObj: Date;
}

interface MemberOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface AssignmentWithMember extends MeetingAssignment {
  assigned_member?: { first_name: string; last_name: string } | null;
}

interface Announcement {
  id: string;
  assignment: string;
  is_announcement: boolean;
  announcement_approved: boolean;
  created_at: string;
  created_by?: string;
}

function getNextWednesday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilWednesday = (3 - dayOfWeek + 7) % 7 || 7;
  const nextWed = new Date(today);
  nextWed.setDate(today.getDate() + daysUntilWednesday);
  return nextWed.toISOString().split('T')[0];
}

function getNextFourWednesdays(): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  // Days until the next Wednesday (if today is Wednesday, include today)
  let daysUntil = (3 - dayOfWeek + 7) % 7;
  if (daysUntil === 0 && today.getDay() === 3) {
    daysUntil = 0; // Include today if it's Wednesday
  } else if (daysUntil === 0) {
    daysUntil = 7;
  }
  const wednesdays: string[] = [];
  for (let i = 0; i < 4; i++) {
    const wed = new Date(today);
    wed.setDate(today.getDate() + daysUntil + i * 7);
    wednesdays.push(wed.toISOString().split('T')[0]);
  }
  return wednesdays;
}

function formatMeetingDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatMeetingDateLong(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function MeetingOpsCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [loadingCelebrations, setLoadingCelebrations] = useState(true);
  const [questionText, setQuestionText] = useState('');
  const [choices, setChoices] = useState<string[]>([]);
  const [newChoice, setNewChoice] = useState('');
  const [meetingDate, setMeetingDate] = useState(getNextWednesday());
  const [submitting, setSubmitting] = useState(false);
  const [activeSurvey, setActiveSurvey] = useState<WeeklySurvey | null>(null);
  const [loadingSurvey, setLoadingSurvey] = useState(true);
  const [activePostSurvey, setActivePostSurvey] = useState<PostEventSurvey | null>(null);
  const [creatingPostSurvey, setCreatingPostSurvey] = useState(false);

  // Collapsible section states
  const [showBirthdays, setShowBirthdays] = useState(true);
  const [showPreSurvey, setShowPreSurvey] = useState(true);
  const [showPostSurvey, setShowPostSurvey] = useState(true);

  // Upcoming Meetings state
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [agendas, setAgendas] = useState<Record<string, MeetingAgenda>>({});
  const [assignments, setAssignments] = useState<Record<string, AssignmentWithMember[]>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [togglingAnnouncement, setTogglingAnnouncement] = useState<string | null>(null);

  const upcomingWednesdays = getNextFourWednesdays();

  useEffect(() => {
    loadCelebrations();
    loadActiveSurvey();
    loadActivePostSurvey();
  }, []);

  // Load upcoming meetings data when section is expanded
  useEffect(() => {
    if (showUpcoming) {
      loadUpcomingData();
    }
  }, [showUpcoming]);

  const loadUpcomingData = async () => {
    setLoadingUpcoming(true);
    try {
      await Promise.all([
        loadAgendas(),
        loadAnnouncements(),
        loadMembers(),
      ]);
    } catch (error) {
      console.error('Error loading upcoming meetings data:', error);
    } finally {
      setLoadingUpcoming(false);
    }
  };

  const loadAgendas = async () => {
    const { data, error } = await supabase
      .schema('p0012_rotary')
      .from('meeting_agendas')
      .select('*')
      .in('meeting_date', upcomingWednesdays);

    if (error) {
      console.error('Error loading agendas:', error);
      return;
    }

    const agendaMap: Record<string, MeetingAgenda> = {};
    (data || []).forEach((a: MeetingAgenda) => {
      agendaMap[a.meeting_date] = a;
    });
    setAgendas(agendaMap);

    // Load assignments for existing agendas
    const agendaIds = (data || []).map((a: MeetingAgenda) => a.id);
    if (agendaIds.length > 0) {
      const { data: assignData, error: assignError } = await supabase
        .schema('p0012_rotary')
        .from('meeting_assignments')
        .select('*, assigned_member:assigned_member_id(first_name, last_name)')
        .in('agenda_id', agendaIds);

      if (assignError) {
        console.error('Error loading assignments:', assignError);
        return;
      }

      const assignMap: Record<string, AssignmentWithMember[]> = {};
      (assignData || []).forEach((a: AssignmentWithMember) => {
        if (!assignMap[a.agenda_id]) assignMap[a.agenda_id] = [];
        assignMap[a.agenda_id].push(a);
      });
      setAssignments(assignMap);
    }
  };

  const loadAnnouncements = async () => {
    const { data, error } = await supabase
      .schema('p0012_rotary')
      .from('leadership_actions')
      .select('*')
      .eq('is_announcement', true);

    if (error) {
      console.error('Error loading announcements:', error);
      return;
    }
    setAnnouncements((data || []) as Announcement[]);
  };

  const loadMembers = async () => {
    const { data, error } = await supabase
      .schema('p0012_rotary')
      .from('members')
      .select('id, first_name, last_name')
      .order('last_name');

    if (error) {
      console.error('Error loading members:', error);
      return;
    }
    setMembers((data || []) as MemberOption[]);
  };

  const ensureAgenda = async (dateStr: string): Promise<MeetingAgenda | null> => {
    // If we already have it cached, return it
    if (agendas[dateStr]) return agendas[dateStr];

    if (!user) return null;

    // Create a new agenda for this date
    const { data, error } = await supabase
      .schema('p0012_rotary')
      .from('meeting_agendas')
      .upsert(
        {
          meeting_date: dateStr,
          start_time: '12:15',
          created_by: user.id,
        },
        { onConflict: 'meeting_date' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error creating agenda:', error);
      return null;
    }

    setAgendas((prev) => ({ ...prev, [dateStr]: data as MeetingAgenda }));
    return data as MeetingAgenda;
  };

  const handleExpandDate = async (dateStr: string) => {
    if (expandedDate === dateStr) {
      setExpandedDate(null);
      return;
    }
    setExpandedDate(dateStr);

    // Ensure agenda exists when expanding
    await ensureAgenda(dateStr);
  };

  const handleAssignMember = async (
    dateStr: string,
    roleKey: string,
    memberId: string | null
  ) => {
    const agenda = agendas[dateStr] || (await ensureAgenda(dateStr));
    if (!agenda) return;

    const saveKey = `${dateStr}-${roleKey}`;
    setSavingRole(saveKey);

    try {
      // Delete existing assignment for this role in this agenda
      await supabase
        .schema('p0012_rotary')
        .from('meeting_assignments')
        .delete()
        .eq('agenda_id', agenda.id)
        .eq('role_type', roleKey);

      // If a member was selected, insert the new assignment
      if (memberId) {
        const { error } = await supabase
          .schema('p0012_rotary')
          .from('meeting_assignments')
          .insert({
            agenda_id: agenda.id,
            role_type: roleKey,
            assigned_member_id: memberId,
          });

        if (error) throw error;
      }

      // Reload assignments for this agenda
      const { data: freshAssignments, error: reloadError } = await supabase
        .schema('p0012_rotary')
        .from('meeting_assignments')
        .select('*, assigned_member:assigned_member_id(first_name, last_name)')
        .eq('agenda_id', agenda.id);

      if (reloadError) throw reloadError;

      setAssignments((prev) => ({
        ...prev,
        [agenda.id]: (freshAssignments || []) as AssignmentWithMember[],
      }));
    } catch (error) {
      console.error('Error saving assignment:', error);
    } finally {
      setSavingRole(null);
    }
  };

  const handleToggleAnnouncement = async (announcementId: string, currentApproved: boolean) => {
    setTogglingAnnouncement(announcementId);
    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('leadership_actions')
        .update({ announcement_approved: !currentApproved })
        .eq('id', announcementId);

      if (error) throw error;

      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === announcementId
            ? { ...a, announcement_approved: !currentApproved }
            : a
        )
      );
    } catch (error) {
      console.error('Error toggling announcement:', error);
    } finally {
      setTogglingAnnouncement(null);
    }
  };

  const getAssignmentForRole = (dateStr: string, roleKey: string): AssignmentWithMember | undefined => {
    const agenda = agendas[dateStr];
    if (!agenda) return undefined;
    const agendaAssignments = assignments[agenda.id] || [];
    return agendaAssignments.find((a) => a.role_type === roleKey);
  };

  const loadCelebrations = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('members')
        .select('id, first_name, last_name, birthday, wedding_anniversary, membership_start_date');

      if (error) throw error;

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const fourWeeksOut = new Date(now);
      fourWeeksOut.setDate(now.getDate() + 28);
      const currentYear = now.getFullYear();
      const allCelebrations: Celebration[] = [];

      (data || []).forEach((member) => {
        if (member.birthday) {
          const date = new Date(member.birthday);
          // Check this year and next year occurrences
          for (const yearOffset of [0, 1]) {
            const thisYearDate = new Date(currentYear + yearOffset, date.getMonth(), date.getDate());
            if (thisYearDate >= now && thisYearDate <= fourWeeksOut) {
              allCelebrations.push({
                id: `${member.id}-birthday-${yearOffset}`,
                name: `${member.first_name} ${member.last_name}`,
                emoji: '\uD83C\uDF82',
                label: 'Birthday',
                dateObj: thisYearDate,
              });
              break;
            }
          }
        }

        if (member.wedding_anniversary) {
          const date = new Date(member.wedding_anniversary);
          for (const yearOffset of [0, 1]) {
            const thisYearDate = new Date(currentYear + yearOffset, date.getMonth(), date.getDate());
            if (thisYearDate >= now && thisYearDate <= fourWeeksOut) {
              const years = currentYear + yearOffset - date.getFullYear();
              allCelebrations.push({
                id: `${member.id}-wedding-${yearOffset}`,
                name: `${member.first_name} ${member.last_name}`,
                emoji: '\uD83D\uDC8D',
                label: years > 0 ? `Wedding (${years} yrs)` : 'Wedding Anniversary',
                dateObj: thisYearDate,
              });
              break;
            }
          }
        }

        if (member.membership_start_date) {
          const date = new Date(member.membership_start_date);
          for (const yearOffset of [0, 1]) {
            const thisYearDate = new Date(currentYear + yearOffset, date.getMonth(), date.getDate());
            if (thisYearDate >= now && thisYearDate <= fourWeeksOut) {
              const years = currentYear + yearOffset - date.getFullYear();
              allCelebrations.push({
                id: `${member.id}-membership-${yearOffset}`,
                name: `${member.first_name} ${member.last_name}`,
                emoji: '\uD83C\uDF97\uFE0F',
                label: years > 0 ? `Member (${years} yrs)` : 'Membership Anniversary',
                dateObj: thisYearDate,
              });
              break;
            }
          }
        }
      });

      allCelebrations.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

      setCelebrations(allCelebrations);
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

  const handleAddChoice = () => {
    const trimmed = newChoice.trim();
    if (trimmed && !choices.includes(trimmed)) {
      setChoices([...choices, trimmed]);
      setNewChoice('');
    }
  };

  const handleRemoveChoice = (index: number) => {
    setChoices(choices.filter((_, i) => i !== index));
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
          survey_type: 'pre_meeting',
          meeting_date: meetingDate,
          created_by: user.id,
          is_active: true,
          choices: choices.length > 0 ? choices : null,
        })
        .select()
        .single();

      if (error) throw error;

      setActiveSurvey(data);
      setQuestionText('');
      setChoices([]);
      setNewChoice('');
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

  const loadActivePostSurvey = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('post_event_surveys')
        .select('*')
        .eq('is_active', true)
        .eq('event_type', 'meeting')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setActivePostSurvey(data);
    } catch (error) {
      console.error('Error loading post-meeting survey:', error);
    }
  };

  const handleCreatePostMeetingSurvey = async () => {
    if (!user) return;
    setCreatingPostSurvey(true);
    try {
      // Deactivate existing
      await supabase
        .schema('p0012_rotary')
        .from('post_event_surveys')
        .update({ is_active: false })
        .eq('is_active', true)
        .eq('event_type', 'meeting');

      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('post_event_surveys')
        .insert({
          event_type: 'meeting',
          event_date: meetingDate || today,
          event_name: `Weekly Meeting - ${formatMeetingDate(meetingDate || today)}`,
          created_by: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      setActivePostSurvey(data);
    } catch (error) {
      console.error('Error creating post-meeting survey:', error);
    } finally {
      setCreatingPostSurvey(false);
    }
  };

  const handleDeactivatePostSurvey = async () => {
    if (!activePostSurvey) return;
    try {
      await supabase
        .schema('p0012_rotary')
        .from('post_event_surveys')
        .update({ is_active: false })
        .eq('id', activePostSurvey.id);
      setActivePostSurvey(null);
    } catch (error) {
      console.error('Error deactivating post-meeting survey:', error);
    }
  };

  const formatCelebrationDate = (dateObj: Date): string => {
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Calculate Sunday availability date for the meeting
  const getSundayBefore = (meetingDateStr: string): string => {
    const meetingDate = new Date(meetingDateStr + 'T00:00:00');
    const dayOfWeek = meetingDate.getDay(); // Wed = 3
    const daysBack = (dayOfWeek + 7 - 0) % 7; // Days back to Sunday
    const sunday = new Date(meetingDate);
    sunday.setDate(meetingDate.getDate() - daysBack);
    return sunday.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const approvedAnnouncements = announcements.filter((a) => a.announcement_approved);
  const pendingAnnouncements = announcements.filter((a) => !a.announcement_approved);

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
      <div className="mb-3">
        <button
          onClick={() => navigate('/admin/attendance')}
          className="w-full bg-[#1B2A4A] hover:bg-[#2D3E5F] text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base"
        >
          Take Attendance
        </button>
      </div>

      {/* Section 1b: Upcoming Meetings */}
      <div className="mb-5">
        <button
          onClick={() => setShowUpcoming(!showUpcoming)}
          className="w-full bg-[#1B2A4A] hover:bg-[#2D3E5F] text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Meetings
          </span>
          {showUpcoming ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </button>

        {showUpcoming && (
          <div className="mt-3 space-y-2">
            {loadingUpcoming ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : (
              upcomingWednesdays.map((dateStr) => {
                const isExpanded = expandedDate === dateStr;
                const agenda = agendas[dateStr];
                const startTime = agenda?.start_time || '12:15';

                return (
                  <div
                    key={dateStr}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Meeting Date Header */}
                    <button
                      onClick={() => handleExpandDate(dateStr)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#1B2A4A]" />
                        <span className="font-medium text-[#1B2A4A] text-sm">
                          {formatMeetingDateLong(dateStr)}
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>

                    {/* Expanded Meeting Details */}
                    {isExpanded && (
                      <div className="px-4 py-3 space-y-4">
                        {/* Meeting Schedule */}
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Clock className="w-4 h-4 text-[#1B2A4A]" />
                          <span>Meeting starts at <strong>{startTime}</strong></span>
                        </div>

                        {/* Assignments Section */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-[#1B2A4A]" />
                            <h4 className="text-sm font-semibold text-[#1B2A4A]">Assignments</h4>
                          </div>
                          <div className="space-y-2">
                            {MEETING_ROLES.map((role) => {
                              const assignment = getAssignmentForRole(dateStr, role.key);
                              const isSaving = savingRole === `${dateStr}-${role.key}`;
                              const assignedName = assignment?.assigned_member
                                ? `${assignment.assigned_member.first_name} ${assignment.assigned_member.last_name}`
                                : null;

                              return (
                                <div
                                  key={role.key}
                                  className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2"
                                >
                                  <span className="text-sm text-gray-700 font-medium min-w-[140px]">
                                    {role.label}
                                  </span>
                                  <div className="flex-1 flex items-center gap-2">
                                    {isSaving ? (
                                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                    ) : (
                                      <select
                                        value={assignment?.assigned_member_id || ''}
                                        onChange={(e) =>
                                          handleAssignMember(
                                            dateStr,
                                            role.key,
                                            e.target.value || null
                                          )
                                        }
                                        className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                                      >
                                        <option value="">Unassigned</option>
                                        {members.map((m) => (
                                          <option key={m.id} value={m.id}>
                                            {m.first_name} {m.last_name}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                    {assignedName && !isSaving && (
                                      <span className="text-xs text-green-600 font-medium whitespace-nowrap">
                                        {assignedName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Announcements Section */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Megaphone className="w-4 h-4 text-[#1B2A4A]" />
                            <h4 className="text-sm font-semibold text-[#1B2A4A]">Announcements</h4>
                          </div>

                          {/* Approved Announcements */}
                          {approvedAnnouncements.length > 0 ? (
                            <div className="space-y-1.5 mb-2">
                              {approvedAnnouncements.map((a) => (
                                <div
                                  key={a.id}
                                  className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
                                >
                                  <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                                  <span className="text-sm text-green-800 flex-1">{a.assignment}</span>
                                  <button
                                    onClick={() => handleToggleAnnouncement(a.id, a.announcement_approved)}
                                    disabled={togglingAnnouncement === a.id}
                                    className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0"
                                    title="Revoke approval"
                                  >
                                    {togglingAnnouncement === a.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <XCircle className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 mb-2">No approved announcements</p>
                          )}

                          {/* Pending Announcements */}
                          {pendingAnnouncements.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500 font-medium mb-1.5">
                                Pending Approval
                              </p>
                              <div className="space-y-1.5">
                                {pendingAnnouncements.map((a) => (
                                  <div
                                    key={a.id}
                                    className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2"
                                  >
                                    <span className="text-sm text-yellow-800 flex-1">{a.assignment}</span>
                                    <button
                                      onClick={() => handleToggleAnnouncement(a.id, a.announcement_approved)}
                                      disabled={togglingAnnouncement === a.id}
                                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded font-medium shrink-0 transition-colors disabled:opacity-50"
                                    >
                                      {togglingAnnouncement === a.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        'Approve'
                                      )}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Section 2: Birthdays and Anniversaries */}
      <div className="mb-5">
        <button
          onClick={() => setShowBirthdays(!showBirthdays)}
          className="w-full flex items-center justify-between mb-3"
        >
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Birthdays &amp; Anniversaries
          </h3>
          <div className="flex items-center gap-2">
            <span
              onClick={(e) => {
                e.stopPropagation();
                navigate('/birthdays');
              }}
              className="text-sm text-[#D94F4F] hover:text-[#B83E3E] font-medium flex items-center gap-1"
            >
              See All
              <ChevronRight className="w-4 h-4" />
            </span>
            <ChevronDown
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                showBirthdays ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {showBirthdays && (
          <>
            <p className="text-xs text-gray-400 mb-2">Coming up in the next 4 weeks</p>

            {loadingCelebrations ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : celebrations.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">No upcoming birthdays or anniversaries</p>
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
                      {c.label} &middot; {formatCelebrationDate(c.dateObj)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Divider */}
      <hr className="border-gray-100 mb-5" />

      {/* Section 3: Pre-Meeting Survey Question */}
      <div>
        <button
          onClick={() => setShowPreSurvey(!showPreSurvey)}
          className="w-full flex items-center justify-between mb-3"
        >
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Pre-Meeting Survey Question
          </h3>
          <ChevronDown
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
              showPreSurvey ? 'rotate-180' : ''
            }`}
          />
        </button>

        {showPreSurvey && (
        <>
        {loadingSurvey ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : activeSurvey ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">Active Survey</p>
              <p className="text-sm text-green-700 mt-1">
                &ldquo;{activeSurvey.question_text}&rdquo;
              </p>
              {activeSurvey.choices && activeSurvey.choices.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-green-600 font-medium mb-1">Choices:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeSurvey.choices.map((choice, i) => (
                      <span
                        key={i}
                        className="inline-block bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full"
                      >
                        {choice}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-green-600 mt-2">
                Meeting: {formatMeetingDate(activeSurvey.meeting_date)}
                {' · '}
                Available from: {getSundayBefore(activeSurvey.meeting_date)}
              </p>
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

          {/* Multiple Choice Options */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Multiple Choice Options (optional)
            </label>
            {choices.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {choices.map((choice, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full"
                  >
                    {choice}
                    <button
                      type="button"
                      onClick={() => handleRemoveChoice(i)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newChoice}
                onChange={(e) => setNewChoice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChoice();
                  }
                }}
                placeholder="Add a choice..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm"
              />
              <button
                type="button"
                onClick={handleAddChoice}
                disabled={!newChoice.trim()}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Meeting Date (Wednesday)</label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Members can respond starting {getSundayBefore(meetingDate)}
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting || !questionText.trim()}
            className="w-full bg-[#D94F4F] hover:bg-[#B83E3E] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {submitting ? 'Creating...' : activeSurvey ? 'Replace Survey' : 'Create Survey'}
          </button>
        </form>
        </>
        )}
      </div>

      {/* Divider */}
      <hr className="border-gray-100 my-5" />

      {/* Section 4: Post-Meeting Survey */}
      <div>
        <button
          onClick={() => setShowPostSurvey(!showPostSurvey)}
          className="w-full flex items-center justify-between mb-3"
        >
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Post-Meeting Survey
          </h3>
          <ChevronDown
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
              showPostSurvey ? 'rotate-180' : ''
            }`}
          />
        </button>
        {showPostSurvey && (
        <>
        <p className="text-xs text-gray-400 mb-3">
          Rates: Meal, Administrative Delivery, Speaker (1-5 stars each)
        </p>
        <button
          onClick={handleCreatePostMeetingSurvey}
          disabled={creatingPostSurvey}
          className="w-full bg-[#1B2A4A] hover:bg-[#2D3E5F] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {creatingPostSurvey ? 'Creating...' : 'Activate Post-Meeting Survey'}
        </button>
        {activePostSurvey && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
            <p className="text-xs font-medium text-blue-800">
              Active: {activePostSurvey.event_name}
            </p>
            <button
              onClick={handleDeactivatePostSurvey}
              className="mt-2 text-xs text-red-600 hover:text-red-800 font-medium"
            >
              Deactivate
            </button>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
