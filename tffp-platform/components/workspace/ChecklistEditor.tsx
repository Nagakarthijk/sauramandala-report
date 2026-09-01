'use client';

import { useState, useTransition } from 'react';

export function ChecklistEditor({
  title,
  items,
  initialValues,
  action,
  disabled,
}: {
  title?: string;
  items: ReadonlyArray<{ key: string; label: string }>;
  initialValues: Record<string, boolean>;
  action: (values: Record<string, boolean>) => Promise<void>;
  disabled?: boolean;
}) {
  const [values, setValues] = useState<Record<string, boolean>>(initialValues ?? {});
  const [isPending, startTransition] = useTransition();

  function toggle(key: string) {
    const next = { ...values, [key]: !values[key] };
    setValues(next);
    startTransition(() => {
      action(next);
    });
  }

  return (
    <div className="space-y-2">
      {title && <h3 className="text-sm font-medium text-ink/80">{title}</h3>}
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.key}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!values[item.key]}
                disabled={disabled}
                onChange={() => toggle(item.key)}
                className="h-4 w-4 rounded border-ink/30 text-forest focus:ring-forest/40"
              />
              {item.label}
            </label>
          </li>
        ))}
      </ul>
      {isPending && <p className="text-xs text-ink/30">Saving…</p>}
    </div>
  );
}
