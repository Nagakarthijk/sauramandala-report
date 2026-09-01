import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import { createEditorialRound } from '@/app/workspace/books/[bookId]/editorial/actions';
import { BookTabs } from '@/components/workspace/BookTabs';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Select, Textarea, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/utils';
import type { Book, Manuscript, EditorialRound } from '@/lib/types';

const VERDICT_COLOR: Record<string, 'forest' | 'turmeric' | 'rust' | 'neutral'> = {
  approved: 'forest',
  proceed: 'forest',
  rethink: 'turmeric',
  chuck: 'rust',
};

export default async function EditorialPage({ params }: { params: { bookId: string } }) {
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

  const { data: roundsData } = latest
    ? await supabase
        .from('editorial_rounds')
        .select('*')
        .eq('manuscript_id', latest.id)
        .order('created_at', { ascending: false })
        .returns<EditorialRound[]>()
    : { data: [] as EditorialRound[] };

  const rounds = roundsData ?? [];
  const writable = canWrite(role, 'editorial');

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-heading text-2xl">{book.working_title}</h1>
      <BookTabs bookId={book.id} current="editorial" />

      {!latest ? (
        <EmptyState title="No manuscript yet" description="Start a manuscript draft before recording editorial feedback." />
      ) : (
        <>
          <div className="space-y-3">
            {rounds.length === 0 && <p className="text-sm text-ink/50">No editorial rounds recorded yet.</p>}
            {rounds.map((round) => (
              <Card key={round.id}>
                <CardBody className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Draft {round.draft_number}</span>
                    {round.verdict && (
                      <Badge color={VERDICT_COLOR[round.verdict] ?? 'neutral'}>{round.verdict}</Badge>
                    )}
                    <span className="ml-auto text-xs text-ink/40">{formatDateTime(round.created_at)}</span>
                  </div>
                  {round.what_works && (
                    <p className="text-sm"><span className="font-medium text-ink/70">What works: </span>{round.what_works}</p>
                  )}
                  {round.feedback_structural && (
                    <p className="text-sm"><span className="font-medium text-ink/70">Structural: </span>{round.feedback_structural}</p>
                  )}
                  {round.feedback_cultural && (
                    <p className="text-sm"><span className="font-medium text-ink/70">Cultural: </span>{round.feedback_cultural}</p>
                  )}
                  {round.feedback_lines && (
                    <p className="text-sm"><span className="font-medium text-ink/70">Line notes: </span>{round.feedback_lines}</p>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>

          {writable && (
            <Card>
              <CardHeader title={`Record feedback on v${latest.version_number}`} />
              <CardBody>
                <form action={createEditorialRound.bind(null, book.id, latest.id)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Draft number" htmlFor="draft_number">
                      <Input id="draft_number" name="draft_number" type="number" defaultValue={latest.version_number} min={1} />
                    </Field>
                    <Field label="Verdict" htmlFor="verdict">
                      <Select id="verdict" name="verdict" defaultValue="">
                        <option value="">— none —</option>
                        <option value="proceed">Proceed</option>
                        <option value="rethink">Rethink</option>
                        <option value="chuck">Chuck</option>
                        <option value="approved">Approved</option>
                      </Select>
                    </Field>
                  </div>
                  <Field label="What works" htmlFor="what_works">
                    <Textarea id="what_works" name="what_works" rows={2} />
                  </Field>
                  <Field label="Structural feedback" htmlFor="feedback_structural">
                    <Textarea id="feedback_structural" name="feedback_structural" rows={2} />
                  </Field>
                  <Field label="Cultural feedback" htmlFor="feedback_cultural">
                    <Textarea id="feedback_cultural" name="feedback_cultural" rows={2} />
                  </Field>
                  <Field label="Line-level feedback" htmlFor="feedback_lines">
                    <Textarea id="feedback_lines" name="feedback_lines" rows={2} />
                  </Field>
                  <Button type="submit">Save round</Button>
                </form>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
