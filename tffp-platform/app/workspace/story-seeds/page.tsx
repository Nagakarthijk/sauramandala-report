import Link from 'next/link';
import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import { createStorySeed } from '@/app/workspace/story-seeds/actions';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { StorySeed, Recording } from '@/lib/types';

const OUTCOME_COLOR: Record<string, 'forest' | 'turmeric' | 'rust' | 'neutral'> = {
  proceed: 'forest',
  potential: 'turmeric',
  more_research: 'turmeric',
  archive: 'neutral',
};

export default async function StorySeedsPage() {
  const { supabase, project, role } = await requireProject();

  const [{ data: seedsData }, { data: recordingsData }] = await Promise.all([
    supabase
      .from('story_seeds')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .returns<StorySeed[]>(),
    supabase.from('recordings').select('*').eq('project_id', project.id).returns<Recording[]>(),
  ]);

  const seeds = seedsData ?? [];
  const recordings = recordingsData ?? [];
  const writable = canWrite(role, 'story_seeds');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl">Story seeds</h1>
        <p className="text-sm text-ink/60">Condensed, filtered candidates on their way to becoming books.</p>
      </div>

      {seeds.length === 0 ? (
        <EmptyState title="No story seeds yet" description="Condense a reviewed recording into a seed to get started." />
      ) : (
        <div className="grid gap-3">
          {seeds.map((seed) => (
            <Link key={seed.id} href={`/workspace/story-seeds/${seed.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardBody className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{seed.working_title || 'Untitled seed'}</span>
                      {seed.filter_outcome && (
                        <Badge color={OUTCOME_COLOR[seed.filter_outcome] ?? 'neutral'}>
                          {seed.filter_outcome.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>
                    <p className="line-clamp-1 text-sm text-ink/60">
                      {seed.condensed_text || 'No condensation written yet.'}
                    </p>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {writable && (
        <Card>
          <CardHeader title="New story seed" />
          <CardBody>
            <form action={createStorySeed} className="flex items-end gap-3">
              <div className="flex-1">
                <Field label="Working title" htmlFor="working_title">
                  <Input id="working_title" name="working_title" placeholder="The girl who counted stars" />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="From recording" htmlFor="recording_id" hint="optional">
                  <Select id="recording_id" name="recording_id" defaultValue="">
                    <option value="">— none —</option>
                    {recordings.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.speaker_name || r.file_name || r.id.slice(0, 8)}
                      </option>
                    ))}
                  </Select>
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
