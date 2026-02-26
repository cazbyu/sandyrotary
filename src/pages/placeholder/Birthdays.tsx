import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { BottomNav } from '../../components/BottomNav';
import { supabase } from '../../lib/supabase';

interface Celebration {
  id: string;
  first_name: string;
  last_name: string;
  profile_photo_url: string;
  type: 'birthday' | 'wedding' | 'membership';
  date: string;
  month: number;
  day: number;
  years?: number;
}

export function Birthdays() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [thisMonthCelebrations, setThisMonthCelebrations] = useState<Celebration[]>([]);
  const [nextMonthCelebrations, setNextMonthCelebrations] = useState<Celebration[]>([]);

  useEffect(() => {
    loadCelebrations();
  }, []);

  const loadCelebrations = async () => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('members')
        .select('id, first_name, last_name, profile_photo_url, birthday, wedding_anniversary, membership_start_date');

      if (error) throw error;

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const currentYear = now.getFullYear();

      const celebrations: Celebration[] = [];

      (data || []).forEach((member) => {
        if (member.birthday) {
          const date = new Date(member.birthday);
          const month = date.getMonth() + 1;
          const day = date.getDate();

          celebrations.push({
            id: `${member.id}-birthday`,
            first_name: member.first_name,
            last_name: member.last_name,
            profile_photo_url: member.profile_photo_url,
            type: 'birthday',
            date: member.birthday,
            month,
            day,
          });
        }

        if (member.wedding_anniversary) {
          const date = new Date(member.wedding_anniversary);
          const month = date.getMonth() + 1;
          const day = date.getDate();
          const years = currentYear - date.getFullYear();

          celebrations.push({
            id: `${member.id}-wedding`,
            first_name: member.first_name,
            last_name: member.last_name,
            profile_photo_url: member.profile_photo_url,
            type: 'wedding',
            date: member.wedding_anniversary,
            month,
            day,
            years: years > 0 ? years : undefined,
          });
        }

        if (member.membership_start_date) {
          const date = new Date(member.membership_start_date);
          const month = date.getMonth() + 1;
          const day = date.getDate();
          const years = currentYear - date.getFullYear();

          celebrations.push({
            id: `${member.id}-membership`,
            first_name: member.first_name,
            last_name: member.last_name,
            profile_photo_url: member.profile_photo_url,
            type: 'membership',
            date: member.membership_start_date,
            month,
            day,
            years: years > 0 ? years : undefined,
          });
        }
      });

      const thisMonth = celebrations
        .filter((c) => c.month === currentMonth)
        .sort((a, b) => a.day - b.day);

      const nextMonthList = celebrations
        .filter((c) => c.month === nextMonth)
        .sort((a, b) => a.day - b.day);

      setThisMonthCelebrations(thisMonth);
      setNextMonthCelebrations(nextMonthList);
    } catch (error) {
      console.error('Error loading celebrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCelebrationEmoji = (type: string) => {
    switch (type) {
      case 'birthday':
        return '🎂';
      case 'wedding':
        return '💍';
      case 'membership':
        return '🏅';
      default:
        return '🎉';
    }
  };

  const getCelebrationLabel = (celebration: Celebration) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthName = monthNames[celebration.month - 1];
    const dateStr = `${monthName} ${celebration.day}`;

    switch (celebration.type) {
      case 'birthday':
        return `Birthday - ${dateStr}`;
      case 'wedding':
        return `Wedding Anniversary - ${dateStr}${celebration.years ? ` (${celebration.years} years)` : ''}`;
      case 'membership':
        return `Membership Anniversary - ${dateStr}${celebration.years ? ` (${celebration.years} years)` : ''}`;
      default:
        return dateStr;
    }
  };

  const getMonthName = (monthNum: number) => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[monthNum - 1];
  };

  const renderCelebrationList = (celebrations: Celebration[]) => {
    if (celebrations.length === 0) {
      return (
        <div className="text-center py-6 text-gray-600">
          No celebrations this month
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {celebrations.map((celebration) => (
          <div
            key={celebration.id}
            className="bg-white rounded-lg p-4 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 border-2 border-blue-200">
              {celebration.profile_photo_url ? (
                <img
                  src={celebration.profile_photo_url}
                  alt={`${celebration.first_name} ${celebration.last_name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-400" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="font-semibold text-gray-800">
                {celebration.first_name} {celebration.last_name}
              </div>
              <div className="text-sm text-gray-600 flex items-center gap-1">
                <span>{getCelebrationEmoji(celebration.type)}</span>
                <span>{getCelebrationLabel(celebration)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

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
          <h1 className="text-xl font-bold text-white flex-1">Birthdays & Anniversaries</h1>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
                <p className="mt-4 text-gray-600">Loading celebrations...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-800 mb-3">
                  {getMonthName(new Date().getMonth() + 1)}
                </h2>
                {renderCelebrationList(thisMonthCelebrations)}
              </div>

              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-3">
                  {getMonthName(new Date().getMonth() + 1 === 12 ? 1 : new Date().getMonth() + 2)}
                </h2>
                {renderCelebrationList(nextMonthCelebrations)}
              </div>
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </Layout>
  );
}
