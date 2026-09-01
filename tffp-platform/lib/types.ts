// Hand-written types mirroring supabase/migrations/0001_init.sql.
// If you'd rather generate these from a live project, run:
//   supabase gen types typescript --project-id <ref> > lib/database.types.ts
// and swap the Row aliases below to pull from that file instead.

export type Role =
  | 'lead'
  | 'editor'
  | 'writer'
  | 'illustrator'
  | 'ra'
  | 'fellow'
  | 'translator';

export type FieldVisitOutcome =
  | 'strong_seed'
  | 'partial'
  | 'no_seed'
  | 'multiple_seeds'
  | 'referral';

export type FilterOutcome = 'proceed' | 'more_research' | 'archive' | 'potential';

export type BookStatus =
  | 'concept'
  | 'manuscript_draft'
  | 'manuscript_locked'
  | 'illustration'
  | 'translation'
  | 'readalong'
  | 'published';

export type EditorialVerdict = 'proceed' | 'rethink' | 'chuck' | 'approved';

export type AnnotationStatus = 'unannotated' | 'in_progress' | 'complete';

export type TranslationStatus = 'assigned' | 'in_progress' | 'review' | 'approved';

export type SyncStatus = 'pending' | 'in_progress' | 'synced' | 'error';

export interface ProjectSettings {
  ai_enabled?: boolean;
  ai_provider?: 'anthropic' | 'openai' | 'ollama' | null;
  sw_enabled?: boolean;
  hf_enabled?: boolean;
  hf_dataset_id?: string | null;
}

export interface Project {
  id: string;
  created_at: string;
  name: string;
  organisation: string;
  region: string | null;
  languages: string[];
  settings: ProjectSettings;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export interface FieldVisit {
  id: string;
  project_id: string;
  created_at: string;
  created_by: string | null;
  visit_date: string | null;
  location: string | null;
  region: string | null;
  resource_persons: string | null;
  subject_theme: string | null;
  how_identified: string | null;
  outcome: FieldVisitOutcome | null;
  visit_notes: string | null;
  checklist: Record<string, boolean>;
}

export interface Recording {
  id: string;
  project_id: string;
  field_visit_id: string | null;
  created_at: string;
  file_reference: string | null;
  file_name: string | null;
  duration_seconds: number | null;
  language_code: string | null;
  dialect_tag: string | null;
  speaker_name: string | null;
  speaker_consent: boolean;
  notes: string | null;
}

export interface CulturalTerm {
  term: string;
  language: string;
  meaning: string;
  preserve_untranslated: boolean;
}

export const SEGMENT_TAGS = [
  'PAUSE',
  'LOCAL_TERM',
  'LAUGHTER',
  'INAUDIBLE',
  'LANG_SWITCH',
] as const;

export interface TranscriptSegment {
  id: string;
  recording_id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  segment_order: number;
  text_source: string | null;
  text_english: string | null;
  start_time_ms: number | null;
  end_time_ms: number | null;
  tags: string[];
  cultural_terms: CulturalTerm[];
  condensation_notes: string | null;
  reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export type FilterChecklist = Record<string, boolean>;

export interface StorySeed {
  id: string;
  project_id: string;
  recording_id: string | null;
  created_at: string;
  created_by: string | null;
  working_title: string | null;
  condensed_text: string | null;
  filter_outcome: FilterOutcome | null;
  filter_notes: string | null;
  filter_checklist: FilterChecklist;
}

export interface ConceptNote {
  synopsis?: string;
  problem_statement?: string;
  visual_moments?: string;
  style_preference?: string;
  community_region?: string;
  source_description?: string;
}

export interface Book {
  id: string;
  project_id: string;
  story_seed_id: string | null;
  created_at: string;
  working_title: string;
  reading_level: number | null;
  author_id: string | null;
  status: BookStatus;
  published_url: string | null;
  concept_note: ConceptNote;
}

export interface ManuscriptPage {
  page_num: number;
  label: string;
  layout: string;
  text: string;
  illustration_prompt: string;
  editor_notes: string;
}

export interface Manuscript {
  id: string;
  book_id: string;
  project_id: string;
  created_at: string;
  created_by: string | null;
  version_number: number;
  page_data: ManuscriptPage[];
  layout_format: string | null;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
}

export interface EditorialRound {
  id: string;
  manuscript_id: string;
  project_id: string;
  created_at: string;
  reviewer_id: string | null;
  draft_number: number | null;
  verdict: EditorialVerdict | null;
  feedback_structural: string | null;
  feedback_cultural: string | null;
  feedback_lines: string | null;
  what_works: string | null;
}

export const ILLUSTRATION_MILESTONE_NAMES = [
  'character_sheet',
  'thumbnails',
  'colour_trials',
  'style_approval',
  'final_artwork',
] as const;

export interface IllustrationMilestone {
  name: (typeof ILLUSTRATION_MILESTONE_NAMES)[number];
  due_date: string | null;
  status: 'not_started' | 'in_progress' | 'submitted' | 'approved';
  submitted_at: string | null;
  approved_at: string | null;
}

export interface IllustrationJob {
  id: string;
  book_id: string;
  project_id: string;
  created_at: string;
  illustrator_id: string | null;
  character_sheet: string | null;
  setting_notes: string | null;
  style_direction: string | null;
  reference_files: string | null;
  milestones: IllustrationMilestone[];
  authenticity_checklist: Record<string, boolean>;
}

export interface PageAnnotation {
  label_english: string;
  label_source_language: string;
  bounding_box: { x: number; y: number; w: number; h: number };
  category: string;
}

export interface IllustrationPage {
  id: string;
  illustration_job_id: string;
  project_id: string;
  page_number: number | null;
  file_reference: string | null;
  thumbnail_path: string | null;
  annotations: PageAnnotation[];
  annotation_status: AnnotationStatus;
  notes: string | null;
}

export interface TermToPreserve {
  term: string;
  reason: string;
}

export interface Translation {
  id: string;
  book_id: string;
  project_id: string;
  created_at: string;
  target_language: string;
  target_language_code: string | null;
  translator_id: string | null;
  terms_to_preserve: TermToPreserve[];
  page_data: ManuscriptPage[];
  status: TranslationStatus;
}

export interface SlsCue {
  page: number;
  word: string;
  cue: number;
  content: string;
  start_time_ms: number;
}

export interface Readalong {
  id: string;
  book_id: string;
  project_id: string;
  language: string;
  narrator: string | null;
  audio_file_reference: string | null;
  attribution_file_reference: string | null;
  sls_csv_data: SlsCue[] | null;
  sync_status: SyncStatus;
}

export interface Comment {
  id: string;
  project_id: string;
  created_at: string;
  author_id: string | null;
  target_table: string;
  target_id: string;
  parent_id: string | null;
  body: string;
  resolved: boolean;
}

export interface ActivityLogEntry {
  id: string;
  created_at: string;
  project_id: string;
  user_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
}
