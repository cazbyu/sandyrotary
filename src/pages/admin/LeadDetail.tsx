import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, MessageSquare, ArrowRight, Plus, Building, Briefcase, User, MapPin, Tag } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { BottomNav } from '../../components/BottomNav';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  notes: string | null;
  stage: string;
  source: string;
  referred_by: string | null;
  assigned_to: string | null;
  prospect_date: string;
  contacted_date: string | null;
  interested_date: string | null;
  proposed_date: string | null;
  approved_date: string | null;
  member_date: string | null;
  tags: string[];
  email_opt_in: boolean;
  preferred_contact_method: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  referrer_name?: string;
  assigned_name?: string;
}

interface Activity {
  id: string;
  activity_type: string;
  description: string;
  performed_by: string | null;
  created_at: string;
  performer_name?: string;
}

const STAGE_TIMELINE = [
  { key: 'Prospect', label: 'Prospect', dateField: 'prospect_date' },
  { key: 'Contacted', label: 'Contacted', dateField: 'contacted_date' },
  { key: 'Interested', label: 'Interested', dateField: 'interested_date' },
  { key: 'Proposed', label: 'Proposed', dateField: 'proposed_date' },
  { key: 'Approved', label: 'Approved', dateField: 'approved_date' },
  { key: 'New Member', label: 'Member', dateField: 'member_date' },
];

const DEFAULT_TAGS = ['newsletter', 'event-invite', 'fundraiser', 'meeting-invite', 'holiday-party'];

