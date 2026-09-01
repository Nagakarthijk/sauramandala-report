import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import { createRecording } from '@/app/workspace/recordings/actions';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { FieldVisit, Recording } from '@/lib/types';

export default async function RecordingsPage({ params }: { params: { visitId: string } }) {
  const { supabase, project, role } = await requireProject();

  const { data: visit } = await supabase
    .from('field_visits')
    .select('*')
    .eq('id', params.visitId)
    .eq('project_id', project.id)
    .single<FieldVisit>();

  if (!visit) notFound();

  const { data: recordingsData } = await supabase
    .from('recordings')
    .select('*')
    .eq('field_visit_id', visit.id)
    .order('created_at', { ascending: false })
    .returns<Recording[]>();
  const recordings = recordingsData ?? [];
  const writable = canWrite(role, 'recordings');
  const boundCreate = createRecording.bind(null, visit.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/workspace/field-visits/${visit.id}`} className="text-sm text-ink/50 hover:underline">
        ← {visit.location || 'Field visit'}
      </Link>
      <h1 className="font-heading text-2xl">Recordings</h1>

      <div className="space-y-3">
        {recordings.length === 0 && <p className="text-sm text-ink/50">No recordings yet.</p>}
        {recordings.map((r) => (
          <Card key={r.id}>
            <CardBody className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.speaker_name || 'Unnamed speaker'}</span>
                  {r.speaker_consent ? (
                    <Badge color="forest">consent on file</Badge>
                  ) : (
                    <Badge color="rust">consent missing</Badge>
                  )}
                </div>
                <p className="text-sm text-ink/60">
                  {r.language_code}
                  {r.dialect_tag ? ` (${r.dialect_tag})` : ''} ·{' '}
                  {r.duration_seconds ? `${Math.round(r.duration_seconds / 60)} min` : 'duration unset'}
                </p>
                {r.file_reference && (
                  <a
                    href={r.file_reference}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-forest hover:underline"
                  >
                    {r.file_reference}
                  </a>
                )}
              </div>
              <Link href={`/workspace/transcripts/${r.id}`}>
                <Button size="sm" variant="secondary">
                  Open transcript →
                </Button>
              </Link>
            </CardBody>
          </Card>
        ))}
      </div>

      {writable && (
        <Card>
          <CardHeader title="Add a recording" subtitle="Audio stays wherever your team stores it — paste the link or path." />
          <CardBody>
            <form action={boundCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Speaker name" htmlFor="speaker_name">
                  <Input id="speaker_name" name="speaker_name" />
                </Field>
                <Field label="File name" htmlFor="file_name">
                  <Input id="file_name" name="file_name" />
                </Field>
              </div>
              <Field label="File reference" htmlFor="file_reference" hint="Drive link, local path, or any URL">
                <Input id="file_reference" name="file_reference" placeholder="https://drive.google.com/…" />
              </Field>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Language code" htmlFor="language_code" hint="ISO 639-3, e.g. kha">
                  <Input id="language_code" name="language_code" />
                </Field>
                <Field label="Dialect" htmlFor="dialect_tag">
                  <Input id="dialect_tag" name="dialect_tag" />
                </Field>
                <Field label="Duration (seconds)" htmlFor="duration_seconds">
                  <Input id="duration_seconds" name="duration_seconds" type="number" min={0} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="speaker_consent" className="h-4 w-4 rounded border-ink/30 text-forest" />
                Speaker consent obtained and on file
              </label>
              <Field label="Notes" htmlFor="notes">
                <Textarea id="notes" name="notes" rows={2} />
              </Field>
              <Button type="submit">Save recording</Button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
