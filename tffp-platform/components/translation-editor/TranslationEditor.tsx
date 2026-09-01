'use client';

import { useState } from 'react';
import type { ManuscriptPage, TermToPreserve, Translation, TranslationStatus } from '@/lib/types';
import {
  updateTranslationPageData,
  updateTermsToPreserve,
  updateTranslationStatus,
} from '@/app/workspace/books/[bookId]/translations/actions';
import { Textarea, Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const STATUS_OPTIONS: TranslationStatus[] = ['assigned', 'in_progress', 'review', 'approved'];

export function TranslationEditor({
  translation,
  bookId,
  englishPages,
  writable,
}: {
  translation: Translation;
  bookId: string;
  englishPages: ManuscriptPage[];
  writable: boolean;
}) {
  const [pages, setPages] = useState<ManuscriptPage[]>(translation.page_data);
  const [terms, setTerms] = useState<TermToPreserve[]>(translation.terms_to_preserve);
  const [newTerm, setNewTerm] = useState('');
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  function updatePageText(index: number, text: string) {
    setPages((prev) => prev.map((p, i) => (i === index ? { ...p, text } : p)));
  }

  async function save() {
    setSaving(true);
    await updateTranslationPageData(translation.id, bookId, pages);
    setSaving(false);
  }

  function addTerm() {
    if (!newTerm.trim()) return;
    const next = [...terms, { term: newTerm.trim(), reason: newReason.trim() }];
    setTerms(next);
    updateTermsToPreserve(translation.id, bookId, next);
    setNewTerm('');
    setNewReason('');
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-white">
      <button
        className="flex w-full items-center justify-between p-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-medium">
          {translation.target_language}
          {translation.target_language_code ? ` (${translation.target_language_code})` : ''}
        </span>
        <div className="flex items-center gap-2">
          <Badge color={translation.status === 'approved' ? 'forest' : 'neutral'}>{translation.status}</Badge>
          <span className="text-xs text-ink/40">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-ink/10 p-4">
          {writable && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink/60">Status</span>
              <Select
                className="w-40"
                defaultValue={translation.status}
                onChange={(e) => updateTranslationStatus(translation.id, bookId, e.target.value as TranslationStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <h4 className="mb-1 text-sm font-medium text-ink/80">Terms to preserve untranslated</h4>
            <ul className="mb-2 space-y-1 text-sm">
              {terms.map((t, i) => (
                <li key={i} className="text-ink/70">
                  <span className="font-medium">{t.term}</span>
                  {t.reason ? ` — ${t.reason}` : ''}
                </li>
              ))}
            </ul>
            {writable && (
              <div className="flex gap-2">
                <Input placeholder="term" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} className="w-32" />
                <Input placeholder="reason" value={newReason} onChange={(e) => setNewReason(e.target.value)} className="flex-1" />
                <Button size="sm" variant="secondary" onClick={addTerm} type="button">Add</Button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {pages.map((page, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 rounded-md border border-ink/10 p-3">
                <div>
                  <span className="mb-1 block text-xs text-ink/40">{page.label || `Page ${i + 1}`} (English)</span>
                  <p className="text-sm text-ink/60">{englishPages[i]?.text || '—'}</p>
                </div>
                <div>
                  <span className="mb-1 block text-xs text-ink/40">{translation.target_language}</span>
                  <Textarea
                    rows={2}
                    disabled={!writable}
                    value={page.text}
                    onChange={(e) => updatePageText(i, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          {writable && (
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save translation'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
