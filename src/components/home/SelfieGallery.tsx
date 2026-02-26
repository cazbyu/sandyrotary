import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Selfie {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
}

export function SelfieGallery() {
  const navigate = useNavigate();
  const [selfies, setSelfies] = useState<Selfie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSelfies();
  }, []);

  const loadSelfies = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('service_selfies')
        .select('id, image_url, caption, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSelfies(data || []);
    } catch (error) {
      console.error('Error loading selfies:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#1B2A4A]" />
      </div>
    );
  }

  if (selfies.length === 0) {
    return (
      <div className="text-center py-4">
        <Camera className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No service selfies yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto flex gap-3 pb-2 -mx-1 px-1">
      {selfies.map((selfie) => (
        <img
          key={selfie.id}
          src={selfie.image_url}
          alt={selfie.caption || 'Service selfie'}
          className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
        />
      ))}
      <button
        onClick={() => navigate('/selfies')}
        className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-gray-200 transition-colors"
      >
        <ArrowRight className="w-5 h-5 text-gray-500" />
        <span className="text-xs text-gray-500 font-medium">See All</span>
      </button>
    </div>
  );
}
