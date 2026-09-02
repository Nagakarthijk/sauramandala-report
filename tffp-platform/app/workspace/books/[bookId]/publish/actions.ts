'use server';

import { revalidatePath } from 'next/cache';
import { requireProject } from '@/lib/workspace';
import type { Credit } from '@/lib/types';

export async function updatePublicationMeta(bookId: string, formData: FormData) {
  const { supabase, project } = await requireProject();

  const { data: book } = await supabase.from('books').select('publication_meta').eq('id', bookId).single();
  const current = book?.publication_meta ?? {};

  await supabase
    .from('books')
    .update({
      publication_meta: {
        ...current,
        isbn: String(formData.get('isbn') || '') || null,
        print_notes: String(formData.get('print_notes') || '') || null,
      },
    })
    .eq('id', bookId)
    .eq('project_id', project.id);

  revalidatePath(`/workspace/books/${bookId}/publish`);
}

export async function updateCredits(bookId: string, credits: Credit[]) {
  const { supabase, project } = await requireProject();

  const { data: book } = await supabase.from('books').select('publication_meta').eq('id', bookId).single();
  const current = book?.publication_meta ?? {};

  await supabase
    .from('books')
    .update({ publication_meta: { ...current, credits } })
    .eq('id', bookId)
    .eq('project_id', project.id);

  revalidatePath(`/workspace/books/${bookId}/publish`);
}
