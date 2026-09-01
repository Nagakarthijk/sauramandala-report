'use client';

import type { ManuscriptPage } from '@/lib/types';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { AiSuggestButton } from '@/components/workspace/AiSuggestButton';
import { suggestIllustrationPrompt } from '@/app/workspace/books/[bookId]/manuscript/actions';

export function PageEditor({
  page,
  index,
  writable,
  aiEnabled,
  onChange,
  onRemove,
  onMove,
}: {
  page: ManuscriptPage;
  index: number;
  writable: boolean;
  aiEnabled: boolean;
  onChange: (next: ManuscriptPage) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-heading text-sm text-ink/60">Page {index + 1}</span>
        {writable && (
          <div className="flex gap-2 text-xs">
            <button onClick={() => onMove(-1)} className="text-ink/40 hover:text-ink">↑</button>
            <button onClick={() => onMove(1)} className="text-ink/40 hover:text-ink">↓</button>
            <button onClick={onRemove} className="text-rust hover:underline">Remove</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Label" htmlFor={`label-${index}`}>
          <Input
            id={`label-${index}`}
            disabled={!writable}
            value={page.label}
            onChange={(e) => onChange({ ...page, label: e.target.value })}
            placeholder="Cover, Page 1…"
          />
        </Field>
        <Field label="Layout" htmlFor={`layout-${index}`} hint="free text, e.g. a5_portrait">
          <Input
            id={`layout-${index}`}
            disabled={!writable}
            value={page.layout}
            onChange={(e) => onChange({ ...page, layout: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Text" htmlFor={`text-${index}`}>
          <Textarea
            id={`text-${index}`}
            rows={2}
            disabled={!writable}
            value={page.text}
            onChange={(e) => onChange({ ...page, text: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-ink/80">Illustration prompt</span>
          {writable && aiEnabled && (
            <AiSuggestButton
              getSuggestion={() => suggestIllustrationPrompt(page.text)}
              onAccept={(text) => onChange({ ...page, illustration_prompt: text })}
            />
          )}
        </div>
        <Textarea
          rows={2}
          disabled={!writable}
          value={page.illustration_prompt}
          onChange={(e) => onChange({ ...page, illustration_prompt: e.target.value })}
        />
      </div>

      <div className="mt-3">
        <Field label="Editor notes" htmlFor={`notes-${index}`}>
          <Textarea
            id={`notes-${index}`}
            rows={1}
            disabled={!writable}
            value={page.editor_notes}
            onChange={(e) => onChange({ ...page, editor_notes: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}
