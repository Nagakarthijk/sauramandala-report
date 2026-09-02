import Link from 'next/link';
import { cx } from '@/lib/utils';

const TABS = [
  { segment: 'concept', label: 'Concept' },
  { segment: 'manuscript', label: 'Manuscript' },
  { segment: 'editorial', label: 'Editorial' },
  { segment: 'illustration', label: 'Illustration' },
  { segment: 'translations', label: 'Translations' },
  { segment: 'readalong', label: 'Readalong' },
  { segment: 'publish', label: 'Publish' },
];

export function BookTabs({ bookId, current }: { bookId: string; current: string }) {
  return (
    <div className="flex gap-1 border-b border-ink/10">
      {TABS.map((tab) => (
        <Link
          key={tab.segment}
          href={`/workspace/books/${bookId}/${tab.segment}`}
          className={cx(
            'rounded-t-md px-3 py-2 text-sm',
            tab.segment === current
              ? 'border-b-2 border-forest font-medium text-forest'
              : 'text-ink/60 hover:text-ink'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
