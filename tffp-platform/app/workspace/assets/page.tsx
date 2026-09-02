import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import { createAsset } from '@/app/workspace/assets/actions';
import { AssetCard } from '@/components/workspace/AssetCard';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FileRefsField } from '@/components/workspace/FileRefsField';
import type { AssetCategory, IllustrationAsset } from '@/lib/types';

const CATEGORIES: { value: AssetCategory; label: string }[] = [
  { value: 'character', label: 'Characters' },
  { value: 'scene', label: 'Scenes' },
  { value: 'object', label: 'Objects' },
  { value: 'other', label: 'Other' },
];

export default async function AssetsPage() {
  const { supabase, project, role } = await requireProject();

  const [{ data: assetsData }, { data: linksData }] = await Promise.all([
    supabase
      .from('illustration_assets')
      .select('*')
      .eq('project_id', project.id)
      .order('name', { ascending: true })
      .returns<IllustrationAsset[]>(),
    supabase.from('book_assets').select('asset_id').eq('project_id', project.id),
  ]);

  const assets = assetsData ?? [];
  const usedCounts = new Map<string, number>();
  for (const link of linksData ?? []) {
    usedCounts.set(link.asset_id, (usedCounts.get(link.asset_id) ?? 0) + 1);
  }

  const writable = canWrite(role, 'assets');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl">Asset library</h1>
        <p className="text-sm text-ink/60">
          Characters, scenes, and objects that have been drawn and tagged — reusable across every
          book in this project instead of redrawn per book. Link them from a book&rsquo;s
          Illustration tab.
        </p>
      </div>

      {assets.length === 0 ? (
        <EmptyState title="No assets yet" description="Add the first character, scene, or object below." />
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const items = assets.filter((a) => a.category === cat.value);
            if (items.length === 0) return null;
            return (
              <div key={cat.value}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/50">
                  {cat.label} · {items.length}
                </h2>
                <div className="space-y-2">
                  {items.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      writable={writable}
                      usedInCount={usedCounts.get(asset.id) ?? 0}
                      projectId={project.id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {writable && (
        <Card>
          <CardHeader title="Add an asset" />
          <CardBody>
            <form action={createAsset} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category" htmlFor="category">
                  <Select id="category" name="category" defaultValue="character">
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Name" htmlFor="name">
                  <Input id="name" name="name" required placeholder="Ambi, the river, the woven basket…" />
                </Field>
              </div>
              <Field label="Description" htmlFor="description">
                <Textarea id="description" name="description" rows={2} />
              </Field>
              <Field label="Reference notes" htmlFor="reference_notes" hint="what makes this authentic — attire, materials, setting details">
                <Textarea id="reference_notes" name="reference_notes" rows={2} />
              </Field>
              <Field label="Artwork file references" htmlFor="artwork_file_references" hint="one link per line, or upload below — sketches, angles, final art, once they exist">
                <FileRefsField
                  id="artwork_file_references"
                  name="artwork_file_references"
                  projectId={project.id}
                  pathPrefix="asset-artwork"
                  accept="image/*"
                  rows={3}
                  placeholder="https://…&#10;https://…"
                />
              </Field>
              <Field label="Tags" htmlFor="tags" hint="comma-separated">
                <Input id="tags" name="tags" />
              </Field>
              <Button type="submit">Add asset</Button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
