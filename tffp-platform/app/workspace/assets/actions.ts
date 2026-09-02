'use server';

import { revalidatePath } from 'next/cache';
import { requireProject } from '@/lib/workspace';
import { logActivity } from '@/lib/activity';
import { parseLines } from '@/lib/utils';
import type { AssetCategory } from '@/lib/types';

export async function createAsset(formData: FormData) {
  const { supabase, project, user } = await requireProject();

  const name = String(formData.get('name') || '').trim();
  if (!name) return;

  const tagsRaw = String(formData.get('tags') || '').trim();
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const artworkRaw = String(formData.get('artwork_file_references') || '');

  const { data, error } = await supabase
    .from('illustration_assets')
    .insert({
      project_id: project.id,
      created_by: user.id,
      category: String(formData.get('category') || 'character') as AssetCategory,
      name,
      description: String(formData.get('description') || '') || null,
      reference_notes: String(formData.get('reference_notes') || '') || null,
      artwork_file_references: parseLines(artworkRaw),
      tags,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('create asset failed', error?.message);
    return;
  }

  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    action: 'asset.created',
    targetTable: 'illustration_assets',
    targetId: data.id,
    metadata: { category: data.category },
  });

  revalidatePath('/workspace/assets');
}

export async function updateAsset(assetId: string, formData: FormData) {
  const { supabase, project } = await requireProject();

  const tagsRaw = String(formData.get('tags') || '').trim();
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const artworkRaw = String(formData.get('artwork_file_references') || '');

  await supabase
    .from('illustration_assets')
    .update({
      name: String(formData.get('name') || '').trim(),
      description: String(formData.get('description') || '') || null,
      reference_notes: String(formData.get('reference_notes') || '') || null,
      artwork_file_references: parseLines(artworkRaw),
      tags,
    })
    .eq('id', assetId)
    .eq('project_id', project.id);

  revalidatePath('/workspace/assets');
}

export async function deleteAsset(assetId: string) {
  const { supabase, project } = await requireProject();
  await supabase.from('illustration_assets').delete().eq('id', assetId).eq('project_id', project.id);
  revalidatePath('/workspace/assets');
}
