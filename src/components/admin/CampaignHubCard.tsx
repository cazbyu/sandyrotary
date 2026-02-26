import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  ExternalLink,
  ChevronRight,
  Loader2,
  Plus,
  X,
  Calendar,
  Users as UsersIcon,
  ChevronDown,
} from 'lucide-react';
import { supabase, FundraiserCampaign } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Sponsor {
  id: string;
  name: string;
  logo_url?: string;
  website_url?: string;
  sort_order: number;
}

interface MemberOption {
  id: string;
  first_name: string;
  last_name: string;
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
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<FundraiserCampaign[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingSponsors, setLoadingSponsors] = useState(true);

  // Add Fundraiser form state
  const [showForm, setShowForm] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    goal_amount: '',
    estimated_costs: '',
    estimated_revenues: '',
    purpose: '',
    details: '',
    assigned_members: [] as string[],
  });
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  useEffect(() => {
    loadCampaigns();
    loadSponsors();
  }, []);

  const loadCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('fundraiser_campaigns')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoadingCampaigns(false);
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

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('members')
        .select('id, first_name, last_name')
        .eq('is_active', true)
        .order('first_name', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const handleOpenForm = () => {
    setShowForm(true);
    loadMembers();
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setFormData({
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      goal_amount: '',
      estimated_costs: '',
      estimated_revenues: '',
      purpose: '',
      details: '',
      assigned_members: [],
    });
    setShowMemberDropdown(false);
  };

  const toggleMember = (memberId: string) => {
    setFormData((prev) => ({
      ...prev,
      assigned_members: prev.assigned_members.includes(memberId)
        ? prev.assigned_members.filter((id) => id !== memberId)
        : [...prev.assigned_members, memberId],
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .schema('p0012_rotary')
        .from('fundraiser_campaigns')
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          goal_amount: formData.goal_amount ? parseFloat(formData.goal_amount) : null,
          estimated_costs: formData.estimated_costs ? parseFloat(formData.estimated_costs) : null,
          estimated_revenues: formData.estimated_revenues ? parseFloat(formData.estimated_revenues) : null,
          purpose: formData.purpose.trim() || null,
          details: formData.details.trim() || null,
          assigned_members: formData.assigned_members.length > 0 ? formData.assigned_members : null,
          is_active: true,
        });

      if (error) throw error;
      handleCloseForm();
      loadCampaigns();
    } catch (error) {
      console.error('Error creating fundraiser:', error);
      alert('Failed to create fundraiser');
    } finally {
      setSaving(false);
    }
  };

  const getMemberName = (id: string) => {
    const m = members.find((m) => m.id === id);
    return m ? `${m.first_name} ${m.last_name}` : '';
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1B2A4A] flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-bold text-[#1B2A4A]">Fundraising Hub</h2>
        </div>
        <button
          onClick={handleOpenForm}
          className="w-8 h-8 rounded-full bg-[#D94F4F] text-white flex items-center justify-center hover:bg-[#B83E3E] transition-colors shadow-sm"
          title="Add Fundraiser"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Add Fundraiser Form */}
      {showForm && (
        <div className="mb-5 border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">New Fundraiser</h3>
            <button onClick={handleCloseForm} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                placeholder="Fundraiser name"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none resize-none"
                rows={2}
                placeholder="Brief description"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Financial */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Goal ($)</label>
                <input
                  type="number"
                  value={formData.goal_amount}
                  onChange={(e) => setFormData({ ...formData, goal_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Est. Costs ($)</label>
                <input
                  type="number"
                  value={formData.estimated_costs}
                  onChange={(e) => setFormData({ ...formData, estimated_costs: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Est. Revenue ($)</label>
                <input
                  type="number"
                  value={formData.estimated_revenues}
                  onChange={(e) => setFormData({ ...formData, estimated_revenues: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Purpose</label>
              <input
                type="text"
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none"
                placeholder="What is the fundraiser for?"
              />
            </div>

            {/* Details */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Details</label>
              <textarea
                value={formData.details}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none resize-none"
                rows={3}
                placeholder="Additional details, logistics, etc."
              />
            </div>

            {/* Assigned Members */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                <UsersIcon className="w-3 h-3 inline mr-1" />
                Assigned Members
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left flex items-center justify-between bg-white hover:bg-gray-50"
                >
                  <span className="text-gray-500">
                    {formData.assigned_members.length === 0
                      ? 'Select members...'
                      : `${formData.assigned_members.length} member${formData.assigned_members.length !== 1 ? 's' : ''} selected`}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {showMemberDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => toggleMember(m.id)}
                        className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2 ${
                          formData.assigned_members.includes(m.id) ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            formData.assigned_members.includes(m.id)
                              ? 'bg-[#D94F4F] border-[#D94F4F]'
                              : 'border-gray-300'
                          }`}
                        >
                          {formData.assigned_members.includes(m.id) && (
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
              {formData.assigned_members.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.assigned_members.map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs"
                    >
                      {getMemberName(id)}
                      <button onClick={() => toggleMember(id)} className="hover:text-red-600">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!formData.name.trim() || saving}
              className="w-full py-2.5 bg-[#D94F4F] text-white rounded-lg text-sm font-semibold hover:bg-[#B83E3E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Fundraiser'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Active Fundraisers */}
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Active Fundraisers
        </h3>

        {loadingCampaigns ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-gray-500">No active fundraisers</p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const progressPercent = campaign.goal_amount
                ? Math.min((campaign.current_amount / campaign.goal_amount) * 100, 100)
                : 0;

              return (
                <button
                  key={campaign.id}
                  onClick={() => navigate(`/fundraiser/${campaign.id}`)}
                  className="w-full bg-gray-50 rounded-lg p-4 text-left hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-800 text-base">{campaign.name}</h4>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                  {campaign.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{campaign.description}</p>
                  )}

                  {/* Progress Bar */}
                  {campaign.goal_amount > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          {formatCurrency(campaign.current_amount)} of {formatCurrency(campaign.goal_amount)}
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
                  )}

                  {campaign.bracket_url && (
                    <span className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-[#1B2A4A]">
                      View Bracket
                      <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
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
