import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Lightbulb, MessageSquare } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { NavCard } from '../../components/NavCard';
import { CardGrid } from '../../components/CardGrid';
import { BottomNav } from '../../components/BottomNav';

export function ServiceGalleryHub() {
  const navigate = useNavigate();

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
        <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4 rounded-b-3xl shadow-lg">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Service Gallery</h1>
        </div>

        <CardGrid>
          <NavCard to="/selfies" icon={Camera} label="Service Selfies" />
          <NavCard to="/deposit-ideas" icon={Lightbulb} label="Notes & Ideas" />
          <NavCard to="/suggestions" icon={MessageSquare} label="Suggestions" />
        </CardGrid>
      </div>
      <BottomNav />
    </Layout>
  );
}
