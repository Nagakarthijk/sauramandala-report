'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { logActivity } from '@/lib/activity';
import type { FieldVisitOutcome } from '@/lib/types';

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
