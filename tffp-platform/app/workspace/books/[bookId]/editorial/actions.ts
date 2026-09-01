'use server';

import { revalidatePath } from 'next/cache';
import { requireProject } from '@/lib/workspace';
import { logActivity } from '@/lib/activity';
import type { EditorialVerdict } from '@/lib/types';

export async function createEditorialRound(bookId: string, manuscriptId: string, formData: FormData) {
  const { supabase, project, user } = await requireProject();

  const { data, error } = await supabase
    .from('editorial_rounds')
    .insert({
      manuscript_id: manuscriptId,
      project_id: project.id,
      reviewer_id: user.id,
      draft_number: Number(formData.get('draft_number') || 1),
      verdict: (String(formData.get('verdict') || '') || null) as EditorialVerdict | null,
      feedback_structural: String(formData.get('feedback_structural') || '') || null,
      feedback_cultural: String(formData.get('feedback_cultural') || '') || null,
      feedback_lines: String(formData.get('feedback_lines') || '') || null,
      what_works: String(formData.get('what_works') || '') || null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('create editorial round failed', error?.message);
    return;
  }

  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    action: 'editorial.round.recorded',
    targetTable: 'editorial_rounds',
    targetId: data.id,
    metadata: { verdict: data.verdict },
  });

  revalidatePath(`/workspace/books/${bookId}/editorial`);
}
