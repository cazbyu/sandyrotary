import { Link } from 'react-router-dom';
import { UserPlus, Share2, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { joinHref, referHref } from '../lib/publicLinks';

export function AccessDenied() {
  const { signOut } = useAuth();
  const join = joinHref();
  const refer = referHref();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1B2A4A] to-[#2D3E5F] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="flex justify-center mb-6">
            <img src="/logo-login.png" alt="Sandy Rotary Club" className="w-24 h-24 rounded-full object-contain shadow-lg" />
          </div>

          <h1 className="text-2xl font-bold text-[#1B2A4A] mb-2">
            Welcome to Sandy Rotary
          </h1>

          <p className="text-gray-600 mb-6">
            We don't have this email on file as a Sandy Rotary member.
            If you'd like to learn more or know someone who would, we'd love to hear from you.
          </p>

          <div className="space-y-3">
            {join.external ? (
              <a
                href={join.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#1B2A4A] hover:bg-[#2D3E5F] text-white font-semibold py-3 px-6 rounded-lg transition duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Join Rotary
              </a>
            ) : (
              <Link
                to={join.href}
                className="w-full bg-[#1B2A4A] hover:bg-[#2D3E5F] text-white font-semibold py-3 px-6 rounded-lg transition duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Join Rotary
              </Link>
            )}

            {refer.external ? (
              <a
                href={refer.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-white hover:bg-gray-50 text-[#1B2A4A] font-semibold py-3 px-6 rounded-lg transition duration-200 border-2 border-[#1B2A4A] flex items-center justify-center gap-2"
              >
                <Share2 className="w-5 h-5" />
                Refer a Friend
              </a>
            ) : (
              <Link
                to={refer.href}
                className="w-full bg-white hover:bg-gray-50 text-[#1B2A4A] font-semibold py-3 px-6 rounded-lg transition duration-200 border-2 border-[#1B2A4A] flex items-center justify-center gap-2"
              >
                <Share2 className="w-5 h-5" />
                Refer a Friend
              </Link>
            )}
          </div>

          <button
            onClick={handleSignOut}
            className="mt-6 text-gray-500 hover:text-gray-700 text-sm flex items-center justify-center gap-1 mx-auto"
          >
            <LogOut className="w-4 h-4" />
            Signed in with the wrong email? Sign out
          </button>
        </div>

        <p className="text-white text-center mt-6 text-sm">
          Sandy Rotary Club &bull; District 5420
        </p>
      </div>
    </div>
  );
}
