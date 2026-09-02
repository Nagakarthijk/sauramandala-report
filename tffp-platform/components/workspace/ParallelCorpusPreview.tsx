'use client';

import { useState } from 'react';
import type { TranscriptSegment } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';

export function ParallelCorpusPreview({ segments }: { segments: TranscriptSegment[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        className="text-sm font-medium text-forest hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▲ Hide' : '▼ Show'} source parallel corpus ({segments.length} segment
        {segments.length === 1 ? '' : 's'})
      </button>

      {open && (
        <div className="mt-3 max-h-96 overflow-y-auto rounded-md border border-ink/10">
          {segments.length === 0 ? (
            <p className="p-3 text-sm text-ink/50">No transcript segments recorded yet.</p>
          ) : (
            <div className="divide-y divide-ink/10">
              {segments.map((s, i) => (
                <div key={s.id} className="grid grid-cols-2 gap-px bg-ink/10">
                  <div className="bg-white p-2 text-sm">
                    <div className="mb-1 flex items-center gap-2 text-xs text-ink/40">
                      <span>#{i + 1}</span>
                      {s.reviewed && <Badge color="forest">reviewed</Badge>}
                    </div>
                    {s.text_source || <span className="text-ink/30">—</span>}
                  </div>
                  <div className="bg-white p-2 text-sm">
                    <div className="mb-1 text-xs text-ink/40">English</div>
                    {s.text_english || <span className="text-ink/30">—</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
