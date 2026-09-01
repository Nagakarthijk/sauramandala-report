import { requireProject } from '@/lib/workspace';
import { accessFor } from '@/lib/permissions';
import { CorpusExporter } from '@/components/corpus-exporter/CorpusExporter';
import { EmptyState } from '@/components/ui/EmptyState';
import type { RecordingRef } from '@/lib/corpus';
import type {
  TranscriptSegment,
  Translation,
  Recording,
  FieldVisit,
  StorySeed,
  Book,
  Manuscript,
  EditorialRound,
  IllustrationJob,
  IllustrationPage,
  Readalong,
  Comment,
} from '@/lib/types';

export default async function CorpusPage() {
  const { supabase, project, role } = await requireProject();

  if (accessFor(role, 'corpus_export') === 'none') {
    return (
      <EmptyState
        title="Lead access only"
        description="Corpus export is restricted to the project lead. Ask your lead if you need a copy of the data."
      />
    );
  }

  const [
    { data: segments },
    { data: recordings },
    { data: translations },
    { data: fieldVisits },
    { data: storySeeds },
    { data: books },
    { data: manuscripts },
    { data: editorialRounds },
    { data: illustrationJobs },
    { data: illustrationPages },
    { data: readalongs },
    { data: comments },
  ] = await Promise.all([
    supabase.from('transcript_segments').select('*').eq('project_id', project.id).returns<TranscriptSegment[]>(),
    supabase.from('recordings').select('*').eq('project_id', project.id).returns<Recording[]>(),
    supabase.from('translations').select('*').eq('project_id', project.id).returns<Translation[]>(),
    supabase.from('field_visits').select('*').eq('project_id', project.id).returns<FieldVisit[]>(),
    supabase.from('story_seeds').select('*').eq('project_id', project.id).returns<StorySeed[]>(),
    supabase.from('books').select('*').eq('project_id', project.id).returns<Book[]>(),
    supabase.from('manuscripts').select('*').eq('project_id', project.id).returns<Manuscript[]>(),
    supabase.from('editorial_rounds').select('*').eq('project_id', project.id).returns<EditorialRound[]>(),
    supabase.from('illustration_jobs').select('*').eq('project_id', project.id).returns<IllustrationJob[]>(),
    supabase.from('illustration_pages').select('*').eq('project_id', project.id).returns<IllustrationPage[]>(),
    supabase.from('readalongs').select('*').eq('project_id', project.id).returns<Readalong[]>(),
    supabase.from('comments').select('*').eq('project_id', project.id).returns<Comment[]>(),
  ]);

  const recordingsById = new Map<string, RecordingRef>(
    (recordings ?? []).map((r) => [
      r.id,
      { id: r.id, file_reference: r.file_reference, language_code: r.language_code, dialect_tag: r.dialect_tag },
    ])
  );

  const projectSlug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl">Corpus export</h1>
        <p className="text-sm text-ink/60">
          Generated from data your team already created during normal production work. No extra
          annotation steps required.
        </p>
      </div>

      <CorpusExporter
        projectName={project.name}
        projectSlug={projectSlug || 'project'}
        segments={segments ?? []}
        recordingsById={recordingsById}
        translations={translations ?? []}
        hfEnabled={!!project.settings.hf_enabled}
        fullExport={{
          project,
          field_visits: fieldVisits ?? [],
          recordings: recordings ?? [],
          transcript_segments: segments ?? [],
          story_seeds: storySeeds ?? [],
          books: books ?? [],
          manuscripts: manuscripts ?? [],
          editorial_rounds: editorialRounds ?? [],
          illustration_jobs: illustrationJobs ?? [],
          illustration_pages: illustrationPages ?? [],
          translations: translations ?? [],
          readalongs: readalongs ?? [],
          comments: comments ?? [],
        }}
      />
    </div>
  );
}
