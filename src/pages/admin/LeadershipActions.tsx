import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface LeadershipAction {
  id: string;
  assignment: string;
  responsible_member_id: string | null;
  due_date: string | null;
  status: string;
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

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: Loader2 },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: X },
];

function getStatusConfig(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
}

export function LeadershipActions() {
  const navigate = useNavigate();
  const { user, member } = useAuth();
  const [actions, setActions] = useState<LeadershipAction[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'mine' | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState<Record<string, ActionNote[]>>({});
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const [newAssignment, setNewAssignment] = useState('');
  const [newResponsible, setNewResponsible] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newStatus, setNewStatus] = useState('pending');

  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('');

  const loadActions = useCallback(async () => {
    try {
      const query = supabase
        .from('0012-sr-leadership-actions')
        .select(`
          *,
          responsible_member:responsible_member_id("0012-sr-members"(first_name, last_name))
        `)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      const mapped = (data || []).map((a: any) => ({
        ...a,
        responsible_member: a.responsible_member?.['0012-sr-members'] ?? null,
      }));

      setActions(mapped);
    } catch (error) {
      console.error('Error loading actions:', error);
      try {
        const { data, error: fallbackError } = await supabase
          .from('0012-sr-leadership-actions')
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
        .from('0012-sr-members')
        .select('id, first_name, last_name')
        .order('last_name')
        .order('first_name');

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadActions(), loadMembers()]).finally(() => setLoading(false));
  }, [loadActions, loadMembers]);

  const loadNotesForAction = async (actionId: string) => {
    try {
      const { data, error } = await supabase
        .from('0012-sr-leadership-action-notes')
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

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newAssignment.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('0012-sr-leadership-actions').insert({
        assignment: newAssignment.trim(),
        responsible_member_id: newResponsible || null,
        due_date: newDueDate || null,
        status: newStatus,
        created_by: user.id,
      });

      if (error) throw error;

      setNewAssignment('');
      setNewResponsible('');
      setNewDueDate('');
      setNewStatus('pending');
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
        .from('0012-sr-leadership-actions')
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
        .from('0012-sr-notes')
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
        .from('0012-sr-leadership-action-notes')
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

  const getMemberName = (memberId: string | null, action: LeadershipAction) => {
    if (action.responsible_member) {
      return `${action.responsible_member.first_name} ${action.responsible_member.last_name}`;
    }
    if (!memberId) return 'Unassigned';
    const m = members.find((mem) => mem.id === memberId);
    return m ? `${m.first_name} ${m.last_name}` : 'Unknown';
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
          </div>

          {showForm && (
            <form
              onSubmit={handleCreateAction}
              className="bg-white rounded-xl p-5 mb-4 shadow-sm"
            >
              <h3 className="font-semibold text-[#1B2A4A] mb-4">New Action</h3>
              <div className="space-y-4">
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Responsible POC
                  </label>
                  <div className="relative">
                    <select
                      value={newResponsible}
                      onChange={(e) => setNewResponsible(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition text-sm appearance-none bg-white"
                    >
                      <option value="">Select a member...</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.first_name} {m.last_name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

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

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
                <p className="mt-4 text-gray-600">Loading actions...</p>
              </div>
            </div>
          ) : filteredActions.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {filter === 'mine'
                  ? 'No actions assigned to you.'
                  : 'No leadership actions yet.'}
              </p>
            </div>
          ) : (
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
                          <p className="font-semibold text-gray-800 text-sm leading-snug">
                            {action.assignment}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {getMemberName(action.responsible_member_id, action)}
                            </span>
                            <span
                              className={`text-xs ${
                                overdue ? 'text-red-600 font-medium' : 'text-gray-500'
                              }`}
                            >
                              {overdue ? 'Overdue: ' : ''}
                              {formatDate(action.due_date)}
                            </span>
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
          )}
        </div>
      </div>
    </Layout>
  );
}
