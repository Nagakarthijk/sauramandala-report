import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { canWriteRecord } from '@/lib/permissions';
import { updateConceptNote, updateBookMeta } from '@/app/workspace/books/actions';
import { BookTabs } from '@/components/workspace/BookTabs';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { AutoSaveTextarea } from '@/components/workspace/AutoSaveTextarea';
import { Field, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BookStatusBadge } from '@/components/ui/Badge';
import { BookStatusSelect } from '@/components/workspace/BookStatusSelect';
import { Comments } from '@/components/comments/Comments';
import type { Book, ConceptNote } from '@/lib/types';

const CONCEPT_FIELDS: Array<{ key: keyof ConceptNote; label: string; rows?: number }> = [
  { key: 'synopsis', label: 'Synopsis', rows: 5 },
  { key: 'problem_statement', label: 'Problem statement', rows: 3 },
  { key: 'visual_moments', label: 'Visual moments', rows: 3 },
  { key: 'style_preference', label: 'Style preference', rows: 2 },
  { key: 'community_region', label: 'Community / region', rows: 1 },
  { key: 'source_description', label: 'Source description', rows: 2 },
];

export default async function ConceptPage({ params }: { params: { bookId: string } }) {
  const { supabase, project, role, user } = await requireProject();

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.bookId)
    .eq('project_id', project.id)
    .single<Book>();

  if (!book) notFound();

  const writable = canWriteRecord(role, 'books', book.author_id, user.id);
  const note = book.concept_note ?? {};

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">{book.working_title}</h1>
        <BookStatusBadge status={book.status} />
      </div>
      <BookTabs bookId={book.id} current="concept" />

      <Card>
        <CardHeader title="Book details" />
        <CardBody>
          <form action={updateBookMeta.bind(null, book.id)} className="grid grid-cols-2 gap-4">
            <Field label="Working title" htmlFor="working_title">
              <Input id="working_title" name="working_title" defaultValue={book.working_title} disabled={!writable} />
            </Field>
            <Field label="Reading level" htmlFor="reading_level" hint="1–4">
              <Input
                id="reading_level"
                name="reading_level"
                type="number"
                min={1}
                max={4}
                defaultValue={book.reading_level ?? ''}
                disabled={!writable}
              />
            </Field>
            <div className="col-span-2">
              <Field label="Published URL" htmlFor="published_url" hint="wherever the final book lives">
                <Input id="published_url" name="published_url" defaultValue={book.published_url ?? ''} disabled={!writable} />
              </Field>
            </div>
            {writable && (
              <Button type="submit" size="sm" className="col-span-2 w-fit">
                Save details
              </Button>
            )}
          </form>

          {writable && (
            <div className="mt-4 border-t border-ink/10 pt-4">
              <span className="mb-1 block text-sm font-medium text-ink/80">Pipeline status</span>
              <BookStatusSelect bookId={book.id} status={book.status} />
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Concept note" />
        <CardBody className="space-y-4">
          {CONCEPT_FIELDS.map((field) => (
            <div key={field.key}>
              <span className="mb-1 block text-sm font-medium text-ink/80">{field.label}</span>
              <AutoSaveTextarea
                initialValue={note[field.key] ?? ''}
                rows={field.rows}
                disabled={!writable}
                action={async (value) => {
                  'use server';
                  await updateConceptNote(book.id, { ...note, [field.key]: value });
                }}
              />
            </div>
          ))}
        </CardBody>
      </Card>

      <Comments targetTable="books" targetId={book.id} projectId={project.id} />
    </div>
  );
}
