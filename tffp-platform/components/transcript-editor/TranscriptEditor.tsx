'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Recording, TranscriptSegment } from '@/lib/types';
import { SegmentRow } from '@/components/transcript-editor/SegmentRow';
import { createSegment, markAllReviewed } from '@/components/transcript-editor/actions';
import { Button } from '@/components/ui/Button';
import { downloadTextFile } from '@/lib/corpus';

function segmentsToCsv(segments: TranscriptSegment[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    'segment_order',
    'text_source',
    'text_english',
    'start_time_ms',
    'end_time_ms',
    'tags',
    'reviewed',
  ];
  const rows = segments.map((s) => [
    s.segment_order,
    s.text_source ?? '',
    s.text_english ?? '',
    s.start_time_ms ?? '',
    s.end_time_ms ?? '',
    (s.tags ?? []).join('|'),
    s.reviewed ? 'true' : 'false',
  ]);
  return [header, ...rows].map((row) => row.map(esc).join(',')).join('\n');
}

export function TranscriptEditor({
  recording,
  initialSegments,
  projectId,
  writable,
}: {
  recording: Recording;
  initialSegments: TranscriptSegment[];
  projectId: string;
  writable: boolean;
}) {
  const pathname = usePathname();
  const [segments, setSegments] = useState(
    [...initialSegments].sort((a, b) => a.segment_order - b.segment_order)
  );
  const [adding, setAdding] = useState(false);

  async function addSegment() {
    setAdding(true);
    const nextOrder = segments.length ? segments[segments.length - 1].segment_order + 1 : 1;
    const created = await createSegment(recording.id, projectId, nextOrder);
    if (created) setSegments((prev) => [...prev, created as TranscriptSegment]);
    setAdding(false);
  }

  function handleDeleted(id: string) {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }

  const reviewedCount = segments.filter((s) => s.reviewed).length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-ink/10 bg-white p-4">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <span className="block text-xs text-ink/40">Speaker</span>
            {recording.speaker_name || '—'}
          </div>
          <div>
            <span className="block text-xs text-ink/40">Language</span>
            {recording.language_code || '—'} {recording.dialect_tag ? `(${recording.dialect_tag})` : ''}
          </div>
          <div>
            <span className="block text-xs text-ink/40">Duration</span>
            {recording.duration_seconds ? `${Math.round(recording.duration_seconds / 60)} min` : '—'}
          </div>
          <div>
            <span className="block text-xs text-ink/40">File</span>
            {recording.file_reference ? (
              <a href={recording.file_reference} target="_blank" rel="noreferrer" className="text-forest hover:underline">
                open audio ↗
              </a>
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 rounded-t-lg border border-b-0 border-ink/10 bg-ink/5 text-xs font-medium uppercase tracking-wide text-ink/50">
        <div className="p-2">Verbatim ({recording.language_code || 'source language'})</div>
        <div className="p-2">English translation</div>
      </div>

      <div className="divide-y divide-ink/10 overflow-hidden rounded-b-lg border border-t-0 border-ink/10">
        {segments.map((segment, i) => (
          <SegmentRow
            key={segment.id}
            segment={segment}
            index={i}
            projectId={projectId}
            writable={writable}
            onDeleted={handleDeleted}
          />
        ))}
        {segments.length === 0 && (
          <p className="bg-white p-6 text-center text-sm text-ink/50">
            No segments yet. Add the first one below and start typing.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {writable && (
          <Button variant="secondary" onClick={addSegment} disabled={adding}>
            {adding ? 'Adding…' : '+ Add segment'}
          </Button>
        )}
        {writable && (
          <Button
            variant="secondary"
            onClick={() => markAllReviewed(recording.id, projectId, pathname)}
          >
            Mark all as reviewed
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() =>
            downloadTextFile(`transcript-${recording.id}.csv`, segmentsToCsv(segments), 'text/csv')
          }
        >
          Export segments as CSV
        </Button>
        <span className="ml-auto text-sm text-ink/50">
          {reviewedCount} / {segments.length} segments reviewed
        </span>
      </div>
    </div>
  );
}
