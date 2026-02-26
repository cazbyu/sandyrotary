import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

function getRotaryYearRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let startYear: number;
  let endYear: number;

  if (month >= 6) {
    startYear = year;
    endYear = year + 1;
  } else {
    startYear = year - 1;
    endYear = year;
  }

  return {
    startDate: `${startYear}-07-01`,
    endDate: `${endYear}-06-30`,
  };
}

export function ScorecardWidget() {
  const [volunteerHours, setVolunteerHours] = useState<number | null>(null);
  const [participationPercent, setParticipationPercent] = useState<number | null>(null);
  const [availableFunds, setAvailableFunds] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScorecard();
  }, []);

  const loadScorecard = async () => {
    try {
      const { startDate, endDate } = getRotaryYearRange();

      const [hoursRes, attendanceRes, fundsRes] = await Promise.all([
        supabase
          .schema('p0012_rotary')
          .from('volunteer_hours')
          .select('hours')
          .gte('service_date', startDate)
          .lte('service_date', endDate),
        supabase
          .schema('p0012_rotary')
          .from('attendance_records')
          .select('meeting_date, status')
          .gte('meeting_date', startDate)
          .lte('meeting_date', endDate),
        supabase
          .schema('p0012_rotary')
          .from('club_settings')
          .select('value')
          .eq('key', 'available_funds')
          .maybeSingle(),
      ]);

      // Volunteer hours
      if (!hoursRes.error && hoursRes.data) {
        const total = hoursRes.data.reduce(
          (sum: number, r: { hours: number }) => sum + (r.hours || 0),
          0
        );
        setVolunteerHours(Math.round(total));
      }

      // Participation %
      if (!attendanceRes.error && attendanceRes.data) {
        const totalRecords = attendanceRes.data.length;
        const attendedRecords = attendanceRes.data.filter(
          (r: { status: string }) => r.status === 'attended'
        ).length;
        if (totalRecords > 0) {
          setParticipationPercent(Math.round((attendedRecords / totalRecords) * 100));
        } else {
          setParticipationPercent(0);
        }
      }

      // Available funds
      if (!fundsRes.error && fundsRes.data?.value) {
        setAvailableFunds(fundsRes.data.value);
      }
    } catch (error) {
      console.error('Error loading scorecard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFunds = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#1B2A4A]" />
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
        <p className="text-xl font-bold text-[#1B2A4A]">
          {volunteerHours ?? 0}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">Volunteer Hrs</p>
      </div>

      <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
        <p className="text-xl font-bold text-[#1B2A4A]">
          {participationPercent ?? 0}%
        </p>
        <p className="text-xs text-gray-500 mt-0.5">Participation</p>
      </div>

      <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
        <p className="text-xl font-bold text-[#1B2A4A]">
          {availableFunds ? formatFunds(availableFunds) : '--'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">Available Funds</p>
      </div>
    </div>
  );
}
