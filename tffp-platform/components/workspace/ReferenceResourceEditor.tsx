'use client';

import { useState } from 'react';
import type { ReferenceResource, ResourceCategory } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const CATEGORY_COLOR: Record<ResourceCategory, 'forest' | 'turmeric' | 'indigo' | 'neutral'> = {
  visual: 'indigo',
  fact: 'forest',
  article: 'turmeric',
  other: 'neutral',
};

export function ReferenceResourceEditor({
  initialResources,
  writable,
  action,
}: {
  initialResources: ReferenceResource[];
  writable: boolean;
  action?: (resources: ReferenceResource[]) => void | Promise<void>;
}) {
  const [resources, setResources] = useState<ReferenceResource[]>(initialResources);
  const [draft, setDraft] = useState<ReferenceResource>({ title: '', url: '', category: 'visual', notes: '' });

  function add() {
    if (!draft.title.trim()) return;
    const next = [...resources, draft];
    setResources(next);
    action?.(next);
    setDraft({ title: '', url: '', category: 'visual', notes: '' });
  }

  function remove(index: number) {
    const next = resources.filter((_, i) => i !== index);
    setResources(next);
    action?.(next);
  }

  return (
    <div className="space-y-3">
      {resources.length === 0 ? (
        <p className="text-sm text-ink/50">No research resources tagged yet.</p>
      ) : (
        <ul className="space-y-2">
          {resources.map((r, i) => (
            <li key={i} className="flex items-start justify-between gap-3 rounded-md border border-ink/10 p-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge color={CATEGORY_COLOR[r.category]}>{r.category}</Badge>
                  <span className="text-sm font-medium">{r.title}</span>
                </div>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-forest hover:underline">
                    {r.url}
                  </a>
                )}
                {r.notes && <p className="text-xs text-ink/50">{r.notes}</p>}
              </div>
              {writable && (
                <button type="button" className="shrink-0 text-xs text-rust hover:underline" onClick={() => remove(i)}>
                  remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {writable && (
        <div className="flex flex-wrap items-end gap-2 border-t border-ink/10 pt-3">
          <div className="w-28">
            <Select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as ResourceCategory }))}>
              <option value="visual">Visual</option>
              <option value="fact">Fact</option>
              <option value="article">Article</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div className="flex-1">
            <Input placeholder="Title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          </div>
          <div className="flex-1">
            <Input placeholder="URL" value={draft.url} onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))} />
          </div>
          <div className="flex-1">
            <Input placeholder="Notes" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
          </div>
          <Button type="button" size="sm" onClick={add}>
            + Add
          </Button>
        </div>
      )}
    </div>
  );
}
