import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import { TranscriptEditor } from '@/components/transcript-editor/TranscriptEditor';
import { Comments } from '@/components/comments/Comments';
import type { Recording, TranscriptSegment } from '@/lib/types';

export default async function TranscriptPage({ params }: { params: { recordingId: string } }) {
  const { supabase, project, role } = await requireProject();

  const { data: recording } = await supabase
    .from('recordings')
    .select('*')
    .eq('id', params.recordingId)
    .eq('project_id', project.id)
    .single<Recording>();

  if (!recording) notFound();

  const { data: segmentsData } = await supabase
    .from('transcript_segments')
    .select('*')
    .eq('recording_id', recording.id)
    .order('segment_order', { ascending: true })
    .returns<TranscriptSegment[]>();

  return (
    <div className="space-y-6">
      <Link
        href={recording.field_visit_id ? `/workspace/recordings/${recording.field_visit_id}` : '/workspace/field-visits'}
        className="text-sm text-ink/50 hover:underline"
      >
        ← Recordings
      </Link>
      <h1 className="font-heading text-2xl">Transcript</h1>

      <TranscriptEditor
        recording={recording}
        initialSegments={segmentsData ?? []}
        projectId={project.id}
        writable={canWrite(role, 'transcripts')}
      />

      <Comments targetTable="recordings" targetId={recording.id} projectId={project.id} />
    </div>
  );
}
