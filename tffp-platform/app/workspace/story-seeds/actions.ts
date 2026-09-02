'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireProject } from '@/lib/workspace';
import { logActivity } from '@/lib/activity';
import { requestAiSuggestion } from '@/lib/integrations/ai';
import type { FilterOutcome, ReferenceResource } from '@/lib/types';

export async function createStorySeed(formData: FormData) {
  const { supabase, project, user } = await requireProject();

  const { data, error } = await supabase
    .from('story_seeds')
    .insert({
      project_id: project.id,
      created_by: user.id,
      working_title: String(formData.get('working_title') || '') || null,
      recording_id: String(formData.get('recording_id') || '') || null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('create story seed failed', error?.message);
    return;
  }

  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    action: 'story_seed.created',
    targetTable: 'story_seeds',
    targetId: data.id,
  });

  redirect(`/workspace/story-seeds/${data.id}`);
}

export async function updateCondensedText(seedId: string, condensed_text: string) {
  const { supabase, project } = await requireProject();
  await supabase.from('story_seeds').update({ condensed_text }).eq('id', seedId).eq('project_id', project.id);
}

export async function updateFilterChecklist(seedId: string, filter_checklist: Record<string, boolean>) {
  const { supabase, project } = await requireProject();
  await supabase.from('story_seeds').update({ filter_checklist }).eq('id', seedId).eq('project_id', project.id);
}

export async function updateFilterOutcome(seedId: string, formData: FormData) {
  const { supabase, project } = await requireProject();
  await supabase
    .from('story_seeds')
    .update({
      filter_outcome: (String(formData.get('filter_outcome') || '') || null) as FilterOutcome | null,
      filter_notes: String(formData.get('filter_notes') || '') || null,
    })
    .eq('id', seedId)
    .eq('project_id', project.id);
  revalidatePath(`/workspace/story-seeds/${seedId}`);
}

export async function updateReferenceResources(seedId: string, reference_resources: ReferenceResource[]) {
  const { supabase, project } = await requireProject();
  await supabase
    .from('story_seeds')
    .update({ reference_resources })
    .eq('id', seedId)
    .eq('project_id', project.id);
  revalidatePath(`/workspace/story-seeds/${seedId}`);
}

export async function promoteToBook(seedId: string) {
  const { supabase, project, user } = await requireProject();

  const { data: seed } = await supabase.from('story_seeds').select('*').eq('id', seedId).single();
  if (!seed) return;

  const { data: book, error } = await supabase
    .from('books')
    .insert({
      project_id: project.id,
      story_seed_id: seed.id,
      working_title: seed.working_title || 'Untitled book',
      author_id: user.id,
      status: 'concept',
      concept_note: { synopsis: seed.condensed_text || '' },
    })
    .select()
    .single();

  if (error || !book) {
    console.error('promote to book failed', error?.message);
    return;
  }

  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    action: 'book.created_from_seed',
    targetTable: 'books',
    targetId: book.id,
  });

  redirect(`/workspace/books/${book.id}/concept`);
}

// Optional AI assist — only reachable when the project has ai_enabled in
// settings (the button that calls this is hidden otherwise). Never
// persists anything; the caller shows the result in a modal and only
// saves what the human accepts, via updateCondensedText above.
export async function suggestCondensation(input: string): Promise<string> {
  const { project } = await requireProject();
  const provider = project.settings.ai_provider ?? 'anthropic';
  if (!project.settings.ai_enabled) throw new Error('AI assist is not enabled for this project');

  const apiKey =
    provider === 'anthropic'
      ? process.env.ANTHROPIC_API_KEY
      : provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : undefined;

  return requestAiSuggestion({ provider, apiKey, task: 'condense', input });
}
