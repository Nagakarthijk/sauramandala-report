'use client';

import { useState } from 'react';
import type { FieldVisitMedia, MediaType } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FileRefsField } from '@/components/workspace/FileRefsField';
import { looksLikeImageUrl } from '@/lib/utils';

const TYPE_COLOR: Record<MediaType, 'forest' | 'turmeric' | 'rust' | 'indigo' | 'neutral'> = {
  photo: 'forest',
  video: 'rust',
  document: 'indigo',
  audio: 'turmeric',
  folder: 'indigo',
  other: 'neutral',
};

const TYPE_ICON: Record<MediaType, string> = {
  photo: '🖼️',
  video: '🎬',
  document: '📄',
  audio: '🎙️',
  folder: '📁',
  other: '📎',
};

function MediaThumb({ item }: { item: FieldVisitMedia }) {
  if (item.media_type === 'photo' && looksLikeImageUrl(item.file_reference)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.file_reference!}
        alt={item.caption || 'field media'}
        className="h-32 w-full rounded-t-md object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <div className="flex h-32 w-full items-center justify-center rounded-t-md bg-ink/5 text-3xl">
      {TYPE_ICON[item.media_type]}
    </div>
  );
}

export function MediaGallery({
  media,
  writable,
  projectId,
  addAction,
  deleteAction,
}: {
  media: FieldVisitMedia[];
  writable: boolean;
  projectId?: string;
  addAction?: (formData: FormData) => void | Promise<void>;
  deleteAction?: (mediaId: string) => void | Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [mediaType, setMediaType] = useState<MediaType>('photo');

  return (
    <div className="space-y-3">
      {media.length === 0 ? (
        <p className="text-sm text-ink/50">No media tagged yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {media.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-md border border-ink/10 bg-white">
              {m.file_reference ? (
                <a href={m.file_reference} target="_blank" rel="noreferrer">
                  <MediaThumb item={m} />
                </a>
              ) : (
                <MediaThumb item={m} />
              )}
              <div className="p-2">
                <div className="mb-1 flex items-center justify-between gap-1">
                  <Badge color={TYPE_COLOR[m.media_type]}>{m.media_type}</Badge>
                  {writable && deleteAction && (
                    <button
                      type="button"
                      className="text-xs text-rust hover:underline"
                      onClick={() => deleteAction(m.id)}
                    >
                      remove
                    </button>
                  )}
                </div>
                {m.caption && <p className="truncate text-xs">{m.caption}</p>}
                {m.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.tags.map((tag) => (
                      <span key={tag} className="tag-mono rounded bg-ink/5 px-1 py-0.5 text-[10px] text-ink/50">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {writable && addAction && (
        <div>
          {!adding ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(true)}>
              + Add files
            </Button>
          ) : (
            <form
              action={async (formData) => {
                await addAction(formData);
                setAdding(false);
                setMediaType('photo');
              }}
              className="space-y-2 rounded-md border border-ink/10 bg-white p-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type" htmlFor="media_type">
                  <Select
                    id="media_type"
                    name="media_type"
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value as MediaType)}
                  >
                    <option value="photo">Photo</option>
                    <option value="video">Video</option>
                    <option value="document">Document</option>
                    <option value="audio">Audio</option>
                    <option value="folder">Folder (a batch of files)</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>
                <Field label="Tags" htmlFor="tags" hint="comma-separated, applies to all">
                  <Input id="tags" name="tags" placeholder="weaving, loom, market" />
                </Field>
              </div>
              <Field
                label={mediaType === 'folder' ? 'Folder link' : 'File links'}
                htmlFor="file_reference"
                hint={
                  mediaType === 'folder'
                    ? 'One Drive/Dropbox/etc folder link representing the whole batch'
                    : mediaType === 'video' || mediaType === 'audio'
                      ? 'One per line — paste Drive links or any URL (in-app upload for video/audio is coming)'
                      : 'One per line, or upload below — mix and match freely'
                }
              >
                {projectId && (mediaType === 'photo' || mediaType === 'document' || mediaType === 'other') ? (
                  <FileRefsField
                    key={mediaType}
                    id="file_reference"
                    name="file_reference"
                    projectId={projectId}
                    pathPrefix="field-media"
                    accept={mediaType === 'photo' ? 'image/*' : undefined}
                    rows={4}
                    placeholder="https://…&#10;https://…"
                  />
                ) : (
                  <Textarea
                    id="file_reference"
                    name="file_reference"
                    rows={mediaType === 'folder' ? 1 : 4}
                    placeholder={mediaType === 'folder' ? 'https://drive.google.com/drive/folders/…' : 'https://…\nhttps://…\nhttps://…'}
                  />
                )}
              </Field>
              <Field label="Caption" htmlFor="caption" hint="applies to all, if set">
                <Input id="caption" name="caption" />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" size="sm">Add</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
