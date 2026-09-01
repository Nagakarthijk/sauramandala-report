import Link from 'next/link';
import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import { createBookDirect } from '@/app/workspace/books/actions';
import type { Book, BookStatus } from '@/lib/types';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

const COLUMNS: { status: BookStatus; label: string }[] = [
  { status: 'concept', label: 'Concept' },
  { status: 'manuscript_draft', label: 'Manuscript draft' },
  { status: 'manuscript_locked', label: 'Manuscript locked' },
  { status: 'illustration', label: 'Illustration' },
  { status: 'translation', label: 'Translation' },
  { status: 'readalong', label: 'Readalong' },
  { status: 'published', label: 'Published' },
];

export default async function BooksBoardPage() {
  const { supabase, project, role } = await requireProject();

  const { data } = await supabase
    .from('books')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .returns<Book[]>();

  const books = data ?? [];
  const writable = canWrite(role, 'books');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">Books</h1>
          <p className="text-sm text-ink/60">{project.name}</p>
        </div>
      </div>

      {books.length === 0 ? (
        <EmptyState
          title="No books yet"
          description="Books usually start from a filtered story seed, but you can also start one directly below."
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <div key={col.status} className="w-64 shrink-0">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">
                {col.label} · {books.filter((b) => b.status === col.status).length}
              </h2>
              <div className="space-y-2">
                {books
                  .filter((b) => b.status === col.status)
                  .map((book) => (
                    <Link key={book.id} href={`/workspace/books/${book.id}/concept`}>
                      <Card className="transition-shadow hover:shadow-md">
                        <CardBody>
                          <p className="font-medium">{book.working_title}</p>
                          {book.reading_level && (
                            <p className="text-xs text-ink/50">Level {book.reading_level}</p>
                          )}
                        </CardBody>
                      </Card>
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {writable && (
        <Card className="max-w-md">
          <CardBody>
            <h3 className="mb-2 font-heading text-base">Start a book directly</h3>
            <form action={createBookDirect} className="flex items-end gap-3">
              <div className="flex-1">
                <Field label="Working title" htmlFor="working_title">
                  <Input id="working_title" name="working_title" required />
                </Field>
              </div>
              <Button type="submit">Create</Button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
