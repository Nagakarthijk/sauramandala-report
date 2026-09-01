import { cx } from '@/lib/utils';

const colorMap: Record<string, string> = {
  forest: 'bg-forest/10 text-forest',
  rust: 'bg-rust/10 text-rust',
  turmeric: 'bg-turmeric/20 text-ink',
  indigo: 'bg-indigo/10 text-indigo',
  neutral: 'bg-ink/10 text-ink/70',
};

export function Badge({
  children,
  color = 'neutral',
  className,
}: {
  children: React.ReactNode;
  color?: keyof typeof colorMap;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        colorMap[color],
        className
      )}
    >
      {children}
    </span>
  );
}

const BOOK_STATUS_COLOR: Record<string, keyof typeof colorMap> = {
  concept: 'neutral',
  manuscript_draft: 'turmeric',
  manuscript_locked: 'indigo',
  illustration: 'rust',
  translation: 'indigo',
  readalong: 'forest',
  published: 'forest',
};

export function BookStatusBadge({ status }: { status: string }) {
  return (
    <Badge color={BOOK_STATUS_COLOR[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</Badge>
  );
}
