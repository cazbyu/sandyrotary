import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, Calendar, BarChart3, Settings } from 'lucide-react';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

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
      <div className="flex justify-around items-center h-16">
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
  );
}
