import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '../components/Layout';
import { BottomNav } from '../components/BottomNav';
import { SuggestionBox } from '../components/home/SuggestionBox';

export function Suggestions() {
  const navigate = useNavigate();

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
        <div className="bg-[#1B2A4A] px-4 py-4 flex items-center gap-4 rounded-b-3xl shadow-lg">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">Suggestions</h1>
        </div>

        <div className="p-4">
          <SuggestionBox />
        </div>
      </div>
      <BottomNav />
    </Layout>
  );
}
