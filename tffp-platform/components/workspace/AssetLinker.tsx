'use client';

import type { IllustrationAsset } from '@/lib/types';
import { linkAsset, unlinkAsset } from '@/app/workspace/books/[bookId]/illustration/actions';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface LinkedAsset {
  bookAssetId: string;
  asset: IllustrationAsset;
}

export function AssetLinker({
  bookId,
  linked,
  available,
  writable,
}: {
  bookId: string;
  linked: LinkedAsset[];
  available: IllustrationAsset[];
  writable: boolean;
}) {
  return (
    <div className="space-y-3">
      {linked.length === 0 ? (
        <p className="text-sm text-ink/50">No assets linked yet.</p>
      ) : (
        <ul className="space-y-2">
          {linked.map(({ bookAssetId, asset }) => (
            <li key={bookAssetId} className="flex items-center justify-between rounded-md border border-ink/10 p-2">
              <div>
                <Badge color="indigo" className="mr-2">{asset.category}</Badge>
                <span className="text-sm font-medium">{asset.name}</span>
                {asset.artwork_file_reference && (
                  <a href={asset.artwork_file_reference} target="_blank" rel="noreferrer" className="ml-2 text-xs text-forest hover:underline">
                    view art ↗
                  </a>
                )}
              </div>
              {writable && (
                <button
                  type="button"
                  className="text-xs text-rust hover:underline"
                  onClick={() => unlinkAsset(bookAssetId, bookId)}
                >
                  unlink
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {writable && available.length > 0 && (
        <form action={linkAsset.bind(null, bookId)} className="flex items-end gap-2 border-t border-ink/10 pt-3">
          <div className="flex-1">
            <Select name="asset_id" defaultValue="">
              <option value="" disabled>
                Link an existing asset…
              </option>
              {available.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.category}] {a.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Link
          </Button>
        </form>
      )}
    </div>
  );
}
