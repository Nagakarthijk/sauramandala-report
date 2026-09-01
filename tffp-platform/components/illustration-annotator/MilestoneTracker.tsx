'use client';

import { useState } from 'react';
import { ILLUSTRATION_MILESTONE_NAMES } from '@/lib/types';
import type { IllustrationMilestone } from '@/lib/types';
import { updateMilestones } from '@/app/workspace/books/[bookId]/illustration/actions';
import { Input } from '@/components/ui/Input';
import { cx } from '@/lib/utils';

const STATUS_OPTIONS: IllustrationMilestone['status'][] = ['not_started', 'in_progress', 'submitted', 'approved'];

function defaultMilestones(): IllustrationMilestone[] {
  return ILLUSTRATION_MILESTONE_NAMES.map((name) => ({
    name,
    due_date: null,
    status: 'not_started',
    submitted_at: null,
    approved_at: null,
  }));
}

export function MilestoneTracker({
  jobId,
  bookId,
  initialMilestones,
  writable,
}: {
  jobId: string;
  bookId: string;
  initialMilestones: IllustrationMilestone[];
  writable: boolean;
}) {
  const [milestones, setMilestones] = useState<IllustrationMilestone[]>(
    initialMilestones.length ? initialMilestones : defaultMilestones()
  );

  function update(index: number, patch: Partial<IllustrationMilestone>) {
    const next = milestones.map((m, i) => (i === index ? { ...m, ...patch } : m));
    setMilestones(next);
    updateMilestones(jobId, bookId, next);
  }

  return (
    <ol className="space-y-2">
      {milestones.map((m, i) => (
        <li key={m.name} className="flex flex-wrap items-center gap-3 rounded-md border border-ink/10 p-2 text-sm">
          <span className="w-32 font-medium capitalize">{m.name.replace(/_/g, ' ')}</span>
          <select
            className={cx(
              'rounded-md border border-ink/20 px-2 py-1 text-sm',
              m.status === 'approved' && 'bg-forest/10',
              m.status === 'submitted' && 'bg-turmeric/10'
            )}
            disabled={!writable}
            value={m.status}
            onChange={(e) => {
              const status = e.target.value as IllustrationMilestone['status'];
              update(i, {
                status,
                submitted_at: status === 'submitted' ? new Date().toISOString() : m.submitted_at,
                approved_at: status === 'approved' ? new Date().toISOString() : m.approved_at,
              });
            }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <Input
            type="date"
            className="w-40"
            disabled={!writable}
            value={m.due_date ?? ''}
            onChange={(e) => update(i, { due_date: e.target.value || null })}
          />
        </li>
      ))}
    </ol>
  );
}
