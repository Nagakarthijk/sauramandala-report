import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import {
  updateCondensedText,
  updateFilterChecklist,
  updateFilterOutcome,
  promoteToBook,
} from '@/app/workspace/story-seeds/actions';
import { STORY_SEED_REQUIRED_CHECKLIST, STORY_SEED_DISQUALIFYING_CHECKLIST } from '@/lib/checklists';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { AutoSaveTextarea } from '@/components/workspace/AutoSaveTextarea';
import { ChecklistEditor } from '@/components/workspace/ChecklistEditor';
import { Select, Field, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Comments } from '@/components/comments/Comments';
import type { StorySeed } from '@/lib/types';

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

  const { data: existingBook } = await supabase
    .from('books')
    .select('id')
    .eq('story_seed_id', seed.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/workspace/story-seeds" className="text-sm text-ink/50 hover:underline">
        ← Story seeds
      </Link>
      <h1 className="font-heading text-2xl">{seed.working_title || 'Untitled seed'}</h1>

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
