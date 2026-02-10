import { useNavigate } from 'react-router-dom';
import { Flame, Mail, ArrowLeft } from 'lucide-react';

export function AccessDenied() {
  const navigate = useNavigate();

  const handleContactAdmin = () => {
    window.location.href = 'mailto:admin@sandyrotary.org?subject=Access Request for Sandy Rotary Club App';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1B2A4A] to-[#2D3E5F] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-[#D94F4F] rounded-full flex items-center justify-center shadow-lg">
              <Flame className="w-12 h-12 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-[#1B2A4A] mb-2">
            Access Restricted
          </h1>

          <p className="text-gray-600 mb-6">
            Your email is not registered as a Sandy Rotary Club member. Please contact your club administrator to be added.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleContactAdmin}
              className="w-full bg-[#D94F4F] hover:bg-[#C44444] text-white font-semibold py-3 px-6 rounded-lg transition duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <Mail className="w-5 h-5" />
              Contact Admin
            </button>

            <button
              onClick={() => navigate('/login')}
              className="w-full bg-white hover:bg-gray-50 text-[#1B2A4A] font-semibold py-3 px-6 rounded-lg transition duration-200 border-2 border-[#1B2A4A] flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Try a Different Email
            </button>
          </div>
        </div>

        <p className="text-white text-center mt-6 text-sm">
          Sandy Rotary Club • District 5420
        </p>
      </div>
    </div>
  );
}
