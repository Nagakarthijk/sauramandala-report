'use server';

import { revalidatePath } from 'next/cache';
import { requireProject } from '@/lib/workspace';
import { logActivity } from '@/lib/activity';
import type { IllustrationMilestone, PageAnnotation, AnnotationStatus } from '@/lib/types';

export async function createIllustrationJob(bookId: string) {
  const { supabase, project, user } = await requireProject();

  const { data, error } = await supabase
    .from('illustration_jobs')
    .insert({ book_id: bookId, project_id: project.id })
    .select()
    .single();

  if (!error && data) {
    await logActivity(supabase, {
      projectId: project.id,
      userId: user.id,
      action: 'illustration_job.created',
      targetTable: 'illustration_jobs',
      targetId: data.id,
    });
  }

  revalidatePath(`/workspace/books/${bookId}/illustration`);
}

export async function updateJobMeta(jobId: string, bookId: string, formData: FormData) {
  const { supabase, project } = await requireProject();
  await supabase
    .from('illustration_jobs')
    .update({
      character_sheet: String(formData.get('character_sheet') || '') || null,
      setting_notes: String(formData.get('setting_notes') || '') || null,
      style_direction: String(formData.get('style_direction') || '') || null,
      reference_files: String(formData.get('reference_files') || '') || null,
    })
    .eq('id', jobId)
    .eq('project_id', project.id);
  revalidatePath(`/workspace/books/${bookId}/illustration`);
}

export async function assignIllustrator(jobId: string, bookId: string, illustratorId: string) {
  const { supabase, project } = await requireProject();
  await supabase
    .from('illustration_jobs')
    .update({ illustrator_id: illustratorId || null })
    .eq('id', jobId)
    .eq('project_id', project.id);
  revalidatePath(`/workspace/books/${bookId}/illustration`);
}

export async function updateMilestones(jobId: string, bookId: string, milestones: IllustrationMilestone[]) {
  const { supabase, project } = await requireProject();
  await supabase.from('illustration_jobs').update({ milestones }).eq('id', jobId).eq('project_id', project.id);
  revalidatePath(`/workspace/books/${bookId}/illustration`);
}

export async function updateAuthenticityChecklist(jobId: string, checklist: Record<string, boolean>) {
  const { supabase, project } = await requireProject();
  await supabase
    .from('illustration_jobs')
    .update({ authenticity_checklist: checklist })
    .eq('id', jobId)
    .eq('project_id', project.id);
}

export async function addIllustrationPage(jobId: string, bookId: string, formData: FormData) {
  const { supabase, project } = await requireProject();

  const { count } = await supabase
    .from('illustration_pages')
    .select('id', { count: 'exact', head: true })
    .eq('illustration_job_id', jobId);

  await supabase.from('illustration_pages').insert({
    illustration_job_id: jobId,
    project_id: project.id,
    page_number: (count ?? 0) + 1,
    file_reference: String(formData.get('file_reference') || '') || null,
    notes: String(formData.get('notes') || '') || null,
  });

  revalidatePath(`/workspace/books/${bookId}/illustration`);
}

export async function updatePageAnnotations(
  pageId: string,
  bookId: string,
  annotations: PageAnnotation[],
  status: AnnotationStatus
) {
  const { supabase, project } = await requireProject();
  await supabase
    .from('illustration_pages')
    .update({ annotations, annotation_status: status })
    .eq('id', pageId)
    .eq('project_id', project.id);
  revalidatePath(`/workspace/books/${bookId}/illustration`);
}
