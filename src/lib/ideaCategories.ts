/** Idea categories for notes.deposit_idea_category (no DB constraint; this list is the source of truth). */
export const IDEA_CATEGORIES = [
  { value: 'impact_story', label: 'Impact Story' },
  { value: 'service_project', label: 'Service Project' },
  { value: 'fundraising', label: 'Fundraising' },
  { value: 'meeting', label: 'Meeting Structure' },
  { value: 'speaker', label: 'Guest Speaker Suggestion' },
  { value: 'speaker_feedback', label: 'Speaker / Event Feedback' },
  { value: 'committee', label: 'Committee Interest' },
  { value: 'other', label: 'Other' },
];

export const IMPACT_STORY_PLACEHOLDER =
  "Share what happened, who it helped, and why it mattered. Leaders may share approved stories on the club's social media.";

export function getCategoryLabel(value: string | null) {
  if (!value) return 'General';
  return IDEA_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function getCategoryColor(value: string | null) {
  switch (value) {
    case 'impact_story':
      return 'bg-purple-100 text-purple-700';
    case 'service_project':
      return 'bg-teal-100 text-teal-700';
    case 'fundraising':
      return 'bg-green-100 text-green-700';
    case 'meeting':
      return 'bg-blue-100 text-blue-700';
    case 'speaker':
      return 'bg-amber-100 text-amber-700';
    case 'speaker_feedback':
      return 'bg-orange-100 text-orange-700';
    case 'committee':
      return 'bg-sky-100 text-sky-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}
