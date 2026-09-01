import type { SupabaseClient } from '@supabase/supabase-js';

// Append-only audit trail. Call this alongside any meaningful write —
// RLS only grants insert/select on activity_log, never update/delete,
// so entries logged here can't be edited later.
export async function logActivity(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    userId: string | null | undefined;
    action: string;
    targetTable?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from('activity_log').insert({
    project_id: params.projectId,
    user_id: params.userId ?? null,
    action: params.action,
    target_table: params.targetTable ?? null,
    target_id: params.targetId ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    // Activity logging should never block the primary action it's
    // describing — surface it to the console and move on.
    console.error('activity log failed', params.action, error.message);
  }
}
