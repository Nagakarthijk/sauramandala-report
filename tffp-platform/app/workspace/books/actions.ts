'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { logActivity } from '@/lib/activity';
import type { BookStatus, ConceptNote } from '@/lib/types';

export async function createBookDirect(formData: FormData) {
  const { supabase, project, user } = await requireProject();

  const workingTitle = String(formData.get('working_title') || '').trim();
  if (!workingTitle) return;

  const { data, error } = await supabase
    .from('books')
    .insert({ project_id: project.id, working_title: workingTitle, author_id: user.id, status: 'concept' })
    .select()
    .single();

  if (error || !data) {
    console.error('create book failed', error?.message);
    return;
  }

  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    action: 'book.created',
    targetTable: 'books',
    targetId: data.id,
  });

  redirect(`/workspace/books/${data.id}/concept`);
}

export async function updateBookStatus(bookId: string, status: BookStatus) {
  const { supabase, project, user } = await requireProject();
  await supabase.from('books').update({ status }).eq('id', bookId).eq('project_id', project.id);
  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    action: 'book.status.changed',
    targetTable: 'books',
    targetId: bookId,
    metadata: { status },
  });
  revalidatePath('/workspace/books');
  revalidatePath(`/workspace/books/${bookId}/concept`);
}

export async function updateConceptNote(bookId: string, note: ConceptNote) {
  const { supabase, project } = await requireProject();
  await supabase.from('books').update({ concept_note: note }).eq('id', bookId).eq('project_id', project.id);
}

export async function updateBookMeta(bookId: string, formData: FormData) {
  const { supabase, project } = await requireProject();
  const readingLevel = String(formData.get('reading_level') || '');
  await supabase
    .from('books')
    .update({
      working_title: String(formData.get('working_title') || '') || undefined,
      reading_level: readingLevel ? Number(readingLevel) : null,
      published_url: String(formData.get('published_url') || '') || null,
    })
    .eq('id', bookId)
    .eq('project_id', project.id);
  revalidatePath(`/workspace/books/${bookId}/concept`);
}
