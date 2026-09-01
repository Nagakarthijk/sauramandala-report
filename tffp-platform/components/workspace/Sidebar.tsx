import Link from 'next/link';
import type { Role } from '@/lib/types';
import { accessFor } from '@/lib/permissions';
import { ROLE_LABELS } from '@/lib/permissions';

const NAV: Array<{ href: string; label: string; screen: Parameters<typeof accessFor>[1] }> = [
  { href: '/workspace/field-visits', label: 'Field visits', screen: 'field_visits' },
  { href: '/workspace/story-seeds', label: 'Story seeds', screen: 'story_seeds' },
  { href: '/workspace/books', label: 'Books', screen: 'books' },
  { href: '/workspace/corpus', label: 'Corpus export', screen: 'corpus_export' },
  { href: '/workspace/settings', label: 'Settings', screen: 'settings' },
];

export function Sidebar({ role }: { role: Role }) {
  return (
    <nav className="flex h-full w-56 shrink-0 flex-col justify-between border-r border-ink/10 bg-white px-3 py-4">
      <div className="space-y-1">
        {NAV.filter((item) => accessFor(role, item.screen) !== 'none').map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-md px-3 py-2 text-sm text-ink/80 hover:bg-forest/10 hover:text-forest"
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className="px-3 text-xs text-ink/40">Signed in as {ROLE_LABELS[role]}</div>
    </nav>
  );
}
