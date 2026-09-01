import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import {
  createIllustrationJob,
  updateJobMeta,
  addIllustrationPage,
} from '@/app/workspace/books/[bookId]/illustration/actions';
import { AUTHENTICITY_CHECKLIST } from '@/lib/checklists';
import { updateAuthenticityChecklist } from '@/app/workspace/books/[bookId]/illustration/actions';
import { BookTabs } from '@/components/workspace/BookTabs';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChecklistEditor } from '@/components/workspace/ChecklistEditor';
import { MilestoneTracker } from '@/components/illustration-annotator/MilestoneTracker';
import { ImageAnnotator } from '@/components/illustration-annotator/ImageAnnotator';
import type { Book, IllustrationJob, IllustrationPage } from '@/lib/types';

export default async function IllustrationPage({ params }: { params: { bookId: string } }) {
  const { supabase, project, role } = await requireProject();

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.bookId)
    .eq('project_id', project.id)
    .single<Book>();
  if (!book) notFound();

  const { data: job } = await supabase
    .from('illustration_jobs')
    .select('*')
    .eq('book_id', book.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<IllustrationJob>();

  const writable = canWrite(role, 'illustrations');

  const { data: pagesData } = job
    ? await supabase
        .from('illustration_pages')
        .select('*')
        .eq('illustration_job_id', job.id)
        .order('page_number', { ascending: true })
        .returns<IllustrationPage[]>()
    : { data: [] as IllustrationPage[] };
  const pages = pagesData ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-heading text-2xl">{book.working_title}</h1>
      <BookTabs bookId={book.id} current="illustration" />

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
                <form action={addIllustrationPage.bind(null, job.id, book.id)} className="flex items-end gap-3 border-t border-ink/10 pt-4">
                  <div className="flex-1">
                    <Field label="Image URL" htmlFor="file_reference">
                      <Input id="file_reference" name="file_reference" placeholder="https://…" />
                    </Field>
                  </div>
                  <div className="flex-1">
                    <Field label="Notes" htmlFor="notes" hint="optional">
                      <Input id="notes" name="notes" />
                    </Field>
                  </div>
                  <Button type="submit">+ Add page</Button>
                </form>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
