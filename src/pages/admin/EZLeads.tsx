import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, List, LayoutGrid, Phone, Mail, User, BookUser } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { BottomNav } from '../../components/BottomNav';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ContactListView } from './ContactListView';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  stage: string;
  source: string;
  referred_by: string | null;
  assigned_to: string | null;
  prospect_date: string;
  created_at: string;
  tags: string[];
  email_opt_in: boolean;
  last_contacted_date: string | null;
  referrer_name?: string;
  assigned_name?: string;
}

const STAGES = [
  { key: 'Prospect', label: 'Prospect', color: 'border-gray-400' },
  { key: 'Contacted', label: 'Contacted', color: 'border-blue-500' },
  { key: 'Interested', label: 'Interested', color: 'border-yellow-500' },
  { key: 'Proposed', label: 'Proposed', color: 'border-orange-500' },
  { key: 'Approved', label: 'Approved', color: 'border-green-500' },
  { key: 'New Member', label: 'New Member', color: 'border-[#1B2A4A]' },
];

const INACTIVE_STAGES = [
  { key: 'Declined', label: 'Declined', color: 'border-red-500' },
  { key: 'Inactive', label: 'Inactive', color: 'border-gray-300' },
];

export function EZLeads() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [topView, setTopView] = useState<'pipeline' | 'contacts'>('pipeline');
  const [pipelineMode, setPipelineMode] = useState<'kanban' | 'list'>('kanban');

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      const { data: leadsData, error } = await supabase
        .schema('p0012_rotary')
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const leadsWithNames = await Promise.all(
        (leadsData || []).map(async (lead) => {
          let referrer_name = undefined;
          let assigned_name = undefined;

          if (lead.referred_by) {
            const { data: referrer } = await supabase
              .schema('p0012_rotary')
              .from('members')
              .select('first_name, last_name')
              .eq('id', lead.referred_by)
              .maybeSingle();
            if (referrer) {
              referrer_name = `${referrer.first_name} ${referrer.last_name}`;
            }
          }

          if (lead.assigned_to) {
            const { data: assignee } = await supabase
              .schema('p0012_rotary')
              .from('members')
              .select('first_name, last_name')
              .eq('id', lead.assigned_to)
              .maybeSingle();
            if (assignee) {
              assigned_name = `${assignee.first_name} ${assignee.last_name}`;
            }
          }

          return {
            ...lead,
            tags: lead.tags || [],
            email_opt_in: lead.email_opt_in ?? true,
            referrer_name,
            assigned_name,
          };
        })
      );

      setLeads(leadsWithNames);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStageCounts = () => {
    const counts: Record<string, number> = {};
    [...STAGES, ...INACTIVE_STAGES].forEach((stage) => {
      counts[stage.key] = leads.filter((l) => l.stage === stage.key).length;
    });
    return counts;
  };

  const getDaysInStage = (lead: Lead) => {
    const stageDate = lead.prospect_date;
    if (!stageDate) return 0;
    return Math.floor(
      (new Date().getTime() - new Date(stageDate).getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const getStageColor = (stage: string) => {
    const stageConfig = [...STAGES, ...INACTIVE_STAGES].find((s) => s.key === stage);
    return stageConfig?.color || 'border-gray-400';
  };

  const stageCounts = getStageCounts();

  if (loading) {
    return (
      <Layout showHeader={false}>
        <div className="min-h-screen bg-[#F5F7FA] pb-20">
          <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10">
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-xl font-bold text-white">Leads</h1>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
          </div>
        </div>
        <BottomNav />
    </Layout>
    );
  }

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
        <div className="bg-[#1B2A4A] px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10">
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
              <h1 className="text-xl font-bold text-white ml-4">Leads</h1>
            </div>
            {topView === 'pipeline' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setPipelineMode('kanban')}
                  className={`p-2 rounded-lg ${pipelineMode === 'kanban' ? 'bg-white/20' : 'hover:bg-white/10'}`}
                >
                  <LayoutGrid className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => setPipelineMode('list')}
                  className={`p-2 rounded-lg ${pipelineMode === 'list' ? 'bg-white/20' : 'hover:bg-white/10'}`}
                >
                  <List className="w-5 h-5 text-white" />
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTopView('pipeline')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                topView === 'pipeline' ? 'bg-white text-[#1B2A4A]' : 'bg-white/20 text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Pipeline View
            </button>
            <button
              onClick={() => setTopView('contacts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                topView === 'contacts' ? 'bg-white text-[#1B2A4A]' : 'bg-white/20 text-white'
              }`}
            >
              <BookUser className="w-4 h-4" />
              Contact List
            </button>
          </div>

          {topView === 'pipeline' && (
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-2 min-w-max">
                {STAGES.map((stage) => (
                  <div key={stage.key} className="px-3 py-1 bg-white/20 rounded-full text-white text-sm whitespace-nowrap">
                    {stage.label} ({stageCounts[stage.key] || 0})
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                {INACTIVE_STAGES.map((stage) => (
                  <div key={stage.key} className="px-3 py-1 bg-white/10 rounded-full text-white/70 text-xs whitespace-nowrap">
                    {stage.label} ({stageCounts[stage.key] || 0})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {topView === 'contacts' ? (
          <ContactListView leads={leads} isAdmin={isAdmin} onRefresh={loadLeads} />
        ) : pipelineMode === 'kanban' ? (
          <div className="p-4 overflow-x-auto">
            <div className="flex gap-4 min-w-max pb-4">
              {STAGES.map((stage) => (
                <div key={stage.key} className="flex-shrink-0 w-72">
                  <h3 className="font-bold text-[#1B2A4A] mb-3 px-2">
                    {stage.label} ({stageCounts[stage.key] || 0})
                  </h3>
                  <div className="space-y-3">
                    {leads
                      .filter((lead) => lead.stage === stage.key)
                      .map((lead) => (
                        <div
                          key={lead.id}
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          className={`bg-white rounded-lg p-4 border-l-4 ${getStageColor(lead.stage)} shadow-sm hover:shadow-md cursor-pointer transition-shadow`}
                        >
                          <h4 className="font-bold text-[#1B2A4A] mb-2">
                            {lead.first_name} {lead.last_name}
                          </h4>
                          <div className="space-y-1 text-sm text-gray-600">
                            {lead.source === 'Referral' && lead.referrer_name && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span>Referred by {lead.referrer_name}</span>
                              </div>
                            )}
                            {lead.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                <span className="truncate">{lead.email}</span>
                              </div>
                            )}
                            {lead.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                <span>{lead.phone}</span>
                              </div>
                            )}
                            {(lead.tags || []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {lead.tags.map((tag) => (
                                  <span key={tag} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-2">
                              {getDaysInStage(lead)} days in stage
                            </div>
                            {lead.assigned_name && (
                              <div className="text-xs text-gray-500">Assigned: {lead.assigned_name}</div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="bg-white rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Stage</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Referred By</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {leads.map((lead) => (
                      <tr key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)} className="hover:bg-gray-50 cursor-pointer">
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {lead.first_name} {lead.last_name}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded border-l-4 ${getStageColor(lead.stage)}`}>
                            {lead.stage}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{lead.source}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{lead.referrer_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{getDaysInStage(lead)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </Layout>
  );
}
