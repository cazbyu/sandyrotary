import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Flame, Settings, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface LayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  showBackButton?: boolean;
  backPath?: string;
  title?: string;
}

export function Layout({ children, showHeader = true, showBackButton = false, backPath = '/', title }: LayoutProps) {
  const { member } = useAuth();
  const navigate = useNavigate();

  if (!showHeader) {
    return <>{children}</>;
  }

  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="bg-[#1B2A4A] rounded-b-3xl shadow-lg pb-8">
        <div className="container mx-auto px-4 pt-6">
          <div className="flex justify-between items-center mb-4">
            {showBackButton ? (
              <button
                onClick={handleBack}
                className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
            ) : (
              <div className="w-12 h-12"></div>
            )}

            {title && (
              <h1 className="text-xl font-bold text-white flex-1 text-center">
                {title}
              </h1>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleSignOut}
                className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-6 h-6 text-white" />
              </button>

              <Link
                to="/settings"
                className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                title="Settings"
              >
                <Settings className="w-6 h-6 text-white" />
              </Link>
            </div>
          </div>

          {!title && (
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
          )}
        </div>
      </header>

      <main className="container mx-auto">
        {children}
      </main>
    </div>
  );
}
