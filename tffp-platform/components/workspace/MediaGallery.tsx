'use client';

import type { FieldVisitMedia } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const TYPE_COLOR: Record<string, 'forest' | 'turmeric' | 'rust' | 'indigo' | 'neutral'> = {
  photo: 'forest',
  video: 'rust',
  document: 'indigo',
  audio: 'turmeric',
  other: 'neutral',
};

export function MediaGallery({
  media,
  writable,
  addAction,
  deleteAction,
}: {
  media: FieldVisitMedia[];
  writable: boolean;
  addAction?: (formData: FormData) => void | Promise<void>;
  deleteAction?: (mediaId: string) => void | Promise<void>;
}) {
  return (
    <div className="space-y-3">
      {media.length === 0 ? (
        <p className="text-sm text-ink/50">No media tagged yet.</p>
      ) : (
        <ul className="space-y-2">
          {media.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 rounded-md border border-ink/10 p-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge color={TYPE_COLOR[m.media_type]}>{m.media_type}</Badge>
                  {m.caption && <span className="text-sm">{m.caption}</span>}
                </div>
                {m.file_reference && (
                  <a
                    href={m.file_reference}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-xs text-forest hover:underline"
                  >
                    {m.file_reference}
                  </a>
                )}
                {m.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.tags.map((tag) => (
                      <span key={tag} className="tag-mono rounded bg-ink/5 px-1.5 py-0.5 text-ink/50">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {writable && deleteAction && (
                <button
                  type="button"
                  className="shrink-0 text-xs text-rust hover:underline"
                  onClick={() => deleteAction(m.id)}
                >
                  remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {writable && addAction && (
        <form action={addAction} className="flex flex-wrap items-end gap-2 border-t border-ink/10 pt-3">
          <div className="w-28">
            <Field label="Type" htmlFor="media_type">
              <Select id="media_type" name="media_type" defaultValue="photo">
                <option value="photo">Photo</option>
                <option value="video">Video</option>
                <option value="document">Document</option>
                <option value="audio">Audio</option>
                <option value="other">Other</option>
              </Select>
            </Field>
          </div>
          <div className="flex-1">
            <Field label="File reference" htmlFor="file_reference" hint="URL, Drive link, or path">
              <Input id="file_reference" name="file_reference" placeholder="https://…" />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Caption" htmlFor="caption">
              <Input id="caption" name="caption" />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Tags" htmlFor="tags" hint="comma-separated">
              <Input id="tags" name="tags" placeholder="weaving, loom, market" />
            </Field>
          </div>
          <Button type="submit" size="sm">
            + Add
          </Button>
        </form>
      )}
    </div>
  );
}
