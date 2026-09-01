import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import { createReadalong } from '@/app/workspace/books/[bookId]/readalong/actions';
import { BookTabs } from '@/components/workspace/BookTabs';
import { CueEditor } from '@/components/readalong/CueEditor';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Book, Readalong } from '@/lib/types';

export default async function ReadalongPage({ params }: { params: { bookId: string } }) {
  const { supabase, project, role } = await requireProject();

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.bookId)
    .eq('project_id', project.id)
    .single<Book>();
  if (!book) notFound();

  const { data: readalongsData } = await supabase
    .from('readalongs')
    .select('*')
    .eq('book_id', book.id)
    .order('language', { ascending: true })
    .returns<Readalong[]>();

  const readalongs = readalongsData ?? [];
  const writable = canWrite(role, 'translations'); // readalong recording sits alongside translation work in the spec's role table

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-heading text-2xl">{book.working_title}</h1>
      <BookTabs bookId={book.id} current="readalong" />

      {readalongs.length === 0 ? (
        <EmptyState title="No readalongs yet" description="Add one per language once a narration is recorded." />
      ) : (
        <div className="space-y-3">
          {readalongs.map((r) => (
            <CueEditor key={r.id} readalong={r} bookId={book.id} writable={writable} swEnabled={!!project.settings.sw_enabled} />
          ))}
        </div>
      )}

      {writable && (
        <Card>
          <CardHeader title="Add a readalong" />
          <CardBody>
            <form action={createReadalong.bind(null, book.id)} className="grid grid-cols-3 gap-3">
              <Field label="Language" htmlFor="language">
                <Input id="language" name="language" required placeholder="Khasi" />
              </Field>
              <Field label="Narrator" htmlFor="narrator">
                <Input id="narrator" name="narrator" />
              </Field>
              <Field label="Audio reference" htmlFor="audio_file_reference">
                <Input id="audio_file_reference" name="audio_file_reference" placeholder="https://…" />
              </Field>
              <Button type="submit" className="col-span-3 w-fit">Add</Button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
