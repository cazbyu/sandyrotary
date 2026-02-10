import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  stage: string;
  source: string;
  referred_by: string | null;
  prospect_date: string;
  referrer_name?: string;
}

const STAGE_COLORS: Record<string, string> = {
  Prospect: 'bg-gray-100 text-gray-700',
  Contacted: 'bg-blue-100 text-blue-700',
  Interested: 'bg-yellow-100 text-yellow-800',
  Proposed: 'bg-orange-100 text-orange-700',
  Approved: 'bg-green-100 text-green-700',
  'New Member': 'bg-[#1B2A4A] text-white',
};

export function ProspectiveMembers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('0012-sr-leads')
        .select('id, first_name, last_name, stage, source, referred_by, prospect_date')
        .not('stage', 'in', '("Declined","Inactive")')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const leadsWithReferrers = await Promise.all(
        (data || []).map(async (lead) => {
          let referrer_name = undefined;
          if (lead.referred_by) {
            const { data: referrer } = await supabase
              .from('0012-sr-members')
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

      setLeads(leadsWithReferrers);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysAgo = (dateStr: string) => {
    const days = Math.floor(
      (new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

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
            <h1 className="text-xl font-bold text-white flex-1">Prospective Members</h1>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
          </div>
        </div>
      </Layout>
    );
  }

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
          <h1 className="text-xl font-bold text-white flex-1">Prospective Members</h1>
        </div>

        <div className="p-4">
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No prospective members at this time</p>
              <p className="text-sm text-gray-500 mt-1">Refer someone to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="bg-white rounded-xl shadow-sm p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-[#1B2A4A] text-lg">
                      {lead.first_name} {lead.last_name}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        STAGE_COLORS[lead.stage] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {lead.stage}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    {lead.referrer_name && (
                      <p>Referred by {lead.referrer_name}</p>
                    )}
                    {lead.prospect_date && (
                      <p className="text-xs text-gray-500">
                        Added {getDaysAgo(lead.prospect_date)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
