'use server';

import { revalidatePath } from 'next/cache';
import { requireProject } from '@/lib/workspace';
import { logActivity } from '@/lib/activity';
import { requestAiSuggestion } from '@/lib/integrations/ai';
import type { ManuscriptPage } from '@/lib/types';

export async function saveManuscriptVersion(
  bookId: string,
  nextVersion: number,
  pageData: ManuscriptPage[],
  layoutFormat: string
) {
  const { supabase, project, user } = await requireProject();

  const { data, error } = await supabase
    .from('manuscripts')
    .insert({
      book_id: bookId,
      project_id: project.id,
      created_by: user.id,
      version_number: nextVersion,
      page_data: pageData,
      layout_format: layoutFormat || null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('save manuscript version failed', error?.message);
    return null;
  }

  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    action: 'manuscript.version.saved',
    targetTable: 'manuscripts',
    targetId: data.id,
    metadata: { version_number: nextVersion },
  });

  revalidatePath(`/workspace/books/${bookId}/manuscript`);
  return data;
}

export async function lockManuscript(manuscriptId: string, bookId: string) {
  const { supabase, project, user } = await requireProject();

  await supabase
    .from('manuscripts')
    .update({ is_locked: true, locked_at: new Date().toISOString(), locked_by: user.id })
    .eq('id', manuscriptId)
    .eq('project_id', project.id);

  await supabase.from('books').update({ status: 'manuscript_locked' }).eq('id', bookId).eq('project_id', project.id);

  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    action: 'manuscript.locked',
    targetTable: 'manuscripts',
    targetId: manuscriptId,
  });

  revalidatePath(`/workspace/books/${bookId}/manuscript`);
}

export async function suggestIllustrationPrompt(pageText: string): Promise<string> {
  const { project } = await requireProject();
  if (!project.settings.ai_enabled) throw new Error('AI assist is not enabled for this project');
  const provider = project.settings.ai_provider ?? 'anthropic';
  const apiKey =
    provider === 'anthropic'
      ? process.env.ANTHROPIC_API_KEY
      : provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : undefined;
  return requestAiSuggestion({ provider, apiKey, task: 'illustration_prompt', input: pageText });
}
