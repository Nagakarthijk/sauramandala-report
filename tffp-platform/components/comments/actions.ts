'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';

export async function postComment(params: {
  projectId: string;
  targetTable: string;
  targetId: string;
  parentId?: string | null;
  body: string;
  path: string;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !params.body.trim()) return;

  const { data, error } = await supabase
    .from('comments')
    .insert({
      project_id: params.projectId,
      author_id: user.id,
      target_table: params.targetTable,
      target_id: params.targetId,
      parent_id: params.parentId ?? null,
      body: params.body.trim(),
    })
    .select()
    .single();

  if (!error && data) {
    await logActivity(supabase, {
      projectId: params.projectId,
      userId: user.id,
      action: 'comment.posted',
      targetTable: params.targetTable,
      targetId: params.targetId,
    });
  }

  revalidatePath(params.path);
}

export async function resolveComment(commentId: string, resolved: boolean, path: string) {
  const supabase = createClient();
  await supabase.from('comments').update({ resolved }).eq('id', commentId);
  revalidatePath(path);
}
