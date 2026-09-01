// Checklist item sets referenced by field_visits.checklist and
// story_seeds.filter_checklist (both stored as free-form jsonb, so these
// lists are conventions the UI enforces, not schema constraints — an
// operator can add their own items without a migration).

export const FIELD_VISIT_CHECKLIST = [
  { key: 'purpose_explained', label: 'Explained the project and how the story will be used' },
  { key: 'consent_obtained', label: 'Recording consent obtained from the resource person' },
  { key: 'compensation_discussed', label: 'Compensation or acknowledgement discussed' },
  { key: 'sacred_content_flagged', label: 'Checked for sacred or restricted knowledge before recording' },
  { key: 'follow_up_shared', label: 'Left contact details for follow-up questions' },
] as const;

export const STORY_SEED_REQUIRED_CHECKLIST = [
  { key: 'emotional_hook', label: 'Has an emotional hook' },
  { key: 'culturally_simplifiable', label: 'Can be simplified without losing cultural truth' },
  { key: 'community_dignity', label: 'Treats the community and its people with dignity' },
  { key: 'visual_world', label: 'Has a strong visual world for illustration' },
  { key: 'sw_level_fit', label: 'Fits an early-reader level' },
] as const;

export const STORY_SEED_DISQUALIFYING_CHECKLIST = [
  { key: 'sacred_knowledge', label: 'Contains sacred or restricted knowledge' },
  { key: 'no_consent', label: 'No clear consent to publish' },
  { key: 'insufficient_material', label: 'Not enough material to work with' },
] as const;

export const AUTHENTICITY_CHECKLIST = [
  { key: 'attire_accurate', label: 'Attire and dress match the community described' },
  { key: 'setting_accurate', label: 'Architecture, landscape, and objects match the region' },
  { key: 'no_stereotyping', label: 'Free of generic or stereotyped "tribal" imagery' },
  { key: 'community_reviewed', label: 'Reviewed by someone from or close to the community' },
] as const;
