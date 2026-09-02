import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import { updatePublicationMeta, updateCredits } from '@/app/workspace/books/[bookId]/publish/actions';
import { BookTabs } from '@/components/workspace/BookTabs';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { CreditsEditor } from '@/components/workspace/CreditsEditor';
import type { Book, Manuscript, IllustrationJob, IllustrationPage, Translation } from '@/lib/types';

export default async function PublishPage({ params }: { params: { bookId: string } }) {
  const { supabase, project, role } = await requireProject();

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.bookId)
    .eq('project_id', project.id)
    .single<Book>();
  if (!book) notFound();

  const writable = canWrite(role, 'books');

  const { data: manuscript } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('book_id', book.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle<Manuscript>();

  const { data: job } = await supabase
    .from('illustration_jobs')
    .select('*')
    .eq('book_id', book.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<IllustrationJob>();

  const [{ data: illustrationPagesData }, { data: translationsData }] = await Promise.all([
    job
      ? supabase.from('illustration_pages').select('*').eq('illustration_job_id', job.id).returns<IllustrationPage[]>()
      : Promise.resolve({ data: null }),
    supabase.from('translations').select('*').eq('book_id', book.id).returns<Translation[]>(),
  ]);

  const artByPageNumber = new Map((illustrationPagesData ?? []).map((p) => [p.page_number, p]));
  const translations = translationsData ?? [];
  const meta = book.publication_meta ?? {};
  const pages = manuscript?.page_data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-heading text-2xl">{book.working_title}</h1>
      <BookTabs bookId={book.id} current="publish" />

      {!manuscript ? (
        <EmptyState title="No manuscript yet" description="Final pagination needs a manuscript to assemble from." />
      ) : (
        <Card>
          <CardHeader
            title="Final pagination"
            subtitle={`v${manuscript.version_number}${manuscript.is_locked ? ' · locked' : ' · not yet locked'} — text, art, and translations per page`}
          />
          <CardBody className="space-y-4">
            {pages.map((page) => {
              const art = artByPageNumber.get(page.page_num);
              return (
                <div key={page.page_num} className="rounded-md border border-ink/10 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-medium">{page.label || `Page ${page.page_num}`}</span>
                    {art ? (
                      <Badge color={art.annotation_status === 'complete' ? 'forest' : 'turmeric'}>art ready</Badge>
                    ) : (
                      <Badge color="rust">no artwork yet</Badge>
                    )}
                  </div>
                  <p className="text-sm text-ink/80">{page.text || '—'}</p>
                  {art?.file_reference && (
                    <a href={art.file_reference} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-forest hover:underline">
                      {art.file_reference}
                    </a>
                  )}
                  {translations.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-ink/5 pt-2">
                      {translations.map((t) => {
                        const tPage = t.page_data.find((p) => p.page_num === page.page_num);
                        return (
                          <p key={t.id} className="text-xs text-ink/60">
                            <span className="font-medium">{t.target_language}: </span>
                            {tPage?.text || '—'}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Publication details" />
        <CardBody className="space-y-4">
          <form action={updatePublicationMeta.bind(null, book.id)} className="grid grid-cols-2 gap-4">
            <Field label="ISBN" htmlFor="isbn">
              <Input id="isbn" name="isbn" defaultValue={meta.isbn ?? ''} disabled={!writable} />
            </Field>
            <div className="col-span-2">
              <Field label="Print notes" htmlFor="print_notes">
                <Textarea id="print_notes" name="print_notes" rows={2} defaultValue={meta.print_notes ?? ''} disabled={!writable} />
              </Field>
            </div>
            {writable && <Button type="submit" size="sm" className="col-span-2 w-fit">Save</Button>}
          </form>

          <div className="border-t border-ink/10 pt-4">
            <h3 className="mb-2 text-sm font-medium text-ink/80">Credits</h3>
            <CreditsEditor initialCredits={meta.credits ?? []} writable={writable} action={updateCredits.bind(null, book.id)} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
