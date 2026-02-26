import { BarChart3 } from 'lucide-react';
import { PulseChart } from './PulseChart';
import { SuggestionFeed } from './SuggestionFeed';

export function InsightDashboardCard() {
  return (
    <div className="bg-white rounded-xl shadow-md p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-[#1B2A4A] flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-lg font-bold text-[#1B2A4A]">Insight Dashboard</h2>
      </div>

      {/* Section 1: Weekly Pulse Ratings */}
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Weekly Pulse Ratings
        </h3>
        <PulseChart />
      </div>

      {/* Divider */}
      <hr className="border-gray-100 mb-5" />

      {/* Section 2: Member Suggestions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Member Suggestions
        </h3>
        <SuggestionFeed />
      </div>
    </div>
  );
}
