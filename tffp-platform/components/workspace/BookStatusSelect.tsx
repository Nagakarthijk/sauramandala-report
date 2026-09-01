'use client';

import { useTransition } from 'react';
import { updateBookStatus } from '@/app/workspace/books/actions';
import { Select } from '@/components/ui/Input';
import type { BookStatus } from '@/lib/types';

const STATUSES: BookStatus[] = [
  'concept',
  'manuscript_draft',
  'manuscript_locked',
  'illustration',
  'translation',
  'readalong',
  'published',
];

export function BookStatusSelect({ bookId, status }: { bookId: string; status: BookStatus }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Select
        defaultValue={status}
        onChange={(e) => startTransition(() => updateBookStatus(bookId, e.target.value as BookStatus))}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, ' ')}
          </option>
        ))}
      </Select>
      {isPending && <span className="text-xs text-ink/30">saving…</span>}
    </div>
  );
}
