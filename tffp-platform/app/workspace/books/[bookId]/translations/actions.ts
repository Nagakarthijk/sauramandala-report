'use server';

import { revalidatePath } from 'next/cache';
import { requireProject } from '@/lib/workspace';
import { logActivity } from '@/lib/activity';
import type { ManuscriptPage, TermToPreserve, TranslationStatus } from '@/lib/types';

export async function createTranslation(bookId: string, formData: FormData) {
  const { supabase, project, user } = await requireProject();

  const targetLanguage = String(formData.get('target_language') || '').trim();
  if (!targetLanguage) return;

  const { data: manuscript } = await supabase
    .from('manuscripts')
    .select('page_data')
    .eq('book_id', bookId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const seededPages: ManuscriptPage[] = (manuscript?.page_data ?? []).map((p: ManuscriptPage) => ({
    ...p,
    text: '',
  }));

  const { data, error } = await supabase
    .from('translations')
    .insert({
      book_id: bookId,
      project_id: project.id,
      target_language: targetLanguage,
      target_language_code: String(formData.get('target_language_code') || '') || null,
      page_data: seededPages,
    })
    .select()
    .single();

  if (!error && data) {
    await logActivity(supabase, {
      projectId: project.id,
      userId: user.id,
      action: 'translation.assigned',
      targetTable: 'translations',
      targetId: data.id,
      metadata: { target_language: targetLanguage },
    });
  }

  revalidatePath(`/workspace/books/${bookId}/translations`);
}

export async function updateTranslationPageData(translationId: string, bookId: string, pageData: ManuscriptPage[]) {
  const { supabase, project } = await requireProject();
  await supabase.from('translations').update({ page_data: pageData }).eq('id', translationId).eq('project_id', project.id);
  revalidatePath(`/workspace/books/${bookId}/translations`);
}

export async function updateTermsToPreserve(translationId: string, bookId: string, terms: TermToPreserve[]) {
  const { supabase, project } = await requireProject();
  await supabase.from('translations').update({ terms_to_preserve: terms }).eq('id', translationId).eq('project_id', project.id);
  revalidatePath(`/workspace/books/${bookId}/translations`);
}

export async function updateTranslationStatus(translationId: string, bookId: string, status: TranslationStatus) {
  const { supabase, project, user } = await requireProject();
  await supabase.from('translations').update({ status }).eq('id', translationId).eq('project_id', project.id);
  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    action: 'translation.status.changed',
    targetTable: 'translations',
    targetId: translationId,
    metadata: { status },
  });
  revalidatePath(`/workspace/books/${bookId}/translations`);
}
