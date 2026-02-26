import { Heart } from 'lucide-react';
import { ScorecardWidget } from './ScorecardWidget';
import { SelfieGallery } from './SelfieGallery';

export function ServicePipelineCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Heart className="w-5 h-5 text-[#D94F4F]" />
        <h2 className="text-lg font-bold text-[#1B2A4A]">Service Pipeline</h2>
      </div>

      <ScorecardWidget />

      <div className="border-t border-gray-100 mt-4 pt-4">
        <SelfieGallery />
      </div>
    </div>
  );
}
