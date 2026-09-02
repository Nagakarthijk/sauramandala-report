'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function FileUploadButton({
  projectId,
  pathPrefix,
  accept,
  multiple = true,
  onUploaded,
}: {
  projectId: string;
  pathPrefix: string;
  accept?: string;
  multiple?: boolean;
  onUploaded: (urls: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `upload-${pathPrefix}`;

  async function handleFiles(files: FileList) {
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const urls: string[] = [];

    for (const file of Array.from(files)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `${projectId}/${pathPrefix}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('tffp-assets').upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
        continue;
      }
      const { data } = supabase.storage.from('tffp-assets').getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    setUploading(false);
    if (urls.length > 0) onUploaded(urls);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={(e) => e.target.files && e.target.files.length > 0 && handleFiles(e.target.files)}
        className="hidden"
        id={inputId}
      />
      <label
        htmlFor={inputId}
        className="cursor-pointer rounded-md border border-dashed border-ink/30 px-3 py-1.5 text-xs text-ink/60 hover:border-forest hover:text-forest"
      >
        {uploading ? 'Uploading…' : '⬆ Upload files'}
      </label>
      {error && <span className="text-xs text-rust">{error}</span>}
    </div>
  );
}
