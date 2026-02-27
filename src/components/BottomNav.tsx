import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, Calendar, BarChart3, Settings, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [whatsappLink, setWhatsappLink] = useState('');

  useEffect(() => {
    loadWhatsAppLink();
  }, []);

  const loadWhatsAppLink = async () => {
    try {
      const { data } = await supabase
        .schema('p0012_rotary')
        .from('club_settings')
        .select('value')
        .eq('key', 'whatsapp_group_link')
        .maybeSingle();
      if (data?.value) setWhatsappLink(data.value);
    } catch {
      // silently fail
    }
  };

  const handleWhatsAppClick = () => {
    if (whatsappLink) {
      window.open(whatsappLink, '_blank');
    }
  };

  const navItems = [
    { key: 'home', label: 'Home', icon: Home, path: '/' },
    { key: 'members', label: 'Members', icon: Users, path: '/members' },
    { key: 'calendar', label: 'Calendar', icon: Calendar, path: '/calendar' },
    { key: 'scorecard', label: 'Scorecard', icon: BarChart3, path: '/scorecard' },
    { key: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex items-center h-16">
        {/* WhatsApp icon on the left */}
        {whatsappLink && (
          <button
            onClick={handleWhatsAppClick}
            className="flex flex-col items-center justify-center w-14 h-full flex-shrink-0"
            title="WhatsApp Group"
          >
            <MessageCircle className="w-6 h-6 text-green-500" />
            <span className="text-[10px] mt-0.5 text-green-600 font-medium">Chat</span>
          </button>
        )}

        {/* Nav items */}
        <div className="flex justify-around items-center flex-1 h-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center flex-1 h-full"
              >
                <Icon
                  className={`w-6 h-6 ${
                    active ? 'text-[#D94F4F]' : 'text-gray-400'
                  }`}
                />
                <span
                  className={`text-xs mt-1 ${
                    active ? 'text-[#D94F4F] font-medium' : 'text-gray-500'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
