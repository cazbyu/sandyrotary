import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Copy, Download, Tag, Check, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  stage: string;
  source: string;
  tags: string[];
  email_opt_in: boolean;
  last_contacted_date: string | null;
  referrer_name?: string;
}

interface ContactListViewProps {
  leads: Lead[];
  isAdmin: boolean;
  onRefresh: () => void;
}

const DEFAULT_TAGS = ['newsletter', 'event-invite', 'fundraiser', 'meeting-invite', 'holiday-party'];

const STAGE_COLORS: Record<string, string> = {
  Prospect: 'bg-gray-100 text-gray-700',
  Contacted: 'bg-blue-100 text-blue-700',
  Interested: 'bg-yellow-100 text-yellow-800',
  Proposed: 'bg-orange-100 text-orange-700',
  Approved: 'bg-green-100 text-green-700',
  'New Member': 'bg-[#1B2A4A] text-white',
  Declined: 'bg-red-100 text-red-700',
  Inactive: 'bg-gray-100 text-gray-500',
};

export function ContactListView({ leads, isAdmin, onRefresh }: ContactListViewProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [optInFilter, setOptInFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkTag, setShowBulkTag] = useState(false);
  const [bulkTag, setBulkTag] = useState('');

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      !search ||
      `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (lead.email && lead.email.toLowerCase().includes(search.toLowerCase())) ||
      (lead.company && lead.company.toLowerCase().includes(search.toLowerCase()));

    const matchesStage = stageFilter.length === 0 || stageFilter.includes(lead.stage);
    const matchesTags = tagFilter.length === 0 || tagFilter.some((t) => lead.tags?.includes(t));
    const matchesOptIn =
      optInFilter === 'all' ||
      (optInFilter === 'yes' && lead.email_opt_in) ||
      (optInFilter === 'no' && !lead.email_opt_in);

    return matchesSearch && matchesStage && matchesTags && matchesOptIn;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const copyEmails = () => {
    const emails = filteredLeads
      .filter((l) => selectedIds.has(l.id) && l.email && l.email_opt_in)
      .map((l) => l.email)
      .filter(Boolean);

    if (emails.length === 0) {
      alert('No valid email addresses selected');
      return;
    }

    navigator.clipboard.writeText(emails.join(', ')).then(() => {
      alert(`${emails.length} email address${emails.length !== 1 ? 'es' : ''} copied to clipboard`);
    });
  };

  const emailAll = () => {
    const emails = filteredLeads
      .filter((l) => selectedIds.has(l.id) && l.email && l.email_opt_in)
      .map((l) => l.email)
      .filter(Boolean);

    if (emails.length === 0) {
      alert('No valid email addresses selected');
      return;
    }

    if (emails.length > 50) {
      alert(`Warning: ${emails.length} emails selected. Most email clients support a maximum of ~50 recipients. Consider using "Copy Emails" and pasting into an email marketing tool.`);
      return;
    }

    window.location.href = `mailto:?bcc=${emails.join(',')}`;
  };

  const exportCSV = () => {
    const selectedLeads = filteredLeads.filter((l) => selectedIds.has(l.id));

    if (selectedLeads.length === 0) {
      alert('No contacts selected');
      return;
    }

    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Stage', 'Tags', 'Email Opt-In'];
    const rows = selectedLeads.map((l) => [
      l.first_name,
      l.last_name,
      l.email || '',
      l.phone || '',
      l.company || '',
      l.stage,
      (l.tags || []).join('; '),
      l.email_opt_in ? 'Yes' : 'No',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const allStages = ['Prospect', 'Contacted', 'Interested', 'Proposed', 'Approved', 'New Member', 'Declined', 'Inactive'];
  const allTags = [...new Set([...DEFAULT_TAGS, ...leads.flatMap((l) => l.tags || [])])];

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D94F4F] focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${
              showFilters ? 'bg-[#D94F4F] text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="space-y-3 border-t border-gray-200 pt-3">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Stages</p>
              <div className="flex flex-wrap gap-1">
                {allStages.map((stage) => (
                  <button
                    key={stage}
                    onClick={() =>
                      setStageFilter((prev) =>
                        prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
                      )
                    }
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      stageFilter.includes(stage) ? 'bg-[#1B2A4A] text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() =>
                      setTagFilter((prev) =>
                        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                      )
                    }
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      tagFilter.includes(tag) ? 'bg-[#D94F4F] text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Email Opt-In</p>
              <div className="flex gap-1">
                {(['all', 'yes', 'no'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setOptInFilter(opt)}
                    className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                      optInFilter === opt ? 'bg-[#1B2A4A] text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {isAdmin && selectedIds.size > 0 && (
        <div className="bg-white rounded-lg p-3 flex items-center gap-2 overflow-x-auto">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
            {selectedIds.size} selected:
          </span>
          <button
            onClick={copyEmails}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 whitespace-nowrap"
          >
            <Copy className="w-3 h-3" />
            Copy Emails
          </button>
          <button
            onClick={emailAll}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 whitespace-nowrap"
          >
            <Mail className="w-3 h-3" />
            Email All
          </button>
          <button
            onClick={() => setShowBulkTag(!showBulkTag)}
            className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 whitespace-nowrap"
          >
            <Tag className="w-3 h-3" />
            Add Tag
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#1B2A4A] text-white rounded-lg text-xs font-medium hover:bg-[#1B2A4A]/90 whitespace-nowrap"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
        </div>
      )}

      {showBulkTag && (
        <div className="bg-yellow-50 rounded-lg p-3 flex items-center gap-2">
          <select
            value={bulkTag}
            onChange={(e) => setBulkTag(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Select a tag...</option>
            {DEFAULT_TAGS.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          <button
            onClick={async () => {
              if (!bulkTag) return;
              for (const id of selectedIds) {
                const lead = leads.find((l) => l.id === id);
                if (lead && !(lead.tags || []).includes(bulkTag)) {
                  await supabase
                    .schema('p0012_rotary')
                    .from('leads')
                    .update({ tags: [...(lead.tags || []), bulkTag] })
                    .eq('id', id);
                }
              }
              setBulkTag('');
              setShowBulkTag(false);
              onRefresh();
            }}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium"
          >
            Apply
          </button>
          <button
            onClick={() => setShowBulkTag(false)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {isAdmin && (
                  <th className="px-3 py-3 text-left">
                    <button onClick={toggleSelectAll}>
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedIds.size === filteredLeads.length && filteredLeads.length > 0
                            ? 'bg-[#D94F4F] border-[#D94F4F]'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedIds.size === filteredLeads.length && filteredLeads.length > 0 && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </button>
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Stage</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Tags</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Opt-In</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  {isAdmin && (
                    <td className="px-3 py-3">
                      <button onClick={() => toggleSelect(lead.id)}>
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedIds.has(lead.id) ? 'bg-[#D94F4F] border-[#D94F4F]' : 'border-gray-300'
                          }`}
                        >
                          {selectedIds.has(lead.id) && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </button>
                    </td>
                  )}
                  <td
                    className="px-4 py-3 text-sm text-gray-800 cursor-pointer hover:text-[#D94F4F]"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    {lead.first_name} {lead.last_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} className="hover:text-blue-600">
                        {lead.email}
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {lead.phone ? (
                      <a href={`tel:${lead.phone}`} className="hover:text-blue-600">
                        {lead.phone}
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        STAGE_COLORS[lead.stage] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {lead.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(lead.tags || []).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {lead.email_opt_in ? (
                      <span className="text-green-600 text-sm">Yes</span>
                    ) : (
                      <span className="text-red-500 text-sm">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredLeads.length === 0 && (
          <div className="py-12 text-center text-gray-500 text-sm">No contacts match your filters</div>
        )}
      </div>
    </div>
  );
}
