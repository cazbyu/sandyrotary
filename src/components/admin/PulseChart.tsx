import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface RatingDataPoint {
  date: string;
  avg: number;
}

interface ChoiceDataPoint {
  choice: string;
  count: number;
}

interface SurveyWithChoices {
  id: string;
  meeting_date: string;
  question_text: string;
  choices: string[] | null;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PulseChart() {
  const [ratingData, setRatingData] = useState<RatingDataPoint[]>([]);
  const [choiceData, setChoiceData] = useState<ChoiceDataPoint[]>([]);
  const [latestQuestion, setLatestQuestion] = useState('');
  const [responseCount, setResponseCount] = useState(0);
  const [chartMode, setChartMode] = useState<'ratings' | 'choices'>('ratings');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSurveyData();
  }, []);

  const loadSurveyData = async () => {
    try {
      const { data: surveys, error: surveyError } = await supabase
        .schema('p0012_rotary')
        .from('weekly_surveys')
        .select('id, meeting_date, question_text, choices')
        .order('meeting_date', { ascending: false })
        .limit(12);

      if (surveyError) throw surveyError;
      if (!surveys || surveys.length === 0) {
        setRatingData([]);
        return;
      }

      const surveyIds = surveys.map((s: SurveyWithChoices) => s.id);

      const { data: responses, error: responseError } = await supabase
        .schema('p0012_rotary')
        .from('survey_responses')
        .select('survey_id, rating, choice_index, comment')
        .in('survey_id', surveyIds);

      if (responseError) throw responseError;

      // Check latest survey for choice-based display
      const latestSurvey = surveys[0] as SurveyWithChoices;
      const latestResponses = (responses || []).filter((r) => r.survey_id === latestSurvey.id);

      if (latestSurvey.choices && latestSurvey.choices.length > 0) {
        // Show choice distribution for latest survey
        setLatestQuestion(latestSurvey.question_text);
        setResponseCount(latestResponses.length);

        const choiceCounts: Record<number, number> = {};
        latestResponses.forEach((r) => {
          if (r.choice_index !== null && r.choice_index !== undefined) {
            choiceCounts[r.choice_index] = (choiceCounts[r.choice_index] || 0) + 1;
          }
        });

        const choicePoints: ChoiceDataPoint[] = latestSurvey.choices.map((choice, i) => ({
          choice: choice.length > 15 ? choice.substring(0, 15) + '...' : choice,
          count: choiceCounts[i] || 0,
        }));

        setChoiceData(choicePoints);
        setChartMode('choices');
      } else {
        setChartMode('ratings');
      }

      // Build rating trend data for surveys that have ratings
      const ratingsBySurvey: Record<string, number[]> = {};
      (responses || []).forEach((r) => {
        if (r.rating != null) {
          if (!ratingsBySurvey[r.survey_id]) {
            ratingsBySurvey[r.survey_id] = [];
          }
          ratingsBySurvey[r.survey_id].push(r.rating);
        }
      });

      const points: RatingDataPoint[] = (surveys as SurveyWithChoices[])
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

      setRatingData(points);
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

  if (chartMode === 'choices' && choiceData.length > 0) {
    return (
      <div>
        <p className="text-xs text-gray-500 mb-1">{latestQuestion}</p>
        <p className="text-xs text-gray-400 mb-3">{responseCount} response{responseCount !== 1 ? 's' : ''}</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={choiceData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <XAxis
              dataKey="choice"
              tick={{ fontSize: 10, fill: '#6B7280' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            <YAxis
              allowDecimals={false}
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
              formatter={(value: number | undefined) => [`${value ?? ''}`, 'Responses']}
            />
            <Bar dataKey="count" fill="#D94F4F" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (ratingData.length === 0 && choiceData.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-6">No survey data yet</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={ratingData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
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
