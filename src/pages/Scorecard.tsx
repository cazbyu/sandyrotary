import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Heart,
  DollarSign,
  BookOpen,
  Loader2,
  ChevronRight,
  Award,
  Clock,
  UserCheck,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { BottomNav } from '../components/BottomNav';
import { supabase } from '../lib/supabase';

// --- Helpers ---

function getRotaryYearRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startYear = month >= 6 ? year : year - 1;
  const endYear = startYear + 1;
  return { startDate: `${startYear}-07-01`, endDate: `${endYear}-06-30` };
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// --- Interfaces ---

interface ProjectSummary {
  description: string;
  totalHours: number;
}

interface StoryItem {
  id: string;
  title: string;
  public_slug: string;
  body: string;
  image_urls: string[] | null;
  created_at: string;
}

interface FundraiserItem {
  id: string;
  name: string;
  goal_amount: number;
  current_amount: number;
}

// --- Component ---

export function Scorecard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Membership
  const [activeMemberCount, setActiveMemberCount] = useState(0);
  const [membershipGoal, setMembershipGoal] = useState(0);

  // Service
  const [projectCount, setProjectCount] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [participantCount, setParticipantCount] = useState(0);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  // Stories
  const [stories, setStories] = useState<StoryItem[]>([]);

  // Fundraisers
  const [happyDollarTotal, setHappyDollarTotal] = useState(0);
  const [membershipDues, setMembershipDues] = useState(0);
  const [fundraiserTotal, setFundraiserTotal] = useState(0);
  const [fundraisers, setFundraisers] = useState<FundraiserItem[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      await Promise.all([
        loadMembership(),
        loadService(),
        loadStories(),
        loadFundraisers(),
      ]);
    } catch (error) {
      console.error('Error loading scorecard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- Membership ---

  const loadMembership = async () => {
    // Active member count
    const { count, error: countError } = await supabase
      .schema('p0012_rotary')
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('member_status', 'Active');

    if (!countError) {
      setActiveMemberCount(count || 0);
    }

    // Membership goal from club_settings
    const { data: goalData } = await supabase
      .schema('p0012_rotary')
      .from('club_settings')
      .select('value')
      .eq('key', 'membership_goal')
      .maybeSingle();

    if (goalData?.value) {
      setMembershipGoal(parseInt(goalData.value, 10) || 0);
    }
  };

  // --- Service ---

  const loadService = async () => {
    const { startDate, endDate } = getRotaryYearRange();

    const { data: volunteerData, error } = await supabase
      .schema('p0012_rotary')
      .from('volunteer_hours')
      .select('id, member_id, hours, description, service_date')
      .gte('service_date', startDate)
      .lte('service_date', endDate);

    if (error) {
      console.error('Error loading volunteer hours:', error);
      return;
    }

    const records = volunteerData || [];

    // Distinct descriptions = project count
    const descriptionSet = new Set<string>();
    const memberSet = new Set<string>();
    let hoursSum = 0;
    const projectMap = new Map<string, number>();

    for (const record of records) {
      const desc = record.description || 'Unnamed Project';
      descriptionSet.add(desc);
      memberSet.add(record.member_id);
      hoursSum += record.hours || 0;
      projectMap.set(desc, (projectMap.get(desc) || 0) + (record.hours || 0));
    }

    setProjectCount(descriptionSet.size);
    setTotalHours(hoursSum);
    setParticipantCount(memberSet.size);

    // Build project list sorted by hours descending
    const projectList: ProjectSummary[] = Array.from(projectMap.entries())
      .map(([description, totalHours]) => ({ description, totalHours }))
      .sort((a, b) => b.totalHours - a.totalHours);

    setProjects(projectList);
  };

  // --- Stories ---

  const loadStories = async () => {
    const { data, error } = await supabase
      .schema('p0012_rotary')
      .from('stories')
      .select('id, title, public_slug, body, image_urls, created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setStories(data as unknown as StoryItem[]);
    }
  };

  // --- Fundraisers ---

  const loadFundraisers = async () => {
    // Happy Dollar Total
    const { data: happyData } = await supabase
      .schema('p0012_rotary')
      .from('club_settings')
      .select('value')
      .eq('key', 'happy_dollar_total')
      .maybeSingle();

    if (happyData?.value) {
      setHappyDollarTotal(parseFloat(happyData.value) || 0);
    }

    // Membership Dues Amount
    const { data: duesData } = await supabase
      .schema('p0012_rotary')
      .from('club_settings')
      .select('value')
      .eq('key', 'membership_dues_amount')
      .maybeSingle();

    // Active member count for dues calculation
    const { count: activeCount } = await supabase
      .schema('p0012_rotary')
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('member_status', 'Active');

    if (duesData?.value && activeCount) {
      const duesPerMember = parseFloat(duesData.value) || 0;
      setMembershipDues(duesPerMember * activeCount);
    }

    // Active fundraiser campaigns
    const { data: campaignData, error } = await supabase
      .schema('p0012_rotary')
      .from('fundraiser_campaigns')
      .select('id, name, goal_amount, current_amount')
      .eq('is_active', true);

    if (!error && campaignData) {
      setFundraisers(campaignData);
      const total = campaignData.reduce((sum, c) => sum + (c.current_amount || 0), 0);
      setFundraiserTotal(total);
    }
  };

  // --- Progress helpers ---

  const membershipPercent = membershipGoal > 0
    ? Math.min(100, Math.round((activeMemberCount / membershipGoal) * 100))
    : 0;

  // --- Render ---

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
            <h1 className="text-xl font-bold text-white flex-1">Club Scorecard</h1>
          </div>
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-[#1B2A4A] mx-auto" />
              <p className="mt-4 text-gray-600">Loading scorecard...</p>
            </div>
          </div>
        </div>
        <BottomNav />
      </Layout>
    );
  }

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
        {/* Header */}
        <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Club Scorecard</h1>
        </div>

        <div className="p-4 space-y-6">

          {/* ============================== */}
          {/* SECTION 1: MEMBERSHIP          */}
          {/* ============================== */}
          <div>
            <h2 className="uppercase tracking-wide text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#D94F4F]" />
              Membership
            </h2>
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <p className="text-4xl font-bold text-[#1B2A4A]">{activeMemberCount}</p>
                  <p className="text-sm text-gray-500 mt-1">Active Members</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-600">{membershipGoal}</p>
                  <p className="text-sm text-gray-500">Goal</p>
                </div>
                <div className="ml-3">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                    membershipPercent >= 100
                      ? 'bg-green-100 text-green-700'
                      : membershipPercent >= 75
                        ? 'bg-blue-100 text-blue-700'
                        : membershipPercent >= 50
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                  }`}>
                    {membershipPercent}%
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${membershipPercent}%`,
                    backgroundColor: membershipPercent >= 100 ? '#22C55E' : '#D94F4F',
                  }}
                />
              </div>
            </div>
          </div>

          {/* ============================== */}
          {/* SECTION 2: SERVICE             */}
          {/* ============================== */}
          <div>
            <h2 className="uppercase tracking-wide text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4 text-[#D94F4F]" />
              Service ({getRotaryYearRange().startDate.slice(0, 4)}-{getRotaryYearRange().endDate.slice(0, 4)})
            </h2>

            {/* Three stat boxes */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <Award className="w-6 h-6 text-[#D94F4F] mx-auto mb-1" />
                <p className="text-2xl font-bold text-[#1B2A4A]">{projectCount}</p>
                <p className="text-xs text-gray-500 mt-1">Projects</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <Clock className="w-6 h-6 text-[#D94F4F] mx-auto mb-1" />
                <p className="text-2xl font-bold text-[#1B2A4A]">{totalHours.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Hours</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <UserCheck className="w-6 h-6 text-[#D94F4F] mx-auto mb-1" />
                <p className="text-2xl font-bold text-[#1B2A4A]">{participantCount}</p>
                <p className="text-xs text-gray-500 mt-1">Participants</p>
              </div>
            </div>

            {/* Project list */}
            {projects.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Project Breakdown
                  </p>
                </div>
                <div className={projects.length > 10 ? 'max-h-60 overflow-y-auto' : ''}>
                  {projects.map((project, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-b-0"
                    >
                      <p className="text-sm text-gray-800 font-medium flex-1 mr-3 truncate">
                        {project.description}
                      </p>
                      <span className="text-sm font-semibold text-[#1B2A4A] whitespace-nowrap">
                        {project.totalHours.toLocaleString()} hrs
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {projects.length === 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm text-center">
                <p className="text-sm text-gray-500">No service hours logged this Rotary year.</p>
              </div>
            )}
          </div>

          {/* ============================== */}
          {/* SECTION 3: IMPACT STORIES      */}
          {/* ============================== */}
          <div>
            <h2 className="uppercase tracking-wide text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#D94F4F]" />
              Impact Stories
            </h2>

            {stories.length === 0 ? (
              <div className="bg-white rounded-xl p-6 shadow-sm text-center">
                <p className="text-sm text-gray-500">No impact stories published yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stories.map((story) => (
                  <div
                    key={story.id}
                    onClick={() => navigate(`/stories/${story.public_slug}`)}
                    className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex"
                  >
                    {story.image_urls && story.image_urls.length > 0 && (
                      <div className="w-24 h-24 flex-shrink-0">
                        <img
                          src={story.image_urls[0]}
                          alt={story.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 p-4 flex items-center justify-between min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#1B2A4A] truncate">
                          {story.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(story.created_at)}
                        </p>
                        {story.body && story.body.toLowerCase().includes('attachment') && (
                          <p className="text-xs text-blue-500 mt-1 italic">
                            Contains attachments
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ============================== */}
          {/* SECTION 4: FUNDRAISERS         */}
          {/* ============================== */}
          <div>
            <h2 className="uppercase tracking-wide text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#D94F4F]" />
              Fundraisers
            </h2>

            {/* Three stat boxes */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">Happy Dollars</p>
                <p className="text-lg font-bold text-[#1B2A4A] leading-tight">
                  {formatCurrency(happyDollarTotal)}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">Member Dues</p>
                <p className="text-lg font-bold text-[#1B2A4A] leading-tight">
                  {formatCurrency(membershipDues)}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">Fundraisers</p>
                <p className="text-lg font-bold text-[#1B2A4A] leading-tight">
                  {formatCurrency(fundraiserTotal)}
                </p>
              </div>
            </div>

            {/* Active fundraisers list */}
            {fundraisers.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Active Campaigns
                  </p>
                </div>
                <div className="divide-y divide-gray-50">
                  {fundraisers.map((campaign) => {
                    const percent = campaign.goal_amount > 0
                      ? Math.min(100, Math.round((campaign.current_amount / campaign.goal_amount) * 100))
                      : 0;
                    return (
                      <div
                        key={campaign.id}
                        onClick={() => navigate(`/fundraiser/${campaign.id}`)}
                        className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-[#1B2A4A] flex-1 truncate mr-2">
                            {campaign.name}
                          </p>
                          <span className="text-xs font-semibold text-gray-600">
                            {formatCurrency(campaign.current_amount)} / {formatCurrency(campaign.goal_amount)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${percent}%`,
                              backgroundColor: percent >= 100 ? '#22C55E' : '#D94F4F',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-6 shadow-sm text-center">
                <p className="text-sm text-gray-500">No active fundraiser campaigns.</p>
              </div>
            )}
          </div>

        </div>
      </div>
      <BottomNav />
    </Layout>
  );
}
