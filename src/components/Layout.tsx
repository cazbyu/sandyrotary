import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
  showHeader?: boolean;
}

export function Layout({ children, showHeader = true }: LayoutProps) {
  const { member } = useAuth();

  if (!showHeader) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="bg-[#1B2A4A] rounded-b-3xl shadow-lg pb-8">
        <div className="container mx-auto px-4 pt-6">
          <div className="flex justify-end mb-4">
            <Link
              to="/settings"
              className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            >
              <Settings className="w-6 h-6 text-white" />
            </Link>
          </div>

          <div className="flex flex-col items-center text-white">
            <div className="w-20 h-20 bg-[#D94F4F] rounded-full flex items-center justify-center shadow-lg mb-4">
              <Flame className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-2xl font-bold mb-1">
              Hi {member?.first_name || 'there'}!
            </h1>

            <p className="text-white/80 text-sm">
              District {member?.district || '5420'}
            </p>

            <p className="text-white/80 text-sm">
              {member?.club_name || 'Sandy'}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto">
        {children}
      </main>
    </div>
  );
}
