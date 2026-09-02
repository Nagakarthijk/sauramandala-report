import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import {
  updateCondensedText,
  updateFilterChecklist,
  updateFilterOutcome,
  updateReferenceResources,
  promoteToBook,
} from '@/app/workspace/story-seeds/actions';
import { STORY_SEED_REQUIRED_CHECKLIST, STORY_SEED_DISQUALIFYING_CHECKLIST } from '@/lib/checklists';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { AutoSaveTextarea } from '@/components/workspace/AutoSaveTextarea';
import { ChecklistEditor } from '@/components/workspace/ChecklistEditor';
import { ReferenceResourceEditor } from '@/components/workspace/ReferenceResourceEditor';
import { MediaGallery } from '@/components/workspace/MediaGallery';
import { Select, Field, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Comments } from '@/components/comments/Comments';
import { ParallelCorpusPreview } from '@/components/workspace/ParallelCorpusPreview';
import type { StorySeed, Recording, TranscriptSegment, FieldVisitMedia } from '@/lib/types';

export default async function StorySeedDetailPage({ params }: { params: { seedId: string } }) {
  const { supabase, project, role } = await requireProject();

  const { data: seed } = await supabase
    .from('story_seeds')
    .select('*')
    .eq('id', params.seedId)
    .eq('project_id', project.id)
    .single<StorySeed>();

  if (!seed) notFound();

  const writable = canWrite(role, 'story_seeds');
  const wordCount = (seed.condensed_text ?? '').trim().split(/\s+/).filter(Boolean).length;

  const [{ data: existingBook }, { data: recording }, { data: segmentsData }] = await Promise.all([
    supabase.from('books').select('id').eq('story_seed_id', seed.id).maybeSingle(),
    seed.recording_id
      ? supabase.from('recordings').select('*').eq('id', seed.recording_id).maybeSingle<Recording>()
      : Promise.resolve({ data: null }),
    seed.recording_id
      ? supabase
          .from('transcript_segments')
          .select('*')
          .eq('recording_id', seed.recording_id)
          .order('segment_order', { ascending: true })
          .returns<TranscriptSegment[]>()
      : Promise.resolve({ data: null }),
  ]);

  const { data: fieldMedia } = recording?.field_visit_id
    ? await supabase
        .from('field_visit_media')
        .select('*')
        .eq('field_visit_id', recording.field_visit_id)
        .order('created_at', { ascending: false })
        .returns<FieldVisitMedia[]>()
    : { data: null };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/workspace/story-seeds" className="text-sm text-ink/50 hover:underline">
        ← Story seeds
      </Link>
      <h1 className="font-heading text-2xl">{seed.working_title || 'Untitled seed'}</h1>

      <Card>
        <CardHeader
          title="Source"
          subtitle={
            recording
              ? `${recording.speaker_name || 'Unnamed speaker'} · ${recording.language_code || 'language unset'}`
              : 'No recording linked to this seed'
          }
          action={
            recording ? (
              <Link href={`/workspace/transcripts/${recording.id}`} className="text-sm text-forest hover:underline">
                Open full transcript editor →
              </Link>
            ) : undefined
          }
        />
        {recording && (
          <CardBody className="space-y-4">
            <ParallelCorpusPreview segments={segmentsData ?? []} />
            {fieldMedia && fieldMedia.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-ink/80">Field assets from this visit</h3>
                <MediaGallery media={fieldMedia} writable={false} />
              </div>
            )}
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader title="Research resources" subtitle="Reference material gathered while working this seed — visuals, facts, articles." />
        <CardBody>
          <ReferenceResourceEditor
            initialResources={seed.reference_resources ?? []}
            writable={writable}
            action={updateReferenceResources.bind(null, seed.id)}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Condensation" subtitle={`${wordCount} words · target 400–700`} />
        <CardBody>
          <AutoSaveTextarea
            initialValue={seed.condensed_text ?? ''}
            rows={10}
            disabled={!writable}
            action={updateCondensedText.bind(null, seed.id)}
            placeholder="Condense the English translation into the shape of a story…"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Filtering checklist" />
        <CardBody className="space-y-4">
          <ChecklistEditor
            title="Should proceed if…"
            items={STORY_SEED_REQUIRED_CHECKLIST}
            initialValues={seed.filter_checklist ?? {}}
            disabled={!writable}
            action={updateFilterChecklist.bind(null, seed.id)}
          />
          <ChecklistEditor
            title="Disqualified if…"
            items={STORY_SEED_DISQUALIFYING_CHECKLIST}
            initialValues={seed.filter_checklist ?? {}}
            disabled={!writable}
            action={updateFilterChecklist.bind(null, seed.id)}
          />
          <form action={updateFilterOutcome.bind(null, seed.id)} className="space-y-3 border-t border-ink/10 pt-4">
            <Field label="Outcome" htmlFor="filter_outcome">
              <Select id="filter_outcome" name="filter_outcome" defaultValue={seed.filter_outcome ?? ''} disabled={!writable}>
                <option value="">— undecided —</option>
                <option value="proceed">Proceed</option>
                <option value="potential">Potential — revisit later</option>
                <option value="more_research">Needs more research</option>
                <option value="archive">Archive</option>
              </Select>
            </Field>
            <Field label="Notes" htmlFor="filter_notes">
              <Textarea id="filter_notes" name="filter_notes" rows={2} defaultValue={seed.filter_notes ?? ''} disabled={!writable} />
            </Field>
            {writable && <Button type="submit" size="sm">Save outcome</Button>}
          </form>
        </CardBody>
      </Card>

      {writable && seed.filter_outcome === 'proceed' && (
        <Card>
          <CardBody className="flex items-center justify-between">
            <p className="text-sm text-ink/70">
              {existingBook ? 'This seed already has a book.' : 'Ready to move forward — start the book.'}
            </p>
            {existingBook ? (
              <Link href={`/workspace/books/${existingBook.id}/concept`}>
                <Button variant="secondary">Open book →</Button>
              </Link>
            ) : (
              <form action={promoteToBook.bind(null, seed.id)}>
                <Button type="submit">Start a book from this seed</Button>
              </form>
            )}
          </CardBody>
        </Card>
      )}

      <Comments targetTable="story_seeds" targetId={seed.id} projectId={project.id} />
    </div>
  );
}
