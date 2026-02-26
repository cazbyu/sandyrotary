import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function ReferSomeone() {
  const navigate = useNavigate();
  const { member } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    notes: '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      alert('Please enter first and last name');
      return;
    }

    setSubmitting(true);

    try {
      const { data: lead, error: leadError } = await supabase
        .schema('p0012_rotary')
        .from('leads')
        .insert({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          notes: formData.notes.trim() || null,
          stage: 'Prospect',
          source: 'Referral',
          referred_by: member!.id,
          prospect_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (leadError) throw leadError;

      const { data: memberData } = await supabase
        .schema('p0012_rotary')
        .from('members')
        .select('first_name, last_name')
        .eq('id', member!.id)
        .single();

      const referrerName = memberData
        ? `${memberData.first_name} ${memberData.last_name}`
        : 'Member';

      let activityDescription = `Referred by ${referrerName}`;
      if (formData.notes.trim()) {
        activityDescription += `. ${formData.notes.trim()}`;
      }

      await supabase
        .schema('p0012_rotary')
        .from('lead_activities')
        .insert({
          lead_id: lead.id,
          activity_type: 'Note',
          description: activityDescription,
          performed_by: member!.id,
        });

      alert(`Thanks! ${formData.first_name} ${formData.last_name} has been added as a prospect. The membership team will follow up.`);
      navigate('/');
    } catch (error) {
      console.error('Error creating referral:', error);
      alert('Failed to submit referral. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen bg-[#F5F7FA]">
        <div className="bg-[#1B2A4A] px-4 py-4 flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white ml-4">Refer Someone</h1>
        </div>

        <div className="p-4">
          <div className="bg-white rounded-2xl p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-[#D94F4F] rounded-full flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#1B2A4A]">Know someone who'd make a great Rotarian?</h2>
                <p className="text-sm text-gray-600">Help us grow our club by referring potential members</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white rounded-2xl p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  First Name <span className="text-[#D94F4F]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => handleChange('first_name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Last Name <span className="text-[#D94F4F]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                  placeholder="Enter last name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
                  placeholder="(123) 456-7890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">How do you know them?</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent resize-none"
                  placeholder="Tell us about your connection and why they'd be a good fit..."
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-[#D94F4F] text-white font-bold rounded-lg hover:bg-[#C44444] disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Referral'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
