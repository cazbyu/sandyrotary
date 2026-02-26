import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Plus,
  Upload,
  Download,
  Send,
  Calendar,
  DollarSign,
  Users,
  ExternalLink,
  Target,
  Info,
  TrendingUp,
  TrendingDown,
  Paperclip,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { BottomNav } from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { supabase, FundraiserCampaign, Member } from '../lib/supabase';

interface FundraiserNote {
  id: string;
  fundraiser_id: string;
  note_id: string;
  created_at: string;
  note: {
    id: string;
    title: string;
    content: string;
    created_at: string;
    attachment_url: string | null;
  };
}

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata: {
    size: number;
    mimetype: string;
  };
}

export function FundraiserDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, member, isLeader } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [fundraiser, setFundraiser] = useState<FundraiserCampaign | null>(null);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  // Notes state
  const [notes, setNotes] = useState<FundraiserNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState<StorageFile[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (id) {
      loadFundraiser();
      loadNotes();
      loadDocuments();
    }
  }, [id]);

  const loadFundraiser = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('fundraiser_campaigns')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setFundraiser(data);

      // Resolve assigned member names
      if (data.assigned_members && data.assigned_members.length > 0) {
        const { data: membersData } = await supabase
          .schema('p0012_rotary')
          .from('members')
          .select('id, first_name, last_name')
          .in('id', data.assigned_members);

        if (membersData) {
          const names: Record<string, string> = {};
          membersData.forEach((m: Pick<Member, 'id' | 'first_name' | 'last_name'>) => {
            names[m.id] = `${m.first_name} ${m.last_name}`;
          });
          setMemberNames(names);
        }
      }
    } catch (error) {
      console.error('Error loading fundraiser:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    setLoadingNotes(true);
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('fundraiser_notes')
        .select('id, fundraiser_id, note_id, created_at, note:note_id(id, title, content, created_at, attachment_url)')
        .eq('fundraiser_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes((data as unknown as FundraiserNote[]) || []);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const loadDocuments = async () => {
    setLoadingDocs(true);
    try {
      const folderPath = `fundraiser-${id}`;
      const { data, error } = await supabase.storage
        .from('fundraiser-docs')
        .list(folderPath, { sortBy: { column: 'created_at', order: 'desc' } });

      if (error) throw error;
      setDocuments((data as unknown as StorageFile[]) || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleAddNote = async () => {
    if (!user || !noteTitle.trim()) return;

    setAddingNote(true);
    try {
      // 1. Create the note record
      const { data: noteData, error: noteError } = await supabase
        .schema('p0012_rotary')
        .from('notes')
        .insert({
          user_id: user.id,
          member_id: member?.id || null,
          title: noteTitle.trim(),
          content: noteContent.trim(),
        })
        .select('id')
        .single();

      if (noteError) throw noteError;

      // 2. Link it via fundraiser_notes
      const { error: linkError } = await supabase
        .schema('p0012_rotary')
        .from('fundraiser_notes')
        .insert({
          fundraiser_id: id,
          note_id: noteData.id,
        });

      if (linkError) throw linkError;

      setNoteTitle('');
      setNoteContent('');
      setShowAddNote(false);
      await loadNotes();
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    try {
      const folderPath = `fundraiser-${id}`;
      const filePath = `${folderPath}/${Date.now()}_${file.name}`;

      const { error } = await supabase.storage
        .from('fundraiser-docs')
        .upload(filePath, file);

      if (error) throw error;
      await loadDocuments();
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getDownloadUrl = (fileName: string) => {
    const folderPath = `fundraiser-${id}`;
    const { data } = supabase.storage
      .from('fundraiser-docs')
      .getPublicUrl(`${folderPath}/${fileName}`);
    return data.publicUrl;
  };

  const handleDownload = async (fileName: string) => {
    try {
      const folderPath = `fundraiser-${id}`;
      const { data, error } = await supabase.storage
        .from('fundraiser-docs')
        .download(`${folderPath}/${fileName}`);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.replace(/^\d+_/, '');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file');
    }
  };

  const handleDeleteDoc = async (fileName: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      const folderPath = `fundraiser-${id}`;
      const { error } = await supabase.storage
        .from('fundraiser-docs')
        .remove([`${folderPath}/${fileName}`]);

      if (error) throw error;
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getProgressPercent = () => {
    if (!fundraiser || !fundraiser.goal_amount || fundraiser.goal_amount === 0) return 0;
    return Math.min(100, Math.round((fundraiser.current_amount / fundraiser.goal_amount) * 100));
  };

  const getDisplayFileName = (name: string) => {
    // Strip the timestamp prefix we added during upload
    return name.replace(/^\d+_/, '');
  };

  // Loading state
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
            <h1 className="text-xl font-bold text-white flex-1">Loading...</h1>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
              <p className="mt-4 text-gray-600">Loading fundraiser...</p>
            </div>
          </div>
        </div>
        <BottomNav />
    </Layout>
    );
  }

  // Not found state
  if (!fundraiser) {
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
            <h1 className="text-xl font-bold text-white flex-1">Fundraiser</h1>
          </div>
          <div className="text-center py-12">
            <p className="text-gray-600">Fundraiser not found</p>
          </div>
        </div>
        <BottomNav />
    </Layout>
    );
  }

  const progressPercent = getProgressPercent();

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F5F7FA]">
        {/* Header */}
        <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1 truncate">
            {fundraiser.name}
          </h1>
          {fundraiser.bracket_url && (
            <a
              href={fundraiser.bracket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
              title="View Bracket"
            >
              <ExternalLink className="w-5 h-5 text-white" />
            </a>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Progress Card */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-[#1B2A4A] flex items-center gap-2">
                <Target className="w-5 h-5 text-[#D94F4F]" />
                Fundraising Progress
              </h2>
              <span className="text-sm font-semibold text-[#D94F4F]">{progressPercent}%</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-4 mb-3 overflow-hidden">
              <div
                className="h-4 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: '#D94F4F',
                }}
              />
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Raised: <span className="font-semibold text-[#1B2A4A]">{formatCurrency(fundraiser.current_amount)}</span>
              </span>
              <span className="text-gray-600">
                Goal: <span className="font-semibold text-[#1B2A4A]">{formatCurrency(fundraiser.goal_amount)}</span>
              </span>
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-bold text-[#1B2A4A] mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-[#D94F4F]" />
              Details
            </h2>

            <div className="space-y-4">
              {fundraiser.description && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</label>
                  <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{fundraiser.description}</p>
                </div>
              )}

              {fundraiser.purpose && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Purpose</label>
                  <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{fundraiser.purpose}</p>
                </div>
              )}

              {fundraiser.details && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Additional Details</label>
                  <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{fundraiser.details}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <label className="text-xs font-medium text-gray-500">Start Date</label>
                    <p className="text-sm text-gray-800">{formatDate(fundraiser.start_date)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <label className="text-xs font-medium text-gray-500">End Date</label>
                    <p className="text-sm text-gray-800">{formatDate(fundraiser.end_date)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <TrendingDown className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <label className="text-xs font-medium text-gray-500">Est. Costs</label>
                    <p className="text-sm text-gray-800">{formatCurrency(fundraiser.estimated_costs)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <label className="text-xs font-medium text-gray-500">Est. Revenues</label>
                    <p className="text-sm text-gray-800">{formatCurrency(fundraiser.estimated_revenues)}</p>
                  </div>
                </div>
              </div>

              {fundraiser.bracket_url && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bracket / External Link</label>
                  <a
                    href={fundraiser.bracket_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#3182CE] hover:underline flex items-center gap-1 mt-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {fundraiser.bracket_url}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Assigned Members Card */}
          {fundraiser.assigned_members && fundraiser.assigned_members.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="font-bold text-[#1B2A4A] mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#D94F4F]" />
                Assigned Members
              </h2>
              <div className="flex flex-wrap gap-2">
                {fundraiser.assigned_members.map((memberId) => (
                  <span
                    key={memberId}
                    className="px-3 py-1.5 bg-[#F0F4FA] text-[#1B2A4A] rounded-lg text-sm font-medium"
                  >
                    {memberNames[memberId] || 'Loading...'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes Card */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#1B2A4A] flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#D94F4F]" />
                Notes
              </h2>
              {isLeader && (
                <button
                  onClick={() => setShowAddNote(!showAddNote)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#D94F4F] text-white rounded-lg text-sm font-medium hover:bg-[#C44444] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Note
                </button>
              )}
            </div>

            {/* Add Note Form */}
            {showAddNote && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Note title..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                />
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Write your note here..."
                  rows={4}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddNote}
                    disabled={addingNote || !noteTitle.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#D94F4F] text-white rounded-lg text-sm font-medium hover:bg-[#C44444] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingNote ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {addingNote ? 'Saving...' : 'Save Note'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddNote(false);
                      setNoteTitle('');
                      setNoteContent('');
                    }}
                    className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Notes List */}
            {loadingNotes ? (
              <div className="flex items-center justify-center py-6">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B2A4A]"></div>
              </div>
            ) : notes.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No notes yet.</p>
            ) : (
              <div className="space-y-3">
                {notes.map((fn) => (
                  <div key={fn.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="text-sm font-semibold text-[#1B2A4A]">
                        {fn.note?.title || 'Untitled'}
                      </h3>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                        {formatDate(fn.note?.created_at)}
                      </span>
                    </div>
                    {fn.note?.content && (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">
                        {fn.note.content}
                      </p>
                    )}
                    {fn.note?.attachment_url && (
                      <a
                        href={fn.note.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#3182CE] hover:underline mt-2"
                      >
                        <Paperclip className="w-3 h-3" />
                        View Attachment
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents Card */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#1B2A4A] flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#D94F4F]" />
                Documents
              </h2>
              {isLeader && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#D94F4F] text-white rounded-lg text-sm font-medium hover:bg-[#C44444] transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {loadingDocs ? (
              <div className="flex items-center justify-center py-6">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B2A4A]"></div>
              </div>
            ) : documents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id || doc.name}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {getDisplayFileName(doc.name)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {doc.metadata?.size ? formatFileSize(doc.metadata.size) : ''}
                        {doc.created_at ? ` - ${formatDate(doc.created_at)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleDownload(doc.name)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-[#3182CE]" />
                      </button>
                      {isLeader && (
                        <button
                          onClick={() => handleDeleteDoc(doc.name)}
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </Layout>
  );
}
