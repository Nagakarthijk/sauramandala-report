// TEMPORARY diagnostic — writes straight to the debug_log table via the
// service-role client, bypassing RLS entirely, so it works even from
// code paths where the user's own session/auth might be the thing
// failing. Never let logging itself throw and take down whatever
// called it.
export async function debugLog(context: string, message: string, detail: Record<string, unknown> = {}) {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    await admin.from('debug_log').insert({ context, message, detail });
  } catch (err) {
    console.error('debugLog itself failed', context, message, err);
  }
}
