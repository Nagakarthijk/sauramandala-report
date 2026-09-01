'use client';

import { useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { TranscriptSegment } from '@/lib/types';
import { SEGMENT_TAGS } from '@/lib/types';
import { updateSegment, setSegmentReviewed, deleteSegment } from '@/components/transcript-editor/actions';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';
import { Textarea, Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

const TAG_MARKERS: Record<(typeof SEGMENT_TAGS)[number], string> = {
  PAUSE: '[PAUSE]',
  LOCAL_TERM: '[LOCAL TERM: ]',
  LAUGHTER: '[LAUGHTER]',
  INAUDIBLE: '[INAUDIBLE]',
  LANG_SWITCH: '[SWITCHES TO ENGLISH]',
};

export function SegmentRow({
  segment,
  index,
  projectId,
  writable,
  onDeleted,
}: {
  segment: TranscriptSegment;
  index: number;
  projectId: string;
  writable: boolean;
  onDeleted: (id: string) => void;
}) {
  const pathname = usePathname();
  const sourceRef = useRef<HTMLTextAreaElement>(null);

  const [textSource, setTextSource] = useState(segment.text_source ?? '');
  const [textEnglish, setTextEnglish] = useState(segment.text_english ?? '');
  const [startMs, setStartMs] = useState(segment.start_time_ms?.toString() ?? '');
  const [endMs, setEndMs] = useState(segment.end_time_ms?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const reviewed = segment.reviewed;

  const debouncedSave = useDebouncedCallback(
    async (fields: Parameters<typeof updateSegment>[1]) => {
      setSaving(true);
      await updateSegment(segment.id, fields);
      setSaving(false);
    },
    600
  );

  function insertTag(marker: string) {
    const el = sourceRef.current;
    if (!el) return;
    const start = el.selectionStart ?? textSource.length;
    const end = el.selectionEnd ?? textSource.length;
    const next = textSource.slice(0, start) + marker + textSource.slice(end);
    setTextSource(next);
    debouncedSave({ text_source: next });
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + marker.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="grid grid-cols-2 gap-px bg-ink/10">
      <div className="space-y-1 bg-white p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink/40">Segment {index + 1}</span>
          {reviewed && <Badge color="forest">reviewed</Badge>}
        </div>
        <Textarea
          ref={sourceRef}
          rows={3}
          disabled={!writable || reviewed}
          value={textSource}
          onChange={(e) => {
            setTextSource(e.target.value);
            debouncedSave({ text_source: e.target.value });
          }}
          placeholder="Verbatim, source language…"
        />
        {writable && !reviewed && (
          <div className="flex flex-wrap gap-1 tag-mono">
            {SEGMENT_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => insertTag(TAG_MARKERS[tag])}
                className="rounded border border-ink/20 px-1.5 py-0.5 text-ink/60 hover:bg-ink/5"
              >
                {TAG_MARKERS[tag]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 bg-white p-3">
        <Textarea
          rows={3}
          disabled={!writable}
          value={textEnglish}
          onChange={(e) => {
            setTextEnglish(e.target.value);
            debouncedSave({ text_english: e.target.value });
          }}
          placeholder="English translation…"
        />
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="start ms"
            className="w-24"
            disabled={!writable}
            value={startMs}
            onChange={(e) => {
              setStartMs(e.target.value);
              debouncedSave({ start_time_ms: e.target.value ? Number(e.target.value) : null });
            }}
          />
          <Input
            type="number"
            placeholder="end ms"
            className="w-24"
            disabled={!writable}
            value={endMs}
            onChange={(e) => {
              setEndMs(e.target.value);
              debouncedSave({ end_time_ms: e.target.value ? Number(e.target.value) : null });
            }}
          />
          <span className="text-xs text-ink/30">{saving ? 'saving…' : ''}</span>
          {writable && (
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                className="text-xs text-forest hover:underline"
                onClick={() => setSegmentReviewed(segment.id, !reviewed, projectId, pathname)}
              >
                {reviewed ? 'Unmark reviewed' : 'Mark reviewed'}
              </button>
              <button
                type="button"
                className="text-xs text-rust hover:underline"
                onClick={async () => {
                  if (!confirm('Delete this segment?')) return;
                  await deleteSegment(segment.id, pathname);
                  onDeleted(segment.id);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
