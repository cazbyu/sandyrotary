import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  X,
  ChevronDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  MessageSquare,
  Send,
  Loader2,
  Lightbulb,
  Tag,
  CalendarCheck,
  PauseCircle,
  Paperclip,
  Megaphone,
} from 'lucide-react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface LeadershipAction {
  id: string;
  assignment: string;
  description?: string | null;
  responsible_member_id: string | null;
  responsible_member_ids?: string[] | null;
  due_date: string | null;
  status: string;
  is_announcement?: boolean;
  attachment_url?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  responsible_member?: {
    first_name: string;
    last_name: string;
  } | null;
}

interface ActionNote {
  id: string;
  action_id: string;
  note_id: string;
  created_at: string;
  note?: {
    id: string;
    title: string;
    content: string;
    created_at: string;
    attachment_url: string | null;
  };
}

interface MemberOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface IdeaJarItem {
  id: string;
  title: string;
  description?: string;
  source_type: string;
  source_id?: string;
  tags: string[];
  status: 'new' | 'proposed' | 'on_agenda' | 'tabled' | 'completed';
  created_by: string;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: Loader2 },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: X },
];

const IDEA_STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-purple-100 text-purple-700', icon: Lightbulb },
  { value: 'proposed', label: 'Proposed', color: 'bg-amber-100 text-amber-700', icon: Clock },
  { value: 'on_agenda', label: 'On Agenda', color: 'bg-blue-100 text-blue-700', icon: CalendarCheck },
  { value: 'tabled', label: 'Tabled', color: 'bg-gray-100 text-gray-500', icon: PauseCircle },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
];

function getStatusConfig(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
}

function getIdeaStatusConfig(status: string) {
  return IDEA_STATUS_OPTIONS.find((s) => s.value === status) || IDEA_STATUS_OPTIONS[0];
}

