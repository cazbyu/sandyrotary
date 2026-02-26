import { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { Layout } from '../components/Layout';
import { BottomNav } from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ClubhouseCard } from '../components/home/ClubhouseCard';
import { MyRotaryImpactCard } from '../components/home/MyRotaryImpactCard';
import { ServicePipelineCard } from '../components/home/ServicePipelineCard';
import { ConnectGrowCard } from '../components/home/ConnectGrowCard';
import { MeetingOpsCard } from '../components/admin/MeetingOpsCard';
import { InsightDashboardCard } from '../components/admin/InsightDashboardCard';
import { GrowthPipelineCard } from '../components/admin/GrowthPipelineCard';
import { CampaignHubCard } from '../components/admin/CampaignHubCard';

export function Home() {
  const { isLeader } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'admin'>('home');
  const [whatsappLink, setWhatsappLink] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('club_settings')
        .select('value')
        .eq('key', 'whatsapp_group_link')
        .maybeSingle();

      if (error) throw error;

      if (data?.value) {
        setWhatsappLink(data.value);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleWhatsAppClick = () => {
    if (whatsappLink) {
      window.open(whatsappLink, '_blank');
    } else {
      alert('WhatsApp group link not set up yet. Contact your club admin.');
    }
  };

  return (
    <Layout
      whatsappLink={whatsappLink}
      onWhatsAppClick={handleWhatsAppClick}
    >
      <div className="pb-20">
        {isLeader && (
          <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex-1 py-4 text-center font-semibold transition-colors ${
                activeTab === 'home'
                  ? 'text-[#1B2A4A] border-b-2 border-[#D94F4F]'
                  : 'text-gray-500'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-4 text-center font-semibold transition-colors ${
                activeTab === 'admin'
                  ? 'text-[#1B2A4A] border-b-2 border-[#D94F4F]'
                  : 'text-gray-500'
              }`}
            >
              Command Center
            </button>
          </div>
        )}

        {activeTab === 'home' && (
          <div className="p-4 space-y-4">
            <ClubhouseCard />
            <MyRotaryImpactCard />
            <ServicePipelineCard />
            <ConnectGrowCard />
          </div>
        )}

        {activeTab === 'admin' && isLeader && (
          <div className="p-4 space-y-4">
            <MeetingOpsCard />
            <InsightDashboardCard />
            <GrowthPipelineCard />
            <CampaignHubCard />
          </div>
        )}
      </div>
      <BottomNav />
    </Layout>
  );
}
