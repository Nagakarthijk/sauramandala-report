import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import { updateFieldVisitChecklist, updateFieldVisitNotes } from '@/app/workspace/field-visits/actions';
import { FIELD_VISIT_CHECKLIST } from '@/lib/checklists';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ChecklistEditor } from '@/components/workspace/ChecklistEditor';
import { AutoSaveTextarea } from '@/components/workspace/AutoSaveTextarea';
import { Comments } from '@/components/comments/Comments';
import { formatDate } from '@/lib/utils';
import type { FieldVisit, Recording } from '@/lib/types';

export default async function FieldVisitDetailPage({ params }: { params: { id: string } }) {
  const { supabase, project, role } = await requireProject();

  const { data: visit } = await supabase
    .from('field_visits')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single<FieldVisit>();

  if (!visit) notFound();

  const { data: recordingsData } = await supabase
    .from('recordings')
    .select('*')
    .eq('field_visit_id', visit.id)
    .returns<Recording[]>();
  const recordings = recordingsData ?? [];

  const writable = canWrite(role, 'field_visits');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/workspace/field-visits" className="text-sm text-ink/50 hover:underline">
        ← Field visits
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl">{visit.location || 'Unnamed location'}</h1>
          <p className="text-sm text-ink/60">
            {formatDate(visit.visit_date)} · {visit.region}
          </p>
        </div>
        {visit.outcome && <Badge color="forest">{visit.outcome.replace(/_/g, ' ')}</Badge>}
      </div>

      <Card>
        <CardHeader title="Details" />
        <CardBody className="space-y-3 text-sm">
          <div>
            <span className="font-medium text-ink/70">Resource person(s): </span>
            {visit.resource_persons || '—'}
          </div>
          <div>
            <span className="font-medium text-ink/70">Subject / theme: </span>
            {visit.subject_theme || '—'}
          </div>
          <div>
            <span className="font-medium text-ink/70">How identified: </span>
            {visit.how_identified || '—'}
          </div>
          <div>
            <span className="mb-1 block font-medium text-ink/70">Notes</span>
            <AutoSaveTextarea
              initialValue={visit.visit_notes ?? ''}
              disabled={!writable}
              action={updateFieldVisitNotes.bind(null, visit.id)}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Field visit checklist" />
        <CardBody>
          <ChecklistEditor
            items={FIELD_VISIT_CHECKLIST}
            initialValues={visit.checklist ?? {}}
            disabled={!writable}
            action={updateFieldVisitChecklist.bind(null, visit.id)}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Recordings"
          action={
            <Link href={`/workspace/recordings/${visit.id}`}>
              <Button size="sm" variant="secondary">
                {recordings.length > 0 ? 'View recordings' : '+ Add a recording'}
              </Button>
            </Link>
          }
        />
        <CardBody>
          {recordings.length === 0 ? (
            <p className="text-sm text-ink/50">No recordings logged for this visit yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recordings.map((r) => (
                <li key={r.id}>
                  <Link href={`/workspace/transcripts/${r.id}`} className="text-forest hover:underline">
                    {r.speaker_name || r.file_name || 'Untitled recording'}
                  </Link>{' '}
                  <span className="text-ink/40">
                    · {r.language_code || 'language unset'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Comments targetTable="field_visits" targetId={visit.id} projectId={project.id} />
    </div>
  );
}
