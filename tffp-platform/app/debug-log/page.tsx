// TEMPORARY diagnostic page — reads debug_log via the service-role
// client (bypasses RLS, and this route itself needs no auth so it
// can't fail for the same reasons the crash we're chasing might).
// Delete this route once the crash is found and fixed.
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function DebugLogPage() {
  let rows: { id: string; created_at: string; context: string; message: string | null; detail: Record<string, unknown> | null }[] = [];
  let loadError: string | null = null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('debug_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) loadError = error.message;
    else rows = data ?? [];
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6 font-mono text-xs">
      <h1 className="font-sans text-xl font-bold">Debug log (temporary)</h1>
      <p className="font-sans text-sm text-ink/60">
        Most recent 100 entries, newest first. This page and the debug_log
        table should be deleted once the crash is diagnosed.
      </p>
      {loadError && <p className="text-rust">Failed to load debug_log: {loadError}</p>}
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded border border-ink/10 bg-white p-2">
            <div className="font-sans">
              <span className="font-semibold">{row.context}</span> — {row.message}
              <span className="ml-2 text-ink/40">{row.created_at}</span>
            </div>
            {row.detail && Object.keys(row.detail as object).length > 0 && (
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-ink/60">
                {JSON.stringify(row.detail, null, 2)}
              </pre>
            )}
          </div>
        ))}
        {rows.length === 0 && !loadError && <p className="font-sans text-ink/50">No entries yet.</p>}
      </div>
    </div>
  );
}
