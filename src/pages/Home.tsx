import { useState, useEffect } from 'react';
import {
  User,
  Users,
  Shield,
  Calendar,
  BookOpen,
  Newspaper,
  Camera,
  MessageCircle,
  Heart,
  Info,
  Cake,
  CalendarPlus,
  ClipboardCheck,
  UserCog,
  UserPlus,
  Filter,
  UsersRound,
  Lightbulb,
  ListChecks,
  DollarSign,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { NavCard } from '../components/NavCard';
import { CardGrid } from '../components/CardGrid';
import { BottomNav } from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function Home() {
  const { isAdmin, isLeader } = useAuth();
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
    <Layout>
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
              Club Administration
            </button>
          </div>
        )}

      {activeTab === 'home' && (
        <CardGrid>
          <NavCard to="/my-data" icon={User} label="My Data" />
          <NavCard to="/members" icon={Users} label="Members" />
          <NavCard to="/leadership" icon={Shield} label="Leadership" />
          <NavCard to="/calendar" icon={Calendar} label="Calendar" />
          <NavCard to="/refer" icon={UserPlus} label="Refer Someone" />
          <NavCard to="/attendance-plans" icon={ClipboardCheck} label="My Attendance Plans" />
          <NavCard to="/stories" icon={BookOpen} label="Story" />
          <NavCard to="/bulletins" icon={Newspaper} label="Bulletin" />
          <NavCard to="/selfies" icon={Camera} label="Service Selfies" />
          <NavCard
            icon={MessageCircle}
            label="WhatsApp"
            onClick={handleWhatsAppClick}
          />
          <NavCard to="/deposit-ideas" icon={Lightbulb} label="Deposit Ideas" />
          <NavCard to="/sponsors" icon={Heart} label="Sponsors" />
          <NavCard to="/club-info" icon={Info} label="Club Info" />
        </CardGrid>
      )}

      {activeTab === 'admin' && isLeader && (
        <CardGrid>
          <NavCard to="/leads" icon={Filter} label="Leads" />
          <NavCard to="/prospective-members" icon={UsersRound} label="Prospective Members" />
          <NavCard to="/admin/attendance" icon={ClipboardCheck} label="Attendance Roster" />
          <NavCard to="/admin/add-event" icon={CalendarPlus} label="Add Calendar Event" />
          <NavCard to="/admin/leadership-actions" icon={ListChecks} label="Leadership Actions" />
          <NavCard to="/admin/fundraiser" icon={DollarSign} label="Fundraiser" />
          <NavCard to="/birthdays" icon={Cake} label="Birthdays" />
          {isAdmin && <NavCard to="/admin/members" icon={UserCog} label="Manage Members" />}
        </CardGrid>
      )}
      </div>
      <BottomNav />
    </Layout>
  );
}
