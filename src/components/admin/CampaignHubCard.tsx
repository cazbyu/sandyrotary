import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ExternalLink, ChevronRight, Loader2 } from 'lucide-react';
import { supabase, FundraiserCampaign } from '../../lib/supabase';

interface Sponsor {
  id: string;
  name: string;
  logo_url?: string;
  website_url?: string;
  sort_order: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CampaignHubCard() {
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<FundraiserCampaign | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loadingCampaign, setLoadingCampaign] = useState(true);
  const [loadingSponsors, setLoadingSponsors] = useState(true);

  useEffect(() => {
    loadActiveCampaign();
    loadSponsors();
  }, []);

  const loadActiveCampaign = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('fundraiser_campaigns')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCampaign(data);
    } catch (error) {
      console.error('Error loading campaign:', error);
    } finally {
      setLoadingCampaign(false);
    }
  };

  const loadSponsors = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('sponsors')
        .select('id, name, logo_url, website_url, sort_order')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSponsors(data || []);
    } catch (error) {
      console.error('Error loading sponsors:', error);
    } finally {
      setLoadingSponsors(false);
    }
  };

  const progressPercent = campaign
    ? Math.min((campaign.current_amount / campaign.goal_amount) * 100, 100)
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-md p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-[#1B2A4A] flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-lg font-bold text-[#1B2A4A]">Campaign Hub</h2>
      </div>

      {/* Section 1: Active Fundraiser */}
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Active Fundraiser
        </h3>

        {loadingCampaign ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : !campaign ? (
          <p className="text-sm text-gray-500">No active campaigns</p>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 text-base">{campaign.name}</h4>
            {campaign.description && (
              <p className="text-sm text-gray-600 mt-1">{campaign.description}</p>
            )}

            {/* Progress Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">
                  {formatCurrency(campaign.current_amount)} of {formatCurrency(campaign.goal_amount)} raised
                </span>
                <span className="text-sm font-semibold text-[#D94F4F]">
                  {Math.round(progressPercent)}%
                </span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#D94F4F] rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {campaign.bracket_url && (
              <a
                href={campaign.bracket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-[#1B2A4A] hover:text-[#2D3E5F] transition-colors"
              >
                View Bracket
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <hr className="border-gray-100 mb-5" />

      {/* Section 2: Sponsors */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Sponsors
          </h3>
          <button
            onClick={() => navigate('/sponsors')}
            className="text-sm text-[#D94F4F] hover:text-[#B83E3E] font-medium flex items-center gap-1"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loadingSponsors ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : sponsors.length === 0 ? (
          <p className="text-sm text-gray-500">No sponsors yet</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {sponsors.map((sponsor) => (
              <button
                key={sponsor.id}
                onClick={() => {
                  if (sponsor.website_url) {
                    window.open(sponsor.website_url, '_blank', 'noopener,noreferrer');
                  }
                }}
                className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center ${
                  sponsor.website_url ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
                } transition-shadow`}
                title={sponsor.name}
              >
                {sponsor.logo_url ? (
                  <img
                    src={sponsor.logo_url}
                    alt={sponsor.name}
                    className="w-full h-full object-contain p-1.5"
                  />
                ) : (
                  <div className="w-full h-full bg-[#1B2A4A] flex items-center justify-center">
                    <span className="text-white text-xs font-bold text-center leading-tight px-1">
                      {sponsor.name}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
