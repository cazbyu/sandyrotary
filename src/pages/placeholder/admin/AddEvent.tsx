import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '../../../components/Layout';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

export function AddEvent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    eventName: '',
    status: 'Active',
    category: '',
    description: '',
    enableRsvp: false,
    startDate: '',
    endDate: '',
    addressLine1: '',
    addressCity: '',
    addressState: '',
    addressZip: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.eventName || !formData.category || !formData.startDate || !formData.endDate) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.schema('p0012_rotary').from('calendar_events').insert({
        event_name: formData.eventName,
        status: formData.status,
        category: formData.category,
        description: formData.description,
        enable_rsvp: formData.enableRsvp,
        start_date: formData.startDate,
        end_date: formData.endDate,
        address_line1: formData.addressLine1,
        address_city: formData.addressCity,
        address_state: formData.addressState,
        address_zip: formData.addressZip,
        created_by: user?.id,
      });

      if (error) throw error;

      alert('Event created successfully!');
      navigate('/calendar');
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Failed to create event. Please try again.');
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-xl font-bold text-white flex-1">Add Calendar Event</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Event Information</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Event Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.eventName}
                onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
                placeholder="Enter event name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <p className="text-xs text-gray-600 mt-1">
                Only Active events will be listed on the calendar
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Event Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
                required
              >
                <option value="">Select category</option>
                <option value="Club Event">Club Event</option>
                <option value="Club FundRaiser">Club FundRaiser</option>
                <option value="Club Meeting">Club Meeting</option>
                <option value="Club Service Project">Club Service Project</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Event description"
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A] resize-none"
              />
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enableRsvp}
                  onChange={(e) => setFormData({ ...formData, enableRsvp: e.target.checked })}
                  className="w-5 h-5 text-[#1B2A4A] border-gray-300 rounded focus:ring-[#1B2A4A]"
                />
                <span className="text-sm font-semibold text-gray-800">Enable RSVP</span>
              </label>
              <p className="text-xs text-gray-600 mt-1 ml-8">
                Members can RSVP or opt-out of this event
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Event Scheduling</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Start Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => {
                  const start = e.target.value;
                  let newEnd = formData.endDate;
                  if (start) {
                    const startDt = new Date(start);
                    startDt.setHours(startDt.getHours() + 1);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    newEnd = `${startDt.getFullYear()}-${pad(startDt.getMonth() + 1)}-${pad(startDt.getDate())}T${pad(startDt.getHours())}:${pad(startDt.getMinutes())}`;
                  }
                  setFormData({ ...formData, startDate: start, endDate: newEnd });
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                End Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
                required
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Event Address (Optional)</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Address Line 1
              </label>
              <input
                type="text"
                value={formData.addressLine1}
                onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                placeholder="Street address"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">City</label>
                <input
                  type="text"
                  value={formData.addressCity}
                  onChange={(e) => setFormData({ ...formData, addressCity: e.target.value })}
                  placeholder="City"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">State</label>
                <input
                  type="text"
                  value={formData.addressState}
                  onChange={(e) => setFormData({ ...formData, addressState: e.target.value })}
                  placeholder="State"
                  maxLength={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Zip Code</label>
              <input
                type="text"
                value={formData.addressZip}
                onChange={(e) => setFormData({ ...formData, addressZip: e.target.value })}
                placeholder="Zip Code"
                maxLength={10}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-6 bg-[#1B2A4A] text-white font-bold text-lg rounded-lg hover:bg-[#1B2A4A]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'ADDING EVENT...' : 'ADD EVENT'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
