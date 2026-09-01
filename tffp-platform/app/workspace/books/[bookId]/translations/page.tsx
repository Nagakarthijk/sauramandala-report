import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import { createTranslation } from '@/app/workspace/books/[bookId]/translations/actions';
import { BookTabs } from '@/components/workspace/BookTabs';
import { TranslationEditor } from '@/components/translation-editor/TranslationEditor';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Book, Manuscript, Translation } from '@/lib/types';

export default async function TranslationsPage({ params }: { params: { bookId: string } }) {
  const { supabase, project, role } = await requireProject();

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.bookId)
    .eq('project_id', project.id)
    .single<Book>();
  if (!book) notFound();

  const { data: latest } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('book_id', book.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle<Manuscript>();

  const { data: translationsData } = await supabase
    .from('translations')
    .select('*')
    .eq('book_id', book.id)
    .order('created_at', { ascending: false })
    .returns<Translation[]>();

  const translations = translationsData ?? [];
  const writable = canWrite(role, 'translations');

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-heading text-2xl">{book.working_title}</h1>
      <BookTabs bookId={book.id} current="translations" />

      {!latest ? (
        <EmptyState title="No manuscript yet" description="Lock an English manuscript before starting translations." />
      ) : (
        <>
          {translations.length === 0 ? (
            <EmptyState title="No translations started" description="Assign the first language below." />
          ) : (
            <div className="space-y-3">
              {translations.map((t) => (
                <TranslationEditor
                  key={t.id}
                  translation={t}
                  bookId={book.id}
                  englishPages={latest.page_data}
                  writable={writable}
                />
              ))}
            </div>
          )}

          {writable && (
            <Card>
              <CardHeader title="Assign a new language" />
              <CardBody>
                <form action={createTranslation.bind(null, book.id)} className="flex items-end gap-3">
                  <div className="flex-1">
                    <Field label="Target language" htmlFor="target_language">
                      <Input id="target_language" name="target_language" required placeholder="Khasi" />
                    </Field>
                  </div>
                  <div className="flex-1">
                    <Field label="Language code" htmlFor="target_language_code" hint="optional">
                      <Input id="target_language_code" name="target_language_code" placeholder="kha" />
                    </Field>
                  </div>
                  <Button type="submit">Assign</Button>
                </form>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
