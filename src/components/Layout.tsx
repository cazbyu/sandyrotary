import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, ArrowLeft, MessageCircle, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  showBackButton?: boolean;
  backPath?: string;
  title?: string;
  whatsappLink?: string;
  onWhatsAppClick?: () => void;
}

export function Layout({ children, showHeader = true, showBackButton = false, backPath = '/', title, onWhatsAppClick }: LayoutProps) {
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

            <div className="flex items-center gap-1">
              {onWhatsAppClick && (
                <button
                  onClick={onWhatsAppClick}
                  className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                  title="WhatsApp Group"
                >
                  <MessageCircle className="w-6 h-6 text-green-400" />
                </button>
              )}
              <button
                onClick={() => navigate('/settings')}
                className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          {!title && (
            <div className="flex flex-col items-center text-white">
              <div className="w-20 h-20 bg-[#D94F4F] rounded-full flex items-center justify-center shadow-lg mb-4">
                <Flame className="w-10 h-10 text-white" />
              </div>

              <h1 className="text-2xl font-bold mb-1">
                Sandy Rotary Club
              </h1>

              <p className="text-white/80 text-sm mb-1">
                District {member?.district || '5420'} — {member?.club_name || 'Sandy'}
              </p>

              <p className="text-white/60 text-xs">
                Hi {member?.first_name || 'there'}!
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
