'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export function AiSuggestButton({
  label = 'Suggest',
  getSuggestion,
  onAccept,
}: {
  label?: string;
  getSuggestion: () => Promise<string>;
  onAccept: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      setSuggestion(await getSuggestion());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suggestion failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={run}>
        ✨ {label}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-lg bg-white p-5 shadow-lg">
            <h3 className="font-heading text-lg">AI suggestion</h3>
            {loading && <p className="text-sm text-ink/50">Thinking…</p>}
            {error && <p className="text-sm text-rust">{error}</p>}
            {!loading && !error && (
              <p className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md bg-ink/5 p-3 text-sm">
                {suggestion}
              </p>
            )}
            <p className="text-xs text-ink/40">
              Nothing is saved unless you accept it below — edit freely first.
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Dismiss
              </Button>
              <Button
                size="sm"
                disabled={loading || !!error}
                onClick={() => {
                  onAccept(suggestion);
                  setOpen(false);
                }}
              >
                Use this
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
