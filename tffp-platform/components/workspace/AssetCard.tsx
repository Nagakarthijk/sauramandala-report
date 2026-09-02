'use client';

import { useState } from 'react';
import type { IllustrationAsset } from '@/lib/types';
import { updateAsset, deleteAsset } from '@/app/workspace/assets/actions';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FileRefsField } from '@/components/workspace/FileRefsField';
import { looksLikeImageUrl } from '@/lib/utils';

function ArtworkThumb({ url }: { url: string }) {
  if (looksLikeImageUrl(url)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-16 w-16 rounded object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return <div className="flex h-16 w-16 items-center justify-center rounded bg-ink/5 text-xl">🎨</div>;
}

export function AssetCard({
  asset,
  writable,
  usedInCount,
  projectId,
}: {
  asset: IllustrationAsset;
  writable: boolean;
  usedInCount: number;
  projectId: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <form
        action={async (formData) => {
          await updateAsset(asset.id, formData);
          setEditing(false);
        }}
        className="space-y-2 rounded-md border border-ink/10 bg-white p-3"
      >
        <Field label="Name" htmlFor={`name-${asset.id}`}>
          <Input id={`name-${asset.id}`} name="name" defaultValue={asset.name} required />
        </Field>
        <Field label="Description" htmlFor={`desc-${asset.id}`}>
          <Textarea id={`desc-${asset.id}`} name="description" rows={2} defaultValue={asset.description ?? ''} />
        </Field>
        <Field label="Reference notes" htmlFor={`notes-${asset.id}`}>
          <Textarea id={`notes-${asset.id}`} name="reference_notes" rows={2} defaultValue={asset.reference_notes ?? ''} />
        </Field>
        <Field label="Artwork file references" htmlFor={`art-${asset.id}`} hint="one link per line, or upload below — sketches, angles, final art, all of it">
          <FileRefsField
            id={`art-${asset.id}`}
            name="artwork_file_references"
            projectId={projectId}
            pathPrefix="asset-artwork"
            accept="image/*"
            rows={4}
            initialValue={asset.artwork_file_references.join('\n')}
            placeholder="https://…&#10;https://…"
          />
        </Field>
        <Field label="Tags" htmlFor={`tags-${asset.id}`} hint="comma-separated">
          <Input id={`tags-${asset.id}`} name="tags" defaultValue={asset.tags.join(', ')} />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" size="sm">Save</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-md border border-ink/10 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{asset.name}</span>
            {usedInCount > 0 && <Badge color="forest">used in {usedInCount} book{usedInCount === 1 ? '' : 's'}</Badge>}
          </div>
          {asset.description && <p className="text-sm text-ink/70">{asset.description}</p>}

          {asset.artwork_file_references.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {asset.artwork_file_references.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" title={url}>
                  <ArtworkThumb url={url} />
                </a>
              ))}
            </div>
          )}

          {asset.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {asset.tags.map((tag) => (
                <span key={tag} className="tag-mono rounded bg-ink/5 px-1.5 py-0.5 text-ink/50">{tag}</span>
              ))}
            </div>
          )}
        </div>
        {writable && (
          <div className="flex shrink-0 gap-2 text-xs">
            <button type="button" className="text-forest hover:underline" onClick={() => setEditing(true)}>edit</button>
            <button type="button" className="text-rust hover:underline" onClick={() => deleteAsset(asset.id)}>delete</button>
          </div>
        )}
      </div>
    </div>
  );
}