export function LeadershipActions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, member } = useAuth();
  const [actions, setActions] = useState<LeadershipAction[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mine' | 'ideas'>('all');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState<Record<string, ActionNote[]>>({});
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const [newAssignment, setNewAssignment] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newResponsible, setNewResponsible] = useState('');
  const [newResponsibleIds, setNewResponsibleIds] = useState<string[]>([]);
  const [newDueDate, setNewDueDate] = useState('');
  const [newStatus, setNewStatus] = useState('pending');
  const [newIsAnnouncement, setNewIsAnnouncement] = useState(false);
  const [newAttachmentFile, setNewAttachmentFile] = useState<File | null>(null);
  const [showPocDropdown, setShowPocDropdown] = useState(false);
  const pocDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('');

  // Idea Jar state
  const [ideas, setIdeas] = useState<IdeaJarItem[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);
  const [editingIdeaStatus, setEditingIdeaStatus] = useState<string | null>(null);
  const [editIdeaStatusValue, setEditIdeaStatusValue] = useState('');
  const [newTagText, setNewTagText] = useState<Record<string, string>>({});
  const [updatingIdea, setUpdatingIdea] = useState<string | null>(null);

  // Close POC dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pocDropdownRef.current && !pocDropdownRef.current.contains(e.target as Node)) {
        setShowPocDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle prefill from navigation state
  useEffect(() => {
    const state = location.state as { prefill?: string } | null;
    if (state?.prefill) {
      setNewAssignment(state.prefill);
      setShowForm(true);
      // Clear the state so it doesn't re-trigger on re-render
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadActions = useCallback(async () => {
    try {
      const query = supabase
        .schema('p0012_rotary')
        .from('leadership_actions')
        .select(`
          *,
          responsible_member:responsible_member_id("members"(first_name, last_name))
        `)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      const mapped = (data || []).map((a: any) => ({
        ...a,
        responsible_member: a.responsible_member?.['members'] ?? null,
      }));

      setActions(mapped);
    } catch (error) {
      console.error('Error loading actions:', error);
      try {
        const { data, error: fallbackError } = await supabase
          .schema('p0012_rotary')
          .from('leadership_actions')
          .select('*')
          .order('due_date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false });

        if (fallbackError) throw fallbackError;
        setActions(data || []);
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
      }
    }
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('members')
        .select('id, first_name, last_name')
        .order('last_name')
        .order('first_name');

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  }, []);

  const loadIdeas = useCallback(async () => {
    setIdeasLoading(true);
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('idea_jar')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIdeas(data || []);
    } catch (error) {
      console.error('Error loading ideas:', error);
    } finally {
      setIdeasLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadActions(), loadMembers()]).finally(() => setLoading(false));
  }, [loadActions, loadMembers]);

  // Load ideas when switching to the ideas tab
  useEffect(() => {
    if (filter === 'ideas' && ideas.length === 0) {
      loadIdeas();
    }
  }, [filter, ideas.length, loadIdeas]);

  const loadNotesForAction = async (actionId: string) => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('leadership_action_notes')
        .select(`
          id, action_id, note_id, created_at,
          note:note_id(id, title, content, created_at, attachment_url)
        `)
        .eq('action_id', actionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActionNotes((prev) => ({ ...prev, [actionId]: data || [] }));
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const handleToggleExpand = (actionId: string) => {
    if (expandedAction === actionId) {
      setExpandedAction(null);
    } else {
      setExpandedAction(actionId);
      if (!actionNotes[actionId]) {
        loadNotesForAction(actionId);
      }
    }
  };

  const toggleResponsibleMember = (memberId: string) => {
    setNewResponsibleIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newAssignment.trim()) return;

    setSubmitting(true);
    try {
      const { data: insertedData, error } = await supabase
        .schema('p0012_rotary')
        .from('leadership_actions')
        .insert({
          assignment: newAssignment.trim(),
          description: newDescription.trim() || null,
          responsible_member_id: newResponsibleIds[0] || newResponsible || null,
          responsible_member_ids: newResponsibleIds.length > 0 ? newResponsibleIds : null,
          due_date: newDueDate || null,
          status: newStatus,
          is_announcement: newIsAnnouncement,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Upload attachment if present
      if (newAttachmentFile && insertedData?.id) {
        const actionId = insertedData.id;
        const fileExt = newAttachmentFile.name.split('.').pop();
        const filePath = `action-${actionId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('action-attachments')
          .upload(filePath, newAttachmentFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('action-attachments')
            .getPublicUrl(filePath);

          if (urlData?.publicUrl) {
            await supabase
              .schema('p0012_rotary')
              .from('leadership_actions')
              .update({ attachment_url: urlData.publicUrl })
              .eq('id', actionId);
          }
        } else {
          console.error('Error uploading attachment:', uploadError);
        }
      }

      setNewAssignment('');
      setNewDescription('');
      setNewResponsible('');
      setNewResponsibleIds([]);
      setNewDueDate('');
      setNewStatus('pending');
      setNewIsAnnouncement(false);
      setNewAttachmentFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowForm(false);
      await loadActions();
    } catch (error) {
      console.error('Error creating action:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (actionId: string, status: string) => {
    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('leadership_actions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', actionId);

      if (error) throw error;
      setEditingAction(null);
      await loadActions();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleAddNote = async (actionId: string) => {
    if (!user || !noteText.trim()) return;

    setAddingNote(true);
    try {
      const { data: noteData, error: noteError } = await supabase
        .schema('p0012_rotary')
        .from('notes')
        .insert({
          user_id: user.id,
          member_id: member?.id || null,
          title: 'Action Note',
          content: noteText.trim(),
        })
        .select('id')
        .single();

      if (noteError) throw noteError;

      const { error: linkError } = await supabase
        .schema('p0012_rotary')
        .from('leadership_action_notes')
        .insert({
          action_id: actionId,
          note_id: noteData.id,
        });

      if (linkError) throw linkError;

      setNoteText('');
      await loadNotesForAction(actionId);
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setAddingNote(false);
    }
  };

  // Idea Jar handlers
  const handleUpdateIdeaStatus = async (ideaId: string, status: string) => {
    setUpdatingIdea(ideaId);
    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('idea_jar')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', ideaId);

      if (error) throw error;
      setEditingIdeaStatus(null);
      await loadIdeas();
    } catch (error) {
      console.error('Error updating idea status:', error);
    } finally {
      setUpdatingIdea(null);
    }
  };

  const handleAddTag = async (ideaId: string) => {
    const tagText = (newTagText[ideaId] || '').trim();
    if (!tagText) return;

    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea) return;

    const currentTags = idea.tags || [];
    if (currentTags.includes(tagText)) {
      setNewTagText((prev) => ({ ...prev, [ideaId]: '' }));
      return;
    }

    setUpdatingIdea(ideaId);
    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('idea_jar')
        .update({
          tags: [...currentTags, tagText],
          updated_at: new Date().toISOString(),
        })
        .eq('id', ideaId);

      if (error) throw error;
      setNewTagText((prev) => ({ ...prev, [ideaId]: '' }));
      await loadIdeas();
    } catch (error) {
      console.error('Error adding tag:', error);
    } finally {
      setUpdatingIdea(null);
    }
  };

  const handleRemoveTag = async (ideaId: string, tagToRemove: string) => {
    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea) return;

    const updatedTags = (idea.tags || []).filter((t) => t !== tagToRemove);

    setUpdatingIdea(ideaId);
    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('idea_jar')
        .update({
          tags: updatedTags,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ideaId);

      if (error) throw error;
      await loadIdeas();
    } catch (error) {
      console.error('Error removing tag:', error);
    } finally {
      setUpdatingIdea(null);
    }
  };

  const getMemberName = (memberId: string | null, action: LeadershipAction) => {
    if (action.responsible_member) {
      return `${action.responsible_member.first_name} ${action.responsible_member.last_name}`;
    }
    if (!memberId) return 'Unassigned';
    const m = members.find((mem) => mem.id === memberId);
    return m ? `${m.first_name} ${m.last_name}` : 'Unknown';
  };

  const getMemberNameById = (memberId: string) => {
    const m = members.find((mem) => mem.id === memberId);
    return m ? `${m.first_name} ${m.last_name}` : 'Unknown';
  };

  const getResponsibleNames = (action: LeadershipAction): string => {
    // If we have the responsible_member_ids array with multiple entries, show all
    if (action.responsible_member_ids && action.responsible_member_ids.length > 0) {
      return action.responsible_member_ids.map((id) => getMemberNameById(id)).join(', ');
    }
    // Fallback to single responsible_member
    return getMemberName(action.responsible_member_id, action);
  };

  const filteredActions = filter === 'mine'
    ? actions.filter((a) => a.responsible_member_id === user?.id)
    : actions;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No due date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isOverdue = (action: LeadershipAction) => {
    if (!action.due_date || action.status === 'completed' || action.status === 'cancelled')
      return false;
    return new Date(action.due_date) < new Date();
  };

  const renderActionsTab = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
            <p className="mt-4 text-gray-600">Loading actions...</p>
          </div>
        </div>
      );
    }

    if (filteredActions.length === 0) {
      return (
        <div className="bg-white rounded-xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {filter === 'mine'
              ? 'No actions assigned to you.'
              : 'No leadership actions yet.'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredActions.map((action) => {
          const statusConfig = getStatusConfig(action.status);
          const StatusIcon = statusConfig.icon;
          const overdue = isOverdue(action);
          const isExpanded = expandedAction === action.id;

          return (
            <div
              key={action.id}
              className={`bg-white rounded-xl shadow-sm overflow-hidden ${
                overdue ? 'border-l-4 border-red-400' : ''
              }`}
            >
              <button
                onClick={() => handleToggleExpand(action.id)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-full ${statusConfig.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 text-sm leading-snug">
                        {action.assignment}
                      </p>
                      {action.is_announcement && (
                        <Megaphone className="w-3.5 h-3.5 text-[#D94F4F] flex-shrink-0" />
                      )}
                    </div>
                    {action.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {action.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {getResponsibleNames(action)}
                      </span>
                      <span
                        className={`text-xs ${
                          overdue ? 'text-red-600 font-medium' : 'text-gray-500'
                        }`}
                      >
                        {overdue ? 'Overdue: ' : ''}
                        {formatDate(action.due_date)}
                      </span>
                      {action.attachment_url && (
                        <a
                          href={action.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-[#3182CE] hover:underline flex items-center gap-1"
                        >
                          <Paperclip className="w-3 h-3" />
                          Attachment
                        </a>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  <div className="flex items-center gap-2 py-3">
                    <span className="text-xs font-medium text-gray-500">Status:</span>
                    {editingAction === action.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="text-xs px-2 py-1 border border-gray-300 rounded-md"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() =>
                            handleUpdateStatus(action.id, editStatus)
                          }
                          className="text-xs bg-[#1B2A4A] text-white px-3 py-1 rounded-md hover:bg-[#2D3E5F] transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingAction(null)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingAction(action.id);
                          setEditStatus(action.status);
                        }}
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusConfig.color} hover:opacity-80 transition-opacity`}
                      >
                        {statusConfig.label}
                      </button>
                    )}
                  </div>

                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      <span className="text-xs font-medium text-gray-500">Notes</span>
                    </div>

                    {actionNotes[action.id]?.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {actionNotes[action.id].map((an) => (
                          <div
                            key={an.id}
                            className="bg-gray-50 rounded-lg p-3"
                          >
                            <p className="text-sm text-gray-700">
                              {(an.note as any)?.content}
                            </p>
                            {(an.note as any)?.attachment_url && (
                              <a
                                href={(an.note as any).attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#3182CE] hover:underline mt-1 inline-block"
                              >
                                View Attachment
                              </a>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              {formatDate((an.note as any)?.created_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={expandedAction === action.id ? noteText : ''}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add a note..."
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddNote(action.id);
                          }
                        }}
                      />
                      <button
                        onClick={() => handleAddNote(action.id)}
                        disabled={addingNote || !noteText.trim()}
                        className="p-2 bg-[#1B2A4A] text-white rounded-lg hover:bg-[#2D3E5F] transition-colors disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderIdeaJarTab = () => {
    if (ideasLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
            <p className="mt-4 text-gray-600">Loading ideas...</p>
          </div>
        </div>
      );
    }

    if (ideas.length === 0) {
      return (
        <div className="bg-white rounded-xl p-8 text-center">
          <Lightbulb className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No ideas in the jar yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Ideas from surveys and suggestions will appear here.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {ideas.map((idea) => {
          const statusConfig = getIdeaStatusConfig(idea.status);
          const StatusIcon = statusConfig.icon;
          const isExpanded = expandedIdea === idea.id;
          const isUpdating = updatingIdea === idea.id;

          return (
            <div
              key={idea.id}
              className="bg-white rounded-xl shadow-sm overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedIdea(isExpanded ? null : idea.id)
                }
                className="w-full p-4 text-left"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-full ${statusConfig.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm leading-snug">
                      {idea.title}
                    </p>
                    {idea.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {idea.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(idea.created_at)}
                      </span>
                    </div>
                    {idea.tags && idea.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {idea.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 text-xs bg-[#1B2A4A]/10 text-[#1B2A4A] px-2 py-0.5 rounded-full"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  {/* Status section */}
                  <div className="flex items-center gap-2 py-3">
                    <span className="text-xs font-medium text-gray-500">Status:</span>
                    {editingIdeaStatus === idea.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <select
                          value={editIdeaStatusValue}
                          onChange={(e) => setEditIdeaStatusValue(e.target.value)}
                          className="text-xs px-2 py-1 border border-gray-300 rounded-md"
                        >
                          {IDEA_STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleUpdateIdeaStatus(idea.id, editIdeaStatusValue)}
                          disabled={isUpdating}
                          className="text-xs bg-[#1B2A4A] text-white px-3 py-1 rounded-md hover:bg-[#2D3E5F] transition-colors disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingIdeaStatus(null)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingIdeaStatus(idea.id);
                          setEditIdeaStatusValue(idea.status);
                        }}
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusConfig.color} hover:opacity-80 transition-opacity`}
                      >
                        {statusConfig.label}
                      </button>
                    )}
                  </div>

                  {/* Quick action buttons */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => handleUpdateIdeaStatus(idea.id, 'on_agenda')}
                      disabled={isUpdating || idea.status === 'on_agenda'}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CalendarCheck className="w-3.5 h-3.5" />
                      Add to Agenda
                    </button>
                    <button
                      onClick={() => handleUpdateIdeaStatus(idea.id, 'tabled')}
                      disabled={isUpdating || idea.status === 'tabled'}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <PauseCircle className="w-3.5 h-3.5" />
                      Table for Later
                    </button>
                  </div>

                  {/* Tags section */}
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4 text-gray-400" />
                      <span className="text-xs font-medium text-gray-500">Tags</span>
                    </div>

                    {idea.tags && idea.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {idea.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 text-xs bg-[#1B2A4A]/10 text-[#1B2A4A] pl-2.5 pr-1 py-1 rounded-full"
                          >
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(idea.id, tag)}
                              disabled={isUpdating}
                              className="ml-0.5 p-0.5 rounded-full hover:bg-[#1B2A4A]/20 transition-colors disabled:opacity-50"
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
                        value={newTagText[idea.id] || ''}
                        onChange={(e) =>
                          setNewTagText((prev) => ({
                            ...prev,
                            [idea.id]: e.target.value,
                          }))
                        }
                        placeholder="Add a tag..."
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddTag(idea.id);
                          }
                        }}
                      />
                      <button
                        onClick={() => handleAddTag(idea.id)}
                        disabled={isUpdating || !(newTagText[idea.id] || '').trim()}
                        className="px-3 py-2 bg-[#1B2A4A] text-white rounded-lg hover:bg-[#2D3E5F] transition-colors disabled:opacity-50 text-xs font-medium"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

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
          <h1 className="text-xl font-bold text-white flex-1">Leadership Actions</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            {showForm ? (
              <X className="w-5 h-5 text-white" />
            ) : (
              <Plus className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        <div className="p-4">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-[#1B2A4A] text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              All Actions
            </button>
            <button
              onClick={() => setFilter('mine')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                filter === 'mine'
                  ? 'bg-[#1B2A4A] text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              My Actions
            </button>
            <button
              onClick={() => setFilter('ideas')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                filter === 'ideas'
                  ? 'bg-[#1B2A4A] text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              Idea Jar
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={handleCreateAction}
              className="bg-white rounded-xl p-5 mb-4 shadow-sm"
            >
              <h3 className="font-semibold text-[#1B2A4A] mb-4">New Action</h3>
              <div className="space-y-4">
                {/* Assignment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assignment
                  </label>
                  <input
                    type="text"
                    value={newAssignment}
                    onChange={(e) => setNewAssignment(e.target.value)}
                    required
                    placeholder="Describe the action item..."
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm"
                  />
                </div>

                {/* Notes / Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes / Description
                  </label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Additional details, context, or notes..."
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm resize-none"
                  />
                </div>

                {/* Responsible POC (Multi-select) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Responsible POC
                  </label>
                  <div className="relative" ref={pocDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowPocDropdown(!showPocDropdown)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-left flex items-center justify-between bg-white hover:bg-gray-50 focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition"
                    >
                      <span className="text-gray-500">
                        {newResponsibleIds.length === 0
                          ? 'Select members...'
                          : `${newResponsibleIds.length} member${newResponsibleIds.length !== 1 ? 's' : ''} selected`}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>

                    {showPocDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {members.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => toggleResponsibleMember(m.id)}
                            className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2 ${
                              newResponsibleIds.includes(m.id) ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center ${
                                newResponsibleIds.includes(m.id)
                                  ? 'bg-[#D94F4F] border-[#D94F4F]'
                                  : 'border-gray-300'
                              }`}
                            >
                              {newResponsibleIds.includes(m.id) && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            {m.first_name} {m.last_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selected member chips */}
                  {newResponsibleIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {newResponsibleIds.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs"
                        >
                          {getMemberNameById(id)}
                          <button type="button" onClick={() => toggleResponsibleMember(id)} className="hover:text-red-600">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Due Date & Status */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <div className="relative">
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm appearance-none bg-white"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Attachment
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 cursor-pointer hover:bg-gray-50 transition">
                      <Paperclip className="w-4 h-4" />
                      <span>{newAttachmentFile ? newAttachmentFile.name : 'Choose file...'}</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setNewAttachmentFile(file);
                        }}
                      />
                    </label>
                    {newAttachmentFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewAttachmentFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Mark as Announcement */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setNewIsAnnouncement(!newIsAnnouncement)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      newIsAnnouncement ? 'bg-[#D94F4F]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        newIsAnnouncement ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Megaphone className="w-4 h-4 text-gray-500" />
                    Mark as Announcement
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !newAssignment.trim()}
                  className="w-full bg-[#1B2A4A] hover:bg-[#2D3E5F] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Create Action'}
                </button>
              </div>
            </form>
          )}

          {filter === 'ideas' ? renderIdeaJarTab() : renderActionsTab()}
        </div>
      </div>
    </Layout>
  );
}
