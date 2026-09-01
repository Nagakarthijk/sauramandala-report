import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { canWriteRecord } from '@/lib/permissions';
import { BookTabs } from '@/components/workspace/BookTabs';
import { StoryboardBuilder } from '@/components/storyboard-builder/StoryboardBuilder';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/utils';
import { Comments } from '@/components/comments/Comments';
import type { Book, Manuscript } from '@/lib/types';

export default async function ManuscriptPage({ params }: { params: { bookId: string } }) {
  const { supabase, project, role, user } = await requireProject();

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.bookId)
    .eq('project_id', project.id)
    .single<Book>();

  if (!book) notFound();

  const { data: manuscriptsData } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('book_id', book.id)
    .order('version_number', { ascending: false })
    .returns<Manuscript[]>();

  const manuscripts = manuscriptsData ?? [];
  const latest = manuscripts[0] ?? null;
  const nextVersion = latest ? latest.version_number + 1 : 1;
  const writable = canWriteRecord(role, 'manuscripts', book.author_id, user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-heading text-2xl">{book.working_title}</h1>
      <BookTabs bookId={book.id} current="manuscript" />

      <Card>
        <CardHeader
          title={latest ? `Editing v${nextVersion}` : 'Start the first draft'}
          subtitle="Every save creates a new version — nothing is ever overwritten."
        />
        <CardBody>
          <StoryboardBuilder
            bookId={book.id}
            nextVersion={nextVersion}
            initialPages={latest?.page_data ?? []}
            initialLayoutFormat={latest?.layout_format ?? ''}
            writable={writable}
            aiEnabled={!!project.settings.ai_enabled}
            currentManuscriptId={latest?.id ?? null}
            isLocked={!!latest?.is_locked}
          />
        </CardBody>
      </Card>

      {manuscripts.length > 1 && (
        <Card>
          <CardHeader title="Version history" />
          <CardBody>
            <ul className="space-y-1 text-sm">
              {manuscripts.map((m) => (
                <li key={m.id} className="flex items-center justify-between">
                  <span>
                    v{m.version_number} · {formatDateTime(m.created_at)} · {m.page_data.length} pages
                  </span>
                  {m.is_locked && <span className="text-xs text-indigo">locked</span>}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {latest && <Comments targetTable="manuscripts" targetId={latest.id} projectId={project.id} />}
    </div>
  );
}
