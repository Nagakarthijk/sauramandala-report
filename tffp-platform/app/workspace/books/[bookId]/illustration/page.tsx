import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import {
  createIllustrationJob,
  updateJobMeta,
  addIllustrationPage,
  updateAuthenticityChecklist,
} from '@/app/workspace/books/[bookId]/illustration/actions';
import { AUTHENTICITY_CHECKLIST } from '@/lib/checklists';
import { BookTabs } from '@/components/workspace/BookTabs';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChecklistEditor } from '@/components/workspace/ChecklistEditor';
import { MilestoneTracker } from '@/components/illustration-annotator/MilestoneTracker';
import { ImageAnnotator } from '@/components/illustration-annotator/ImageAnnotator';
import { ParallelCorpusPreview } from '@/components/workspace/ParallelCorpusPreview';
import { MediaGallery } from '@/components/workspace/MediaGallery';
import { ReferenceResourceEditor } from '@/components/workspace/ReferenceResourceEditor';
import { AssetLinker } from '@/components/workspace/AssetLinker';
import type {
  Book,
  IllustrationJob,
  IllustrationPage,
  StorySeed,
  Recording,
  TranscriptSegment,
  FieldVisitMedia,
  IllustrationAsset,
} from '@/lib/types';

export default async function IllustrationPage({ params }: { params: { bookId: string } }) {
  const { supabase, project, role } = await requireProject();

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.bookId)
    .eq('project_id', project.id)
    .single<Book>();
  if (!book) notFound();

  const writable = canWrite(role, 'illustrations');

  const { data: job } = await supabase
    .from('illustration_jobs')
    .select('*')
    .eq('book_id', book.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<IllustrationJob>();

  const { data: pagesData } = job
    ? await supabase
        .from('illustration_pages')
        .select('*')
        .eq('illustration_job_id', job.id)
        .order('page_number', { ascending: true })
        .returns<IllustrationPage[]>()
    : { data: [] as IllustrationPage[] };
  const pages = pagesData ?? [];

  // Trace book -> story_seed -> recording -> field_visit, so the
  // illustrator has the same source material the author worked from —
  // the parallel corpus, field photos/video, and research resources —
  // without having to go dig for it.
  const { data: seed } = book.story_seed_id
    ? await supabase.from('story_seeds').select('*').eq('id', book.story_seed_id).maybeSingle<StorySeed>()
    : { data: null };

  const { data: recording } = seed?.recording_id
    ? await supabase.from('recordings').select('*').eq('id', seed.recording_id).maybeSingle<Recording>()
    : { data: null };

  const [{ data: segments }, { data: fieldMedia }] = await Promise.all([
    recording
      ? supabase
          .from('transcript_segments')
          .select('*')
          .eq('recording_id', recording.id)
          .order('segment_order', { ascending: true })
          .returns<TranscriptSegment[]>()
      : Promise.resolve({ data: null }),
    recording?.field_visit_id
      ? supabase
          .from('field_visit_media')
          .select('*')
          .eq('field_visit_id', recording.field_visit_id)
          .order('created_at', { ascending: false })
          .returns<FieldVisitMedia[]>()
      : Promise.resolve({ data: null }),
  ]);

  const [{ data: allAssets }, { data: bookAssetLinks }] = await Promise.all([
    supabase.from('illustration_assets').select('*').eq('project_id', project.id).order('name').returns<IllustrationAsset[]>(),
    supabase.from('book_assets').select('id, asset_id').eq('book_id', book.id),
  ]);

  const assetsById = new Map((allAssets ?? []).map((a) => [a.id, a]));
  const linkedAssets = (bookAssetLinks ?? [])
    .map((link) => {
      const asset = assetsById.get(link.asset_id);
      return asset ? { bookAssetId: link.id, asset } : null;
    })
    .filter((x): x is { bookAssetId: string; asset: IllustrationAsset } => x !== null);
  const linkedAssetIds = new Set(linkedAssets.map((l) => l.asset.id));
  const availableAssets = (allAssets ?? []).filter((a) => !linkedAssetIds.has(a.id));

  const hasArtefacts = !!seed || !!recording || (fieldMedia && fieldMedia.length > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-heading text-2xl">{book.working_title}</h1>
      <BookTabs bookId={book.id} current="illustration" />

      {hasArtefacts && (
        <Card>
          <CardHeader
            title="Source artefacts"
            subtitle="Everything the author worked from — for authenticity, not just the illustration prompts."
            action={
              seed ? (
                <Link href={`/workspace/story-seeds/${seed.id}`} className="text-sm text-forest hover:underline">
                  Open story seed →
                </Link>
              ) : undefined
            }
          />
          <CardBody className="space-y-4">
            {recording && <ParallelCorpusPreview segments={segments ?? []} />}
            {fieldMedia && fieldMedia.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-ink/80">Field assets</h3>
                <MediaGallery media={fieldMedia} writable={false} />
              </div>
            )}
            {seed && seed.reference_resources.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-ink/80">Research resources</h3>
                <ReferenceResourceEditor initialResources={seed.reference_resources} writable={false} />
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Linked assets"
          subtitle="Characters, scenes, and objects reused from the project library."
          action={
            <Link href="/workspace/assets" className="text-sm text-forest hover:underline">
              Manage library →
            </Link>
          }
        />
        <CardBody>
          <AssetLinker bookId={book.id} linked={linkedAssets} available={availableAssets} writable={writable} />
        </CardBody>
      </Card>

      {!job ? (
        <EmptyState
          title="No illustration job yet"
          description="Start one once the manuscript is locked and ready for art."
          action={
            writable ? (
              <form action={createIllustrationJob.bind(null, book.id)}>
                <Button type="submit">Start illustration job</Button>
              </form>
            ) : undefined
          }
        />
      ) : (
        <>
          <Card>
            <CardHeader title="Job brief" />
            <CardBody>
              <form action={updateJobMeta.bind(null, job.id, book.id)} className="space-y-3">
                <Field label="Character sheet notes" htmlFor="character_sheet">
                  <Textarea id="character_sheet" name="character_sheet" rows={2} defaultValue={job.character_sheet ?? ''} disabled={!writable} />
                </Field>
                <Field label="Setting notes" htmlFor="setting_notes">
                  <Textarea id="setting_notes" name="setting_notes" rows={2} defaultValue={job.setting_notes ?? ''} disabled={!writable} />
                </Field>
                <Field label="Style direction" htmlFor="style_direction">
                  <Textarea id="style_direction" name="style_direction" rows={2} defaultValue={job.style_direction ?? ''} disabled={!writable} />
                </Field>
                <Field label="Reference files" htmlFor="reference_files" hint="URL or path to a reference folder">
                  <Input id="reference_files" name="reference_files" defaultValue={job.reference_files ?? ''} disabled={!writable} />
                </Field>
                {writable && <Button type="submit" size="sm">Save brief</Button>}
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Milestones" />
            <CardBody>
              <MilestoneTracker jobId={job.id} bookId={book.id} initialMilestones={job.milestones} writable={writable} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Authenticity checklist" />
            <CardBody>
              <ChecklistEditor
                items={AUTHENTICITY_CHECKLIST}
                initialValues={job.authenticity_checklist ?? {}}
                disabled={!writable}
                action={updateAuthenticityChecklist.bind(null, job.id)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Pages" subtitle="Optional annotation layer feeds the corpus export." />
            <CardBody className="space-y-6">
              {pages.length === 0 && <p className="text-sm text-ink/50">No pages added yet.</p>}
              {pages.map((page) => (
                <ImageAnnotator key={page.id} page={page} bookId={book.id} writable={writable} />
              ))}

              {writable && (
                <form action={addIllustrationPage.bind(null, job.id, book.id)} className="space-y-2 border-t border-ink/10 pt-4">
                  <Field
                    label="Artwork links"
                    htmlFor="file_reference"
                    hint={`One per line, in page order — added starting at page ${pages.length + 1}`}
                  >
                    <Textarea id="file_reference" name="file_reference" rows={3} placeholder="https://…&#10;https://…" />
                  </Field>
                  <Field label="Notes" htmlFor="notes" hint="applies to all pages added, if set">
                    <Input id="notes" name="notes" />
                  </Field>
                  <Button type="submit">+ Add page(s)</Button>
                </form>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
