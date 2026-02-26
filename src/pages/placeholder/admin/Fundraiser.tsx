import { useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign } from 'lucide-react';
import { Layout } from '../../../components/Layout';
import { BottomNav } from '../../../components/BottomNav';

export function Fundraiser() {
  const navigate = useNavigate();

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
          <h1 className="text-xl font-bold text-white flex-1">Fundraiser</h1>
        </div>

        <div className="p-4">
          <div className="bg-white rounded-xl p-8 text-center">
            <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Coming Soon</h2>
            <p className="text-gray-500 text-sm">
              Fundraiser management tools are being built out. Check back soon!
            </p>
          </div>
        </div>
      </div>
      <BottomNav />
    </Layout>
  );
}
