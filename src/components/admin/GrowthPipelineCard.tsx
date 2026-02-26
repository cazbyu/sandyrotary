import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UsersRound, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  stage: string;
  prospect_date: string;
  referred_by: string | null;
  created_at: string;
  referrer_name?: string;
}

const ACTIVE_STAGES = ['Prospect', 'Contacted', 'Interested', 'Proposed', 'Approved', 'New Member'];

const STAGE_COLORS: Record<string, string> = {
  Prospect: 'bg-gray-200 text-gray-700',
  Contacted: 'bg-blue-100 text-blue-700',
  Interested: 'bg-yellow-100 text-yellow-800',
  Proposed: 'bg-orange-100 text-orange-700',
  Approved: 'bg-green-100 text-green-700',
  'New Member': 'bg-[#1B2A4A] text-white',
};

function getDaysSince(dateStr: string): number {
  if (!dateStr) return 0;
  return Math.floor(
    (new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function GrowthPipelineCard() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('leads')
        .select('id, first_name, last_name, stage, prospect_date, referred_by, created_at')
        .not('stage', 'in', '("Declined","Inactive")')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Resolve referrer names
      const leadsWithNames = await Promise.all(
        (data || []).map(async (lead) => {
          let referrer_name: string | undefined;

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

          return { ...lead, referrer_name };
        })
      );

      setLeads(leadsWithNames);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const stageCounts: Record<string, number> = {};
  ACTIVE_STAGES.forEach((stage) => {
    stageCounts[stage] = leads.filter((l) => l.stage === stage).length;
  });

  const recentLeads = leads.slice(0, 5);

  return (
    <div className="bg-white rounded-xl shadow-md p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-[#1B2A4A] flex items-center justify-center">
          <UsersRound className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-lg font-bold text-[#1B2A4A]">Growth Pipeline</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Section 1: Pipeline Summary */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Pipeline Summary
            </h3>
            <div className="flex flex-wrap gap-2">
              {ACTIVE_STAGES.filter((stage) => stageCounts[stage] > 0).map((stage) => (
                <span
                  key={stage}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${STAGE_COLORS[stage]}`}
                >
                  {stage} ({stageCounts[stage]})
                </span>
              ))}
              {ACTIVE_STAGES.every((stage) => stageCounts[stage] === 0) && (
                <p className="text-sm text-gray-500">No active leads</p>
              )}
            </div>
          </div>

          {/* Section 2: Prospect List */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Recent Prospects
            </h3>
            {recentLeads.length === 0 ? (
              <p className="text-sm text-gray-500">No prospects yet</p>
            ) : (
              <div className="space-y-3">
                {recentLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="flex items-center gap-3 py-2 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {lead.first_name} {lead.last_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[lead.stage] || 'bg-gray-100 text-gray-600'}`}
                        >
                          {lead.stage}
                        </span>
                        <span className="text-xs text-gray-500">
                          {getDaysSince(lead.prospect_date)} days
                        </span>
                        {lead.referrer_name && (
                          <span className="text-xs text-gray-400">
                            via {lead.referrer_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* View Full Pipeline Button */}
          <button
            onClick={() => navigate('/leads')}
            className="w-full text-center text-sm font-semibold text-[#D94F4F] hover:text-[#B83E3E] py-2 transition-colors flex items-center justify-center gap-1"
          >
            View Full Pipeline
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
