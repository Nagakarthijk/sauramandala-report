'use server';

import { revalidatePath } from 'next/cache';
import { requireProject } from '@/lib/workspace';
import { logActivity } from '@/lib/activity';
import type { SlsCue, SyncStatus } from '@/lib/types';

export async function createReadalong(bookId: string, formData: FormData) {
  const { supabase, project, user } = await requireProject();

  const language = String(formData.get('language') || '').trim();
  if (!language) return;

  const { data, error } = await supabase
    .from('readalongs')
    .insert({
      book_id: bookId,
      project_id: project.id,
      language,
      narrator: String(formData.get('narrator') || '') || null,
      audio_file_reference: String(formData.get('audio_file_reference') || '') || null,
    })
    .select()
    .single();

  if (!error && data) {
    await logActivity(supabase, {
      projectId: project.id,
      userId: user.id,
      action: 'readalong.created',
      targetTable: 'readalongs',
      targetId: data.id,
      metadata: { language },
    });
  }

  revalidatePath(`/workspace/books/${bookId}/readalong`);
}

export async function updateReadalongMeta(readalongId: string, bookId: string, formData: FormData) {
  const { supabase, project } = await requireProject();
  await supabase
    .from('readalongs')
    .update({
      narrator: String(formData.get('narrator') || '') || null,
      audio_file_reference: String(formData.get('audio_file_reference') || '') || null,
      attribution_file_reference: String(formData.get('attribution_file_reference') || '') || null,
    })
    .eq('id', readalongId)
    .eq('project_id', project.id);
  revalidatePath(`/workspace/books/${bookId}/readalong`);
}

export async function updateCues(readalongId: string, bookId: string, cues: SlsCue[]) {
  const { supabase, project } = await requireProject();
  await supabase.from('readalongs').update({ sls_csv_data: cues }).eq('id', readalongId).eq('project_id', project.id);
  revalidatePath(`/workspace/books/${bookId}/readalong`);
}

export async function updateSyncStatus(readalongId: string, bookId: string, sync_status: SyncStatus) {
  const { supabase, project } = await requireProject();
  await supabase.from('readalongs').update({ sync_status }).eq('id', readalongId).eq('project_id', project.id);
  revalidatePath(`/workspace/books/${bookId}/readalong`);
}
