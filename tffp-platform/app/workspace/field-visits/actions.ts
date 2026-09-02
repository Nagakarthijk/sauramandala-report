'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { logActivity } from '@/lib/activity';
import type { FieldVisitOutcome, MediaType } from '@/lib/types';

export async function createFieldVisit(formData: FormData) {
  const { supabase, project, user } = await requireProject();

  const { data, error } = await supabase
    .from('field_visits')
    .insert({
      project_id: project.id,
      created_by: user.id,
      visit_date: String(formData.get('visit_date') || '') || null,
      location: String(formData.get('location') || '') || null,
      region: String(formData.get('region') || '') || null,
      resource_persons: String(formData.get('resource_persons') || '') || null,
      subject_theme: String(formData.get('subject_theme') || '') || null,
      how_identified: String(formData.get('how_identified') || '') || null,
      outcome: (String(formData.get('outcome') || '') || null) as FieldVisitOutcome | null,
      visit_notes: String(formData.get('visit_notes') || '') || null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('create field visit failed', error?.message);
    return;
  }

  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    action: 'field_visit.created',
    targetTable: 'field_visits',
    targetId: data.id,
  });

  redirect(`/workspace/field-visits/${data.id}`);
}

export async function updateFieldVisitChecklist(visitId: string, checklist: Record<string, boolean>) {
  const { supabase, project } = await requireProject();
  await supabase
    .from('field_visits')
    .update({ checklist })
    .eq('id', visitId)
    .eq('project_id', project.id);
  revalidatePath(`/workspace/field-visits/${visitId}`);
}

export async function updateFieldVisitNotes(visitId: string, visit_notes: string) {
  const { supabase, project } = await requireProject();
  await supabase
    .from('field_visits')
    .update({ visit_notes })
    .eq('id', visitId)
    .eq('project_id', project.id);
  revalidatePath(`/workspace/field-visits/${visitId}`);
}

export async function addFieldVisitMedia(visitId: string, formData: FormData) {
  const { supabase, project, user } = await requireProject();

  const tagsRaw = String(formData.get('tags') || '').trim();
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const mediaType = String(formData.get('media_type') || 'photo') as MediaType;
  const caption = String(formData.get('caption') || '') || null;
  const raw = String(formData.get('file_reference') || '').trim();

  // A folder link stands in for a whole batch — one row. Otherwise
  // every non-empty line is treated as a separate file, so pasting a
  // dozen links in one go tags them all at once with the same
  // type/caption/tags rather than one submission per file.
  const references =
    mediaType === 'folder'
      ? raw
        ? [raw]
        : []
      : raw
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);

  if (references.length === 0) return;

  const rows = references.map((file_reference) => ({
    field_visit_id: visitId,
    project_id: project.id,
    created_by: user.id,
    media_type: mediaType,
    file_reference,
    caption,
    tags,
  }));

  const { error } = await supabase.from('field_visit_media').insert(rows);

  if (error) console.error('add field visit media failed', error.message);

  revalidatePath(`/workspace/field-visits/${visitId}`);
}

export async function deleteFieldVisitMedia(mediaId: string, visitId: string) {
  const { supabase, project } = await requireProject();
  await supabase.from('field_visit_media').delete().eq('id', mediaId).eq('project_id', project.id);
  revalidatePath(`/workspace/field-visits/${visitId}`);
}
