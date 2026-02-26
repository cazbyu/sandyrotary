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
  Send,
  Heart,
  Info,
  Cake,
  CalendarPlus,
  ClipboardCheck,
  UserCog,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { NavCard } from '../components/NavCard';
import { CardGrid } from '../components/CardGrid';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function Home() {
  const { isAdmin } = useAuth();
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
      {isAdmin && (
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
            Administration
          </button>
        </div>
      )}

      {activeTab === 'home' && (
        <CardGrid>
          <NavCard to="/my-data" icon={User} label="My Data" />
          <NavCard to="/members" icon={Users} label="Members" />
          <NavCard to="/leadership" icon={Shield} label="Leadership" />
          <NavCard to="/calendar" icon={Calendar} label="Calendar" />
          <NavCard to="/stories" icon={BookOpen} label="EZ-Story" />
          <NavCard to="/bulletins" icon={Newspaper} label="EZ-Bulletin" />
          <NavCard to="/selfies" icon={Camera} label="Service Selfies" />
          <NavCard
            icon={MessageCircle}
            label="WhatsApp"
            onClick={handleWhatsAppClick}
          />
          <NavCard to="/message" icon={Send} label="Message" />
          <NavCard to="/sponsors" icon={Heart} label="Sponsors" />
          <NavCard to="/club-info" icon={Info} label="Club Info" />
          <NavCard to="/birthdays" icon={Cake} label="Birthdays" />
        </CardGrid>
      )}

      {activeTab === 'admin' && isAdmin && (
        <CardGrid>
          <NavCard to="/admin/add-event" icon={CalendarPlus} label="Add Calendar Event" />
          <NavCard to="/admin/attendance" icon={ClipboardCheck} label="Attendance" />
          <NavCard to="/admin/members" icon={UserCog} label="Manage Members" />
        </CardGrid>
      )}
    </Layout>
  );
}
