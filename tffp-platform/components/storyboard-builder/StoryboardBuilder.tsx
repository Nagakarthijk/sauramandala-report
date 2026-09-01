'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ManuscriptPage } from '@/lib/types';
import { PageEditor } from '@/components/storyboard-builder/PageEditor';
import { saveManuscriptVersion, lockManuscript } from '@/app/workspace/books/[bookId]/manuscript/actions';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';

function emptyPage(pageNum: number): ManuscriptPage {
  return { page_num: pageNum, label: '', layout: '', text: '', illustration_prompt: '', editor_notes: '' };
}

export function StoryboardBuilder({
  bookId,
  nextVersion,
  initialPages,
  initialLayoutFormat,
  writable,
  aiEnabled,
  currentManuscriptId,
  isLocked,
}: {
  bookId: string;
  nextVersion: number;
  initialPages: ManuscriptPage[];
  initialLayoutFormat: string;
  writable: boolean;
  aiEnabled: boolean;
  currentManuscriptId: string | null;
  isLocked: boolean;
}) {
  const router = useRouter();
  const [pages, setPages] = useState<ManuscriptPage[]>(
    initialPages.length ? initialPages : [emptyPage(1)]
  );
  const [layoutFormat, setLayoutFormat] = useState(initialLayoutFormat);
  const [saving, setSaving] = useState(false);

  function updatePage(index: number, next: ManuscriptPage) {
    setPages((prev) => prev.map((p, i) => (i === index ? next : p)));
  }

  function removePage(index: number) {
    setPages((prev) => prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, page_num: i + 1 })));
  }

  function movePage(index: number, direction: -1 | 1) {
    setPages((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((p, i) => ({ ...p, page_num: i + 1 }));
    });
  }

  function addPage() {
    setPages((prev) => [...prev, emptyPage(prev.length + 1)]);
  }

  async function handleSave() {
    setSaving(true);
    await saveManuscriptVersion(bookId, nextVersion, pages, layoutFormat);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {isLocked && (
        <div className="rounded-md bg-indigo/10 p-3 text-sm text-indigo">
          The current version (v{nextVersion - 1}) is locked. Saving here creates v{nextVersion} unlocked,
          seeded from the locked draft.
        </div>
      )}

      <Field label="Layout format" htmlFor="layout_format" hint="e.g. a5_portrait, sw_landscape_spread — free text">
        <Input
          id="layout_format"
          disabled={!writable}
          value={layoutFormat}
          onChange={(e) => setLayoutFormat(e.target.value)}
          className="max-w-xs"
        />
      </Field>

      <div className="space-y-3">
        {pages.map((page, i) => (
          <PageEditor
            key={i}
            page={page}
            index={i}
            writable={writable}
            aiEnabled={aiEnabled}
            onChange={(next) => updatePage(i, next)}
            onRemove={() => removePage(i)}
            onMove={(dir) => movePage(i, dir)}
          />
        ))}
      </div>

      {writable && (
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={addPage}>
            + Add page
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : `Save as v${nextVersion}`}
          </Button>
          {currentManuscriptId && !isLocked && (
            <Button
              variant="secondary"
              onClick={async () => {
                await lockManuscript(currentManuscriptId, bookId);
                router.refresh();
              }}
            >
              Lock v{nextVersion - 1}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
