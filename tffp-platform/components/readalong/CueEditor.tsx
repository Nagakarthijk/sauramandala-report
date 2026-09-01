'use client';

import { useState } from 'react';
import type { Readalong, SlsCue, SyncStatus } from '@/lib/types';
import { updateCues, updateSyncStatus, updateReadalongMeta } from '@/app/workspace/books/[bookId]/readalong/actions';
import { buildSlsCsv } from '@/lib/integrations/storyweaver';
import { downloadTextFile } from '@/lib/corpus';
import { Button } from '@/components/ui/Button';
import { Input, Field, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

const STATUS_OPTIONS: SyncStatus[] = ['pending', 'in_progress', 'synced', 'error'];

function emptyCue(page: number): SlsCue {
  return { page, word: '', cue: 0, content: '', start_time_ms: 0 };
}

export function CueEditor({
  readalong,
  bookId,
  writable,
  swEnabled,
}: {
  readalong: Readalong;
  bookId: string;
  writable: boolean;
  swEnabled: boolean;
}) {
  const [cues, setCues] = useState<SlsCue[]>(readalong.sls_csv_data ?? []);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  function updateCue(index: number, patch: Partial<SlsCue>) {
    setCues((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeCue(index: number) {
    setCues((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    await updateCues(readalong.id, bookId, cues);
    setSaving(false);
  }

  const csv = buildSlsCsv(cues);

  return (
    <div className="rounded-lg border border-ink/10 bg-white">
      <button className="flex w-full items-center justify-between p-4 text-left" onClick={() => setOpen((v) => !v)}>
        <span className="font-medium">
          {readalong.language} {readalong.narrator ? `— ${readalong.narrator}` : ''}
        </span>
        <div className="flex items-center gap-2">
          <Badge color={readalong.sync_status === 'synced' ? 'forest' : readalong.sync_status === 'error' ? 'rust' : 'neutral'}>
            {readalong.sync_status}
          </Badge>
          <span className="text-xs text-ink/40">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-ink/10 p-4">
          <form action={updateReadalongMeta.bind(null, readalong.id, bookId)} className="grid grid-cols-2 gap-3">
            <Field label="Narrator" htmlFor={`narrator-${readalong.id}`}>
              <Input id={`narrator-${readalong.id}`} name="narrator" defaultValue={readalong.narrator ?? ''} disabled={!writable} />
            </Field>
            <Field label="Audio file reference" htmlFor={`audio-${readalong.id}`}>
              <Input id={`audio-${readalong.id}`} name="audio_file_reference" defaultValue={readalong.audio_file_reference ?? ''} disabled={!writable} />
            </Field>
            <div className="col-span-2">
              <Field label="Attribution file reference" htmlFor={`attr-${readalong.id}`} hint="optional">
                <Input id={`attr-${readalong.id}`} name="attribution_file_reference" defaultValue={readalong.attribution_file_reference ?? ''} disabled={!writable} />
              </Field>
            </div>
            {writable && <Button type="submit" size="sm" className="col-span-2 w-fit">Save</Button>}
          </form>

          {writable && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink/60">Sync status</span>
              <Select
                className="w-40"
                defaultValue={readalong.sync_status}
                onChange={(e) => updateSyncStatus(readalong.id, bookId, e.target.value as SyncStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-medium text-ink/80">Word-by-word cues</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-ink/40">
                    <th className="p-1">page</th>
                    <th className="p-1">word</th>
                    <th className="p-1">cue</th>
                    <th className="p-1">content</th>
                    <th className="p-1">start (ms)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cues.map((cue, i) => (
                    <tr key={i} className="border-t border-ink/5">
                      <td className="p-1"><Input type="number" className="w-16" disabled={!writable} value={cue.page} onChange={(e) => updateCue(i, { page: Number(e.target.value) })} /></td>
                      <td className="p-1"><Input className="w-28" disabled={!writable} value={cue.word} onChange={(e) => updateCue(i, { word: e.target.value })} /></td>
                      <td className="p-1"><Input type="number" className="w-16" disabled={!writable} value={cue.cue} onChange={(e) => updateCue(i, { cue: Number(e.target.value) })} /></td>
                      <td className="p-1"><Input className="w-40" disabled={!writable} value={cue.content} onChange={(e) => updateCue(i, { content: e.target.value })} /></td>
                      <td className="p-1"><Input type="number" className="w-24" disabled={!writable} value={cue.start_time_ms} onChange={(e) => updateCue(i, { start_time_ms: Number(e.target.value) })} /></td>
                      <td className="p-1">
                        {writable && (
                          <button className="text-xs text-rust hover:underline" onClick={() => removeCue(i)}>remove</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {writable && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setCues((prev) => [...prev, emptyCue(prev.at(-1)?.page ?? 1)])}>
                  + Add cue
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save cues'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => downloadTextFile(`readalong-${readalong.language}.csv`, csv, 'text/csv')}
                >
                  Export SLS CSV
                </Button>
                {swEnabled && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => downloadTextFile(`storyweaver-sls-${readalong.language}.csv`, csv, 'text/csv')}
                  >
                    Download for StoryWeaver Content Manager
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
