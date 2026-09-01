'use client';

import { useRef, useState } from 'react';
import type { PageAnnotation, IllustrationPage } from '@/lib/types';
import { updatePageAnnotations } from '@/app/workspace/books/[bookId]/illustration/actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

const CATEGORY_OPTIONS = ['object', 'clothing', 'setting', 'gesture', 'other'];

export function ImageAnnotator({
  page,
  bookId,
  writable,
}: {
  page: IllustrationPage;
  bookId: string;
  writable: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<PageAnnotation[]>(page.annotations ?? []);
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [pendingLabel, setPendingLabel] = useState<{ english: string; source: string; category: string }>({
    english: '',
    source: '',
    category: CATEGORY_OPTIONS[0],
  });
  const [saving, setSaving] = useState(false);

  function relativePos(e: React.MouseEvent) {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function onMouseDown(e: React.MouseEvent) {
    if (!writable) return;
    const pos = relativePos(e);
    setDragStart(pos);
    setDraft({ x: pos.x, y: pos.y, w: 0, h: 0 });
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragStart) return;
    const pos = relativePos(e);
    setDraft({
      x: Math.min(dragStart.x, pos.x),
      y: Math.min(dragStart.y, pos.y),
      w: Math.abs(pos.x - dragStart.x),
      h: Math.abs(pos.y - dragStart.y),
    });
  }

  function onMouseUp() {
    setDragStart(null);
    if (draft && draft.w > 0.01 && draft.h > 0.01) {
      // keep draft open for labelling
    } else {
      setDraft(null);
    }
  }

  function confirmAnnotation() {
    if (!draft) return;
    setAnnotations((prev) => [
      ...prev,
      {
        label_english: pendingLabel.english,
        label_source_language: pendingLabel.source,
        category: pendingLabel.category,
        bounding_box: draft,
      },
    ]);
    setDraft(null);
    setPendingLabel({ english: '', source: '', category: CATEGORY_OPTIONS[0] });
  }

  function removeAnnotation(index: number) {
    setAnnotations((prev) => prev.filter((_, i) => i !== index));
  }

  async function save(status: 'in_progress' | 'complete') {
    setSaving(true);
    await updatePageAnnotations(page.id, bookId, annotations, status);
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Page {page.page_number}</span>
        <Badge color={page.annotation_status === 'complete' ? 'forest' : page.annotation_status === 'in_progress' ? 'turmeric' : 'neutral'}>
          {page.annotation_status.replace('_', ' ')}
        </Badge>
      </div>

      {page.file_reference ? (
        <div
          ref={containerRef}
          className="relative w-full max-w-md select-none overflow-hidden rounded-md border border-ink/10 bg-ink/5"
          style={{ aspectRatio: '4 / 3' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={page.file_reference}
            alt={`Illustration page ${page.page_number}`}
            className="pointer-events-none h-full w-full object-contain"
          />
          {annotations.map((a, i) => (
            <div
              key={i}
              className="absolute border-2 border-rust bg-rust/10"
              style={{
                left: `${a.bounding_box.x * 100}%`,
                top: `${a.bounding_box.y * 100}%`,
                width: `${a.bounding_box.w * 100}%`,
                height: `${a.bounding_box.h * 100}%`,
              }}
              title={a.label_english}
            />
          ))}
          {draft && (
            <div
              className="absolute border-2 border-dashed border-indigo bg-indigo/10"
              style={{
                left: `${draft.x * 100}%`,
                top: `${draft.y * 100}%`,
                width: `${draft.w * 100}%`,
                height: `${draft.h * 100}%`,
              }}
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-ink/40">No image reference set for this page.</p>
      )}

      {draft && writable && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-ink/10 bg-white p-2">
          <Input
            placeholder="English label"
            value={pendingLabel.english}
            onChange={(e) => setPendingLabel((p) => ({ ...p, english: e.target.value }))}
            className="w-40"
          />
          <Input
            placeholder="Source-language label"
            value={pendingLabel.source}
            onChange={(e) => setPendingLabel((p) => ({ ...p, source: e.target.value }))}
            className="w-40"
          />
          <select
            className="rounded-md border border-ink/20 px-2 py-2 text-sm"
            value={pendingLabel.category}
            onChange={(e) => setPendingLabel((p) => ({ ...p, category: e.target.value }))}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Button size="sm" onClick={confirmAnnotation}>Add</Button>
          <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
        </div>
      )}

      {annotations.length > 0 && (
        <ul className="space-y-1 text-xs">
          {annotations.map((a, i) => (
            <li key={i} className="flex items-center justify-between rounded bg-ink/5 px-2 py-1">
              <span>
                <Badge color="indigo" className="mr-1">{a.category}</Badge>
                {a.label_english} {a.label_source_language ? `/ ${a.label_source_language}` : ''}
              </span>
              {writable && (
                <button className="text-rust hover:underline" onClick={() => removeAnnotation(i)}>
                  remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {writable && (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={saving} onClick={() => save('in_progress')}>
            Save draft
          </Button>
          <Button size="sm" disabled={saving} onClick={() => save('complete')}>
            Mark complete
          </Button>
        </div>
      )}
    </div>
  );
}
