'use client';

import { useState } from 'react';
import type { Credit } from '@/lib/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function CreditsEditor({
  initialCredits,
  writable,
  action,
}: {
  initialCredits: Credit[];
  writable: boolean;
  action: (credits: Credit[]) => void | Promise<void>;
}) {
  const [credits, setCredits] = useState<Credit[]>(initialCredits);
  const [draft, setDraft] = useState<Credit>({ role: '', name: '' });

  function add() {
    if (!draft.role.trim() || !draft.name.trim()) return;
    const next = [...credits, draft];
    setCredits(next);
    action(next);
    setDraft({ role: '', name: '' });
  }

  function remove(index: number) {
    const next = credits.filter((_, i) => i !== index);
    setCredits(next);
    action(next);
  }

  return (
    <div className="space-y-2">
      {credits.length === 0 ? (
        <p className="text-sm text-ink/50">No credits added yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {credits.map((c, i) => (
            <li key={i} className="flex items-center justify-between">
              <span><span className="font-medium">{c.role}</span> — {c.name}</span>
              {writable && (
                <button type="button" className="text-xs text-rust hover:underline" onClick={() => remove(i)}>
                  remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {writable && (
        <div className="flex items-end gap-2 border-t border-ink/10 pt-2">
          <Input placeholder="Role (e.g. Illustrator)" value={draft.role} onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))} className="w-40" />
          <Input placeholder="Name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="flex-1" />
          <Button type="button" size="sm" onClick={add}>+ Add</Button>
        </div>
      )}
    </div>
  );
}
