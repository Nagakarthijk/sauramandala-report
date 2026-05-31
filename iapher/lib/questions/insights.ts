export interface InsightField {
  id: string
  label: string
  placeholder: string
}

export const INSIGHT_FIELDS: InsightField[] = [
  {
    id: 'key_themes',
    label: 'Key themes that emerged',
    placeholder: 'What dominated the conversation?',
  },
  {
    id: 'surprises',
    label: 'What surprised you',
    placeholder: 'Unexpected responses or directions',
  },
  {
    id: 'silences',
    label: 'Silences and avoidances',
    placeholder: 'What topics created silence or discomfort?',
  },
  {
    id: 'disagreements',
    label: 'Disagreements within the group',
    placeholder: 'Points of tension or divergent views',
  },
  {
    id: 'local_concepts',
    label: 'Local concepts and language',
    placeholder: 'Words or ideas specific to this community',
  },
  {
    id: 'direct_quotes',
    label: 'Direct quotes worth preserving',
    placeholder: 'Verbatim quotes that capture something important',
  },
  {
    id: 'action_signals',
    label: 'Signals for action',
    placeholder: 'Concrete things the CMYC could do',
  },
  {
    id: 'followup_needed',
    label: 'Follow-up needed',
    placeholder: 'Questions to explore further',
  },
]
