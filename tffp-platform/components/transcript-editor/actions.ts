'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';

export async function createSegment(recordingId: string, projectId: string, order: number) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transcript_segments')
    .insert({ recording_id: recordingId, project_id: projectId, segment_order: order })
    .select()
    .single();

  if (error) {
    console.error('create segment failed', error.message);
    return null;
  }
  return data;
}

export async function updateSegment(
  segmentId: string,
  fields: Partial<{
    text_source: string;
    text_english: string;
    start_time_ms: number | null;
    end_time_ms: number | null;
    tags: string[];
    condensation_notes: string;
  }>
) {
  const supabase = createClient();
  const { error } = await supabase.from('transcript_segments').update(fields).eq('id', segmentId);
  if (error) console.error('update segment failed', error.message);
}

export async function setSegmentReviewed(
  segmentId: string,
  reviewed: boolean,
  projectId: string,
  path: string
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('transcript_segments')
    .update({
      reviewed,
      reviewed_by: reviewed ? user?.id ?? null : null,
      reviewed_at: reviewed ? new Date().toISOString() : null,
    })
    .eq('id', segmentId);

  if (!error) {
    await logActivity(supabase, {
      projectId,
      userId: user?.id,
      action: reviewed ? 'transcript.segment.approved' : 'transcript.segment.unapproved',
      targetTable: 'transcript_segments',
      targetId: segmentId,
    });
  } else {
    console.error('set reviewed failed', error.message);
  }

  revalidatePath(path);
}

export async function markAllReviewed(recordingId: string, projectId: string, path: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('transcript_segments')
    .update({ reviewed: true, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq('recording_id', recordingId)
    .eq('reviewed', false);

  if (!error) {
    await logActivity(supabase, {
      projectId,
      userId: user?.id,
      action: 'transcript.recording.marked_reviewed',
      targetTable: 'recordings',
      targetId: recordingId,
    });
  }

  revalidatePath(path);
}

export async function deleteSegment(segmentId: string, path: string) {
  const supabase = createClient();
  const { error } = await supabase.from('transcript_segments').delete().eq('id', segmentId);
  if (error) console.error('delete segment failed', error.message);
  revalidatePath(path);
}