export function LeadDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { member } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showMoveStage, setShowMoveStage] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newActivity, setNewActivity] = useState({ type: 'Note', description: '' });

  useEffect(() => {
    if (id) loadLeadData();
  }, [id]);

  const loadLeadData = async () => {
    try {
      const { data: leadData, error: leadError } = await supabase
        .schema('p0012_rotary')
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();

      if (leadError) throw leadError;

      let referrer_name = undefined;
      let assigned_name = undefined;

      if (leadData.referred_by) {
        const { data: referrer } = await supabase
          .schema('p0012_rotary')
          .from('members')
          .select('first_name, last_name')
          .eq('id', leadData.referred_by)
          .maybeSingle();
        if (referrer) referrer_name = `${referrer.first_name} ${referrer.last_name}`;
      }

      if (leadData.assigned_to) {
        const { data: assignee } = await supabase
          .schema('p0012_rotary')
          .from('members')
          .select('first_name, last_name')
          .eq('id', leadData.assigned_to)
          .maybeSingle();
        if (assignee) assigned_name = `${assignee.first_name} ${assignee.last_name}`;
      }

      setLead({
        ...leadData,
        tags: leadData.tags || [],
        email_opt_in: leadData.email_opt_in ?? true,
        referrer_name,
        assigned_name,
      });

      const { data: activitiesData, error: activitiesError } = await supabase
        .schema('p0012_rotary')
        .from('lead_activities')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: false });

      if (activitiesError) throw activitiesError;

      const activitiesWithNames = await Promise.all(
        (activitiesData || []).map(async (activity) => {
          let performer_name = undefined;
          if (activity.performed_by) {
            const { data: performer } = await supabase
              .schema('p0012_rotary')
              .from('members')
              .select('first_name, last_name')
              .eq('id', activity.performed_by)
              .maybeSingle();
            if (performer) performer_name = `${performer.first_name} ${performer.last_name}`;
          }
          return { ...activity, performer_name };
        })
      );

      setActivities(activitiesWithNames);
    } catch (error) {
      console.error('Error loading lead data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddActivity = async () => {
    if (!newActivity.description.trim()) return;
    try {
      await supabase.schema('p0012_rotary').from('lead_activities').insert({
        lead_id: id,
        activity_type: newActivity.type,
        description: newActivity.description.trim(),
        performed_by: member!.id,
      });
      setNewActivity({ type: 'Note', description: '' });
      setShowAddActivity(false);
      loadLeadData();
    } catch (error) {
      console.error('Error adding activity:', error);
      alert('Failed to add activity');
    }
  };

  const handleMoveStage = async (newStage: string) => {
    if (!lead) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const updates: Record<string, string> = { stage: newStage };

      const dateMap: Record<string, string> = {
        Contacted: 'contacted_date',
        Interested: 'interested_date',
        Proposed: 'proposed_date',
        Approved: 'approved_date',
        'New Member': 'member_date',
        Declined: 'declined_date',
        Inactive: 'inactive_date',
      };
      if (dateMap[newStage]) updates[dateMap[newStage]] = today;

      await supabase.schema('p0012_rotary').from('leads').update(updates).eq('id', id);
      await supabase.schema('p0012_rotary').from('lead_activities').insert({
        lead_id: id,
        activity_type: 'Stage Change',
        description: `Moved to ${newStage}`,
        performed_by: member!.id,
      });

      setShowMoveStage(false);
      loadLeadData();
    } catch (error) {
      console.error('Error moving stage:', error);
    }
  };

  const handleToggleTag = async (tag: string) => {
    if (!lead) return;
    const newTags = lead.tags.includes(tag)
      ? lead.tags.filter((t) => t !== tag)
      : [...lead.tags, tag];

    try {
      await supabase.schema('p0012_rotary').from('leads').update({ tags: newTags }).eq('id', id);
      setLead({ ...lead, tags: newTags });
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  };

  const getNextStages = () => {
    if (!lead) return [];
    const stageOrder = ['Prospect', 'Contacted', 'Interested', 'Proposed', 'Approved', 'New Member'];
    const currentIndex = stageOrder.indexOf(lead.stage);
    const options = [];
    if (currentIndex >= 0 && currentIndex < stageOrder.length - 1) {
      options.push(stageOrder[currentIndex + 1]);
    }
    if (lead.stage !== 'Declined' && lead.stage !== 'Inactive') {
      options.push('Declined', 'Inactive');
    }
    return options;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      Prospect: 'bg-gray-400', Contacted: 'bg-blue-500', Interested: 'bg-yellow-500',
      Proposed: 'bg-orange-500', Approved: 'bg-green-500', 'New Member': 'bg-[#1B2A4A]',
      Declined: 'bg-red-500', Inactive: 'bg-gray-300',
    };
    return colors[stage] || 'bg-gray-400';
  };

  const getWhatsAppUrl = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const withCountry = cleaned.startsWith('1') ? cleaned : `1${cleaned}`;
    return `https://wa.me/${withCountry}`;
  };

  if (loading) {
    return (
      <Layout showHeader={false}>
        <div className="min-h-screen bg-[#F5F7FA]">
          <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10">
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-xl font-bold text-white">Loading...</h1>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
          </div>
        </div>
        <BottomNav />
    </Layout>
    );
  }

  if (!lead) {
    return (
      <Layout showHeader={false}>
        <div className="min-h-screen bg-[#F5F7FA] p-4 text-center">
          <p className="text-gray-600">Lead not found</p>
        </div>
        <BottomNav />
    </Layout>
    );
  }

  const addressParts = [lead.address, lead.city, lead.state, lead.zip].filter(Boolean);

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F5F7FA]">
        <div className="bg-[#1B2A4A] px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10">
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <span className={`px-3 py-1 rounded-full text-white text-sm font-medium ${getStageColor(lead.stage)}`}>
              {lead.stage}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">{lead.first_name} {lead.last_name}</h1>
        </div>

        <div className="bg-white border-b border-gray-200 px-4 py-3 flex gap-2 overflow-x-auto">
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 whitespace-nowrap">
              <Phone className="w-4 h-4" /> Call
            </a>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email}?subject=Sandy%20Rotary%20Club&body=Hi%20${lead.first_name}%2C%0A%0A`}
              className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 whitespace-nowrap"
            >
              <Mail className="w-4 h-4" /> Email
            </a>
          )}
          {lead.phone && (
            <a href={`sms:${lead.phone}`} className="flex items-center gap-1 px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 whitespace-nowrap">
              <MessageSquare className="w-4 h-4" /> Text
            </a>
          )}
          {lead.phone && (
            <a
              href={getWhatsAppUrl(lead.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap"
            >
              <MessageSquare className="w-4 h-4" /> WhatsApp
            </a>
          )}
          <button
            onClick={() => setShowMoveStage(!showMoveStage)}
            className="flex items-center gap-1 px-4 py-2 bg-[#D94F4F] text-white rounded-lg text-sm font-medium hover:bg-[#C44444] whitespace-nowrap"
          >
            <ArrowRight className="w-4 h-4" /> Move Stage
          </button>
        </div>

        {showMoveStage && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Move to:</p>
            <div className="flex flex-wrap gap-2">
              {getNextStages().map((stage) => (
                <button key={stage} onClick={() => handleMoveStage(stage)} className={`px-3 py-1 rounded-lg text-sm font-medium text-white ${getStageColor(stage)} hover:opacity-90`}>
                  {stage}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 space-y-4">
          <div className="bg-white rounded-lg p-4">
            <h2 className="font-bold text-[#1B2A4A] mb-3">Contact Information</h2>
            <div className="space-y-2 text-sm">
              {lead.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-800">{lead.email}</span>
                  {!lead.email_opt_in && <span className="text-xs text-red-500 ml-1">(opted out)</span>}
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-800">{lead.phone}</span>
                </div>
              )}
              {lead.company && (
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-800">{lead.company}</span>
                </div>
              )}
              {lead.job_title && (
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-800">{lead.job_title}</span>
                </div>
              )}
              {addressParts.length > 0 && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-800">{addressParts.join(', ')}</span>
                </div>
              )}
              {lead.source && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-800">Source: {lead.source}</span>
                  {lead.referrer_name && <span className="text-gray-600">by {lead.referrer_name}</span>}
                </div>
              )}
              {lead.assigned_name && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-800">Assigned to: {lead.assigned_name}</span>
                </div>
              )}
            </div>
            {lead.notes && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">{lead.notes}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-[#1B2A4A]">Tags</h2>
              <button
                onClick={() => setShowTagPicker(!showTagPicker)}
                className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                <Tag className="w-3 h-3" />
                Edit
              </button>
            </div>
            {lead.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {lead.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">{tag}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No tags assigned</p>
            )}
            {showTagPicker && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleToggleTag(tag)}
                      className={`px-2 py-1 rounded-lg text-sm font-medium ${
                        lead.tags.includes(tag) ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-4">
            <h2 className="font-bold text-[#1B2A4A] mb-3">Stage Timeline</h2>
            <div className="relative">
              <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gray-200"></div>
              <div className="space-y-4">
                {STAGE_TIMELINE.map((stage) => {
                  const dateValue = (lead as any)[stage.dateField];
                  const isCompleted = !!dateValue;
                  const isCurrent = lead.stage === stage.key;

                  return (
                    <div key={stage.key} className="relative flex items-start gap-3">
                      <div
                        className={`relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isCompleted ? 'bg-[#1B2A4A] border-[#1B2A4A]' : isCurrent ? 'bg-white border-[#D94F4F]' : 'bg-white border-gray-300'
                        }`}
                      >
                        {isCompleted && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      </div>
                      <div className="flex-1 pt-0.5">
                        <div className={`font-medium ${isCompleted || isCurrent ? 'text-[#1B2A4A]' : 'text-gray-400'}`}>{stage.label}</div>
                        {isCompleted && <div className="text-xs text-gray-500">{formatDate(dateValue)}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-[#1B2A4A]">Activity Feed</h2>
              <button
                onClick={() => setShowAddActivity(!showAddActivity)}
                className="flex items-center gap-1 px-3 py-1 bg-[#D94F4F] text-white rounded-lg text-sm font-medium hover:bg-[#C44444]"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {showAddActivity && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
                <select
                  value={newActivity.type}
                  onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="Note">Note</option>
                  <option value="Call">Call</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Event Invite">Event Invite</option>
                  <option value="Other">Other</option>
                </select>
                <textarea
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                  rows={3}
                  placeholder="Describe the activity..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={handleAddActivity} className="flex-1 py-2 bg-[#D94F4F] text-white rounded-lg text-sm font-medium hover:bg-[#C44444]">
                    Save Activity
                  </button>
                  <button
                    onClick={() => { setShowAddActivity(false); setNewActivity({ type: 'Note', description: '' }); }}
                    className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="border-l-2 border-gray-200 pl-3 pb-3">
                  <span className="text-xs font-medium text-[#D94F4F]">{activity.activity_type}</span>
                  <p className="text-sm text-gray-800 mt-1">{activity.description}</p>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(activity.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                    {activity.performer_name && ` - ${activity.performer_name}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </Layout>
  );
}
