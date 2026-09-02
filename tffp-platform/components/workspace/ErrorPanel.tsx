// Renders a Supabase/Postgres error inline instead of letting it bubble
// into Next's generic "server-side exception" page, which strips the
// real message before it reaches the browser. TEMPORARY — once
// production issues stop surfacing this way, these call sites can go
// back to trusting the normal error boundary.
export function ErrorPanel({ label, error }: { label: string; error: { message: string; code?: string; details?: string; hint?: string } }) {
  return (
    <div className="mx-auto max-w-2xl space-y-2 rounded-md border border-rust/30 bg-rust/5 p-4 text-sm">
      <p className="font-medium text-rust">Error {label}</p>
      <p><span className="font-medium">message:</span> {error.message}</p>
      {error.code && <p><span className="font-medium">code:</span> {error.code}</p>}
      {error.details && <p><span className="font-medium">details:</span> {error.details}</p>}
      {error.hint && <p><span className="font-medium">hint:</span> {error.hint}</p>}
    </div>
  );
}
