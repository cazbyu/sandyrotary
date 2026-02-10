import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Building2 } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { truncateText } from '../../lib/slugUtils';

interface Sponsor {
  id: string;
  name: string;
  logo_url?: string;
  description?: string;
  website_url?: string;
  sort_order: number;
}

export function Sponsors() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    loadSponsors();
  }, []);

  const loadSponsors = async () => {
    try {
      const { data, error } = await supabase
        .from('0012-sr-sponsors')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setSponsors(data || []);
    } catch (error) {
      console.error('Error loading sponsors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSponsorClick = (sponsor: Sponsor) => {
    if (sponsor.website_url) {
      window.open(sponsor.website_url, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <Layout showHeader={false}>
        <div className="min-h-screen bg-[#F5F7FA]">
          <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-xl font-bold text-white flex-1">Sponsors</h1>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
              <p className="mt-4 text-gray-600">Loading sponsors...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
        <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Sponsors</h1>
        </div>

        <div className="p-4 space-y-4">
          {sponsors.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No sponsors yet</p>
            </div>
          ) : (
            sponsors.map((sponsor) => (
              <div
                key={sponsor.id}
                onClick={() => handleSponsorClick(sponsor)}
                className={`bg-white rounded-xl shadow-md p-6 ${
                  sponsor.website_url ? 'cursor-pointer hover:shadow-lg' : ''
                } transition-shadow`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {sponsor.logo_url ? (
                      <img
                        src={sponsor.logo_url}
                        alt={sponsor.name}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <Building2 className="w-10 h-10 text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-800 text-lg">{sponsor.name}</h3>
                      {sponsor.website_url && (
                        <ExternalLink className="w-5 h-5 text-[#1B2A4A] flex-shrink-0" />
                      )}
                    </div>

                    {sponsor.description && (
                      <p className="text-gray-600 text-sm mt-2 leading-relaxed">
                        {truncateText(sponsor.description, 150)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
