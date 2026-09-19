import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2, ArrowLeft, Check, Copy } from 'lucide-react';

export function ReferPublic() {
  const [copied, setCopied] = useState(false);

  const joinUrl = `${window.location.origin}/join`;
  const shareTitle = 'Join Sandy Rotary Club';
  const shareText = `Check out Sandy Rotary Club — a great community of local leaders making a difference. Learn more and get invited to a meeting: ${joinUrl}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: joinUrl });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          await copyToClipboard();
        }
      }
    } else {
      await copyToClipboard();
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1B2A4A] to-[#2D3E5F] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="flex justify-center mb-6">
            <img src="/logo-login.png" alt="Sandy Rotary Club" className="w-24 h-24 rounded-full object-contain shadow-lg" />
          </div>

          <h1 className="text-2xl font-bold text-[#1B2A4A] mb-2">
            Refer a Friend
          </h1>

          <div className="text-gray-600 text-sm text-left space-y-3 mb-6">
            <p>
              Know someone who'd make a great Rotarian? Share the link below
              and invite them to learn about Sandy Rotary Club. They'll be
              able to reach out to our Membership Chair and get invited to a
              meeting as a guest.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleShare}
              className="w-full bg-[#1B2A4A] hover:bg-[#2D3E5F] text-white font-semibold py-3 px-6 rounded-lg transition duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  Link Copied!
                </>
              ) : (
                <>
                  {navigator.share ? <Share2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  {navigator.share ? 'Share Invite Link' : 'Copy Invite Link'}
                </>
              )}
            </button>

            <Link
              to="/login"
              className="w-full bg-white hover:bg-gray-50 text-[#1B2A4A] font-semibold py-3 px-6 rounded-lg transition duration-200 border-2 border-[#1B2A4A] flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Sign In
            </Link>
          </div>
        </div>

        <p className="text-white text-center mt-6 text-sm">
          Sandy Rotary Club &bull; District 5420
        </p>
      </div>
    </div>
  );
}
