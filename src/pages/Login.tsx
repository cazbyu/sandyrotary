import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Flame, Bug } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [devLoading, setDevLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const state = location.state as { error?: string };
    if (state?.error) {
      setError(state.error);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        setError('Google sign-in is not configured yet. Please use email login.');
      }
    } catch (err) {
      setError('Google sign-in is not configured yet. Please use email login.');
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setError('');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        setError('Apple sign-in is not configured yet. Please use email login.');
      }
    } catch (err) {
      setError('Apple sign-in is not configured yet. Please use email login.');
    }
  };

  const handleEmailPasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid') || error.message.includes('credentials')) {
          setError('Invalid email or password. First time? Try setting up a password below.');
          setShowPasswordSetup(true);
        } else {
          setError(error.message);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: newPassword,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setMessage('Password set successfully! You can now sign in.');
        setShowPasswordSetup(false);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setMagicLinkSent(true);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        setError(error.message);
      } else {
        setMessage('Password reset email sent! Check your inbox.');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1B2A4A] to-[#2D3E5F] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 bg-[#D94F4F] rounded-full flex items-center justify-center shadow-lg">
                <Flame className="w-12 h-12 text-white" />
              </div>
            </div>

            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Check your email!
              </h2>
              <p className="text-gray-600">
                We sent a login link to <span className="font-medium">{email}</span>
              </p>
            </div>
          </div>

          <p className="text-white text-center mt-6 text-sm">
            District 5420 — Sandy
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1B2A4A] to-[#2D3E5F] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-[#D94F4F] rounded-full flex items-center justify-center shadow-lg">
              <Flame className="w-12 h-12 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-[#1B2A4A] text-center mb-2">
            Sandy Rotary Club
          </h1>

          <p className="text-gray-600 text-center mb-8 text-sm">
            District 5420 — Sandy
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm mb-4">
              {message}
            </div>
          )}

          {!showMagicLink && !showPasswordSetup && (
            <>
              <button
                onClick={handleGoogleSignIn}
                className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-lg transition duration-200 border-2 border-gray-300 flex items-center justify-center gap-3 mb-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </button>

              <div className="relative mb-6">
                <button
                  disabled
                  className="w-full bg-gray-200 text-gray-400 font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-3 cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  Sign in with Apple
                </button>
                <span className="absolute -top-2 -right-2 bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shadow">
                  Coming Soon
                </span>
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or sign in with email</span>
                </div>
              </div>

              <form onSubmit={handleEmailPasswordSignIn} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition"
                    placeholder="your.email@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition"
                    placeholder="Enter your password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#1B2A4A] hover:bg-[#2D3E5F] text-white font-semibold py-3 px-6 rounded-lg transition duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="w-full text-[#1B2A4A] text-sm hover:underline"
                >
                  Forgot password?
                </button>

                <p className="text-center text-gray-600 text-sm">
                  First time? Use the same email your club has on file.
                </p>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowMagicLink(true)}
                  className="text-[#D94F4F] hover:underline text-sm font-medium"
                >
                  Send me a Magic Link instead
                </button>
              </div>
            </>
          )}

          {showMagicLink && (
            <>
              <button
                onClick={() => setShowMagicLink(false)}
                className="mb-4 text-[#1B2A4A] hover:underline text-sm flex items-center gap-1"
              >
                ← Back to sign in options
              </button>

              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <label htmlFor="magic-email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    id="magic-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition"
                    placeholder="your.email@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#D94F4F] hover:bg-[#C44444] text-white font-semibold py-3 px-6 rounded-lg transition duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending...' : 'Send Magic Link'}
                </button>

                <p className="text-center text-gray-600 text-sm">
                  We'll email you a link to sign in instantly
                </p>
              </form>
            </>
          )}

          {showPasswordSetup && (
            <>
              <button
                onClick={() => setShowPasswordSetup(false)}
                className="mb-4 text-[#1B2A4A] hover:underline text-sm flex items-center gap-1"
              >
                ← Back to sign in
              </button>

              <h2 className="text-xl font-semibold text-[#1B2A4A] mb-4">
                Set Your Password
              </h2>

              <p className="text-gray-600 text-sm mb-4">
                Create a password to use for future sign-ins.
              </p>

              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition"
                    placeholder="At least 6 characters"
                  />
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent outline-none transition"
                    placeholder="Re-enter password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#D94F4F] hover:bg-[#C44444] text-white font-semibold py-3 px-6 rounded-lg transition duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Setting Password...' : 'Set Password'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordSetup(false);
                    setShowMagicLink(true);
                  }}
                  className="w-full text-gray-600 text-sm hover:underline"
                >
                  Skip for now — use Magic Link
                </button>
              </form>
            </>
          )}
        </div>

        {import.meta.env.VITE_DEV_LOGIN === 'true' && (
          <button
            onClick={async () => {
              setDevLoading(true);
              setError('');
              try {
                const { error } = await supabase.auth.signInWithPassword({
                  email: 'testmember@sandyrotary.dev',
                  password: 'TestMember2026!',
                });
                if (error) setError(error.message);
              } catch {
                setError('Dev auto-login failed');
              } finally {
                setDevLoading(false);
              }
            }}
            disabled={devLoading}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-dashed border-amber-400/60 bg-amber-400/10 text-amber-200 text-sm font-medium hover:bg-amber-400/20 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            <Bug className="w-4 h-4" />
            {devLoading ? 'Signing in...' : 'Dev Auto-Login (Test Member)'}
          </button>
        )}

        <p className="text-white text-center mt-6 text-sm">
          District 5420
        </p>
      </div>
    </div>
  );
}
