import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ChartDataPoint {
  date: string;
  avg: number;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PulseChart() {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSurveyData();
  }, []);

  const loadSurveyData = async () => {
    try {
      const { data: surveys, error: surveyError } = await supabase
        .schema('p0012_rotary')
        .from('weekly_surveys')
        .select('id, meeting_date')
        .order('meeting_date', { ascending: false })
        .limit(12);

      if (surveyError) throw surveyError;
      if (!surveys || surveys.length === 0) {
        setChartData([]);
        return;
      }

      const surveyIds = surveys.map((s) => s.id);

      const { data: responses, error: responseError } = await supabase
        .schema('p0012_rotary')
        .from('survey_responses')
        .select('survey_id, rating')
        .in('survey_id', surveyIds);

      if (responseError) throw responseError;

      const ratingsBySurvey: Record<string, number[]> = {};
      (responses || []).forEach((r) => {
        if (!ratingsBySurvey[r.survey_id]) {
          ratingsBySurvey[r.survey_id] = [];
        }
        ratingsBySurvey[r.survey_id].push(r.rating);
      });

      const points: ChartDataPoint[] = surveys
        .filter((s) => ratingsBySurvey[s.id] && ratingsBySurvey[s.id].length > 0)
        .map((s) => {
          const ratings = ratingsBySurvey[s.id];
          const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
          return {
            date: formatDateLabel(s.meeting_date),
            avg: Math.round(avg * 10) / 10,
          };
        })
        .reverse();

      setChartData(points);
    } catch (error) {
      console.error('Error loading survey data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-6">No survey data yet</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        <YAxis
          domain={[1, 5]}
          ticks={[1, 2, 3, 4, 5]}
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: number | undefined) => [`${value ?? ''}`, 'Avg Rating']}
        />
        <Line
          type="monotone"
          dataKey="avg"
          stroke="#D94F4F"
          strokeWidth={2}
          dot={{ fill: '#D94F4F', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
