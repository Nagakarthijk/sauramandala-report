'use server';

import { revalidatePath } from 'next/cache';
import { requireProject } from '@/lib/workspace';
import { logActivity } from '@/lib/activity';

export async function createRecording(fieldVisitId: string, formData: FormData) {
  const { supabase, project, user } = await requireProject();

  const duration = String(formData.get('duration_seconds') || '');

  const { data, error } = await supabase
    .from('recordings')
    .insert({
      project_id: project.id,
      field_visit_id: fieldVisitId,
      file_reference: String(formData.get('file_reference') || '') || null,
      file_name: String(formData.get('file_name') || '') || null,
      duration_seconds: duration ? Number(duration) : null,
      language_code: String(formData.get('language_code') || '') || null,
      dialect_tag: String(formData.get('dialect_tag') || '') || null,
      speaker_name: String(formData.get('speaker_name') || '') || null,
      speaker_consent: formData.get('speaker_consent') === 'on',
      notes: String(formData.get('notes') || '') || null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('create recording failed', error?.message);
    return;
  }

  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    action: 'recording.created',
    targetTable: 'recordings',
    targetId: data.id,
  });

  revalidatePath(`/workspace/recordings/${fieldVisitId}`);
}
