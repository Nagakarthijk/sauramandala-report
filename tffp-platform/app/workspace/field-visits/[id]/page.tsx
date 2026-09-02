import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import {
  updateFieldVisitChecklist,
  updateFieldVisitNotes,
  addFieldVisitMedia,
  deleteFieldVisitMedia,
} from '@/app/workspace/field-visits/actions';
import { FIELD_VISIT_CHECKLIST } from '@/lib/checklists';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ChecklistEditor } from '@/components/workspace/ChecklistEditor';
import { AutoSaveTextarea } from '@/components/workspace/AutoSaveTextarea';
import { MediaGallery } from '@/components/workspace/MediaGallery';
import { ErrorPanel } from '@/components/workspace/ErrorPanel';
import { Comments } from '@/components/comments/Comments';
import { formatDate } from '@/lib/utils';
import { debugLog } from '@/lib/debugLog';
import type { FieldVisit, Recording, FieldVisitMedia } from '@/lib/types';

// Next's redirect()/notFound() work by throwing a special internal
// object that must propagate uncaught. A catch-all around this page
// (added purely to stop the crash from being an opaque dead end) must
// not swallow those, so it re-throws anything shaped like one instead
// of treating it as a real error.
function isNextControlFlowError(err: unknown): boolean {
  if (!err || typeof err !== 'object' || !('digest' in err)) return false;
  const digest = (err as { digest?: unknown }).digest;
  return typeof digest === 'string' && (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND');
}

export default async function FieldVisitDetailPage({ params }: { params: { id: string } }) {
  try {
    await debugLog('FieldVisitDetailPage', 'start', { id: params.id });

    const { supabase, project, role } = await requireProject();
    await debugLog('FieldVisitDetailPage', 'got project', { projectId: project.id, role });

    const { data: visit, error: visitError } = await supabase
      .from('field_visits')
      .select('*')
      .eq('id', params.id)
      .eq('project_id', project.id)
      .single<FieldVisit>();

    await debugLog('FieldVisitDetailPage', 'visit query done', {
      hasVisit: !!visit,
      error: visitError?.message ?? null,
      code: visitError?.code ?? null,
    });

    if (visitError && visitError.code !== 'PGRST116') {
      return <ErrorPanel label="loading the field visit" error={visitError} />;
    }
    if (!visit) notFound();

    const [recordingsResult, mediaResult] = await Promise.all([
      supabase.from('recordings').select('*').eq('field_visit_id', visit.id).returns<Recording[]>(),
      supabase
        .from('field_visit_media')
        .select('*')
        .eq('field_visit_id', visit.id)
        .order('created_at', { ascending: false })
        .returns<FieldVisitMedia[]>(),
    ]);

    await debugLog('FieldVisitDetailPage', 'recordings + media queries done', {
      recordingsError: recordingsResult.error?.message ?? null,
      mediaError: mediaResult.error?.message ?? null,
    });

    if (recordingsResult.error) {
      return <ErrorPanel label="loading recordings" error={recordingsResult.error} />;
    }
    if (mediaResult.error) {
      return <ErrorPanel label="loading field visit media" error={mediaResult.error} />;
    }

    const recordings = recordingsResult.data ?? [];
    const media = mediaResult.data ?? [];

    const writable = canWrite(role, 'field_visits');

    await debugLog('FieldVisitDetailPage', 'about to render JSX');

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

        <Card>
          <CardHeader title="Media" subtitle="Photos, video, and other assets from this visit — beyond the audio recordings above." />
          <CardBody>
            <MediaGallery
              media={media}
              writable={writable}
              projectId={project.id}
              addAction={addFieldVisitMedia.bind(null, visit.id)}
              deleteAction={(mediaId) => deleteFieldVisitMedia(mediaId, visit.id)}
            />
          </CardBody>
        </Card>

        <Comments targetTable="field_visits" targetId={visit.id} projectId={project.id} />
      </div>
    );
  } catch (err) {
    if (isNextControlFlowError(err)) throw err;
    await debugLog('FieldVisitDetailPage', 'CAUGHT AT TOP LEVEL', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return (
      <ErrorPanel
        label="rendering the field visit page (caught at top level)"
        error={{ message: err instanceof Error ? err.message : String(err) }}
      />
    );
  }
}
