'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/Input';
import { FileUploadButton } from '@/components/workspace/FileUploadButton';

export function FileRefsField({
  id,
  name,
  projectId,
  pathPrefix,
  accept,
  rows = 4,
  placeholder,
  initialValue = '',
  hint,
  allowUpload = true,
}: {
  id: string;
  name: string;
  projectId: string;
  pathPrefix: string;
  accept?: string;
  rows?: number;
  placeholder?: string;
  initialValue?: string;
  hint?: string;
  allowUpload?: boolean;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <div className="space-y-1">
      <Textarea
        id={id}
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hint && <span className="text-xs text-ink/40">{hint}</span>}
        {allowUpload && (
          <FileUploadButton
            projectId={projectId}
            pathPrefix={pathPrefix}
            accept={accept}
            onUploaded={(urls) => setValue((prev) => [prev, ...urls].filter(Boolean).join('\n'))}
          />
        )}
      </div>
    </div>
  );
}
