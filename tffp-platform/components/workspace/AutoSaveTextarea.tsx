'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/Input';

export function AutoSaveTextarea({
  initialValue,
  action,
  rows = 4,
  placeholder,
  disabled,
}: {
  initialValue: string;
  action: (value: string) => Promise<void>;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [saved, setSaved] = useState(true);

  return (
    <div>
      <Textarea
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        onBlur={async () => {
          if (saved) return;
          await action(value);
          setSaved(true);
        }}
      />
      <p className="mt-1 text-xs text-ink/30">{saved ? 'Saved' : 'Unsaved changes — saves on blur'}</p>
    </div>
  );
}
