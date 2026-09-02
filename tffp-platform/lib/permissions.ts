import type { Role } from '@/lib/types';

export type Access = 'full' | 'read' | 'own' | 'none';

export type Screen =
  | 'field_visits'
  | 'recordings'
  | 'transcripts'
  | 'story_seeds'
  | 'books'
  | 'manuscripts'
  | 'editorial'
  | 'illustrations'
  | 'translations'
  | 'assets'
  | 'corpus_export'
  | 'settings';

// Mirrors the "Roles and access" table in the build spec verbatim.
// This is a UI convenience layer, not a security boundary — the real
// boundary is project-membership RLS (see supabase/migrations). Any
// authenticated member of a project can read/write any project-scoped
// row at the database level; this matrix only decides what the app
// shows and lets you click.
const MATRIX: Record<Screen, Record<Role, Access>> = {
  field_visits: { lead: 'full', editor: 'read', writer: 'read', illustrator: 'read', ra: 'full', fellow: 'full', translator: 'read' },
  recordings: { lead: 'full', editor: 'full', writer: 'read', illustrator: 'read', ra: 'full', fellow: 'full', translator: 'read' },
  transcripts: { lead: 'full', editor: 'full', writer: 'read', illustrator: 'read', ra: 'full', fellow: 'full', translator: 'read' },
  story_seeds: { lead: 'full', editor: 'full', writer: 'read', illustrator: 'read', ra: 'own', fellow: 'own', translator: 'read' },
  books: { lead: 'full', editor: 'full', writer: 'own', illustrator: 'own', ra: 'own', fellow: 'own', translator: 'own' },
  manuscripts: { lead: 'full', editor: 'full', writer: 'own', illustrator: 'read', ra: 'read', fellow: 'read', translator: 'read' },
  editorial: { lead: 'full', editor: 'full', writer: 'read', illustrator: 'read', ra: 'read', fellow: 'read', translator: 'read' },
  illustrations: { lead: 'full', editor: 'read', writer: 'read', illustrator: 'full', ra: 'read', fellow: 'read', translator: 'read' },
  translations: { lead: 'full', editor: 'full', writer: 'read', illustrator: 'read', ra: 'read', fellow: 'read', translator: 'own' },
  assets: { lead: 'full', editor: 'full', writer: 'read', illustrator: 'full', ra: 'read', fellow: 'read', translator: 'none' },
  corpus_export: { lead: 'full', editor: 'none', writer: 'none', illustrator: 'none', ra: 'none', fellow: 'none', translator: 'none' },
  settings: { lead: 'full', editor: 'none', writer: 'none', illustrator: 'none', ra: 'none', fellow: 'none', translator: 'none' },
};

export function accessFor(role: Role | null | undefined, screen: Screen): Access {
  if (!role) return 'none';
  return MATRIX[screen][role] ?? 'none';
}

export function canWrite(role: Role | null | undefined, screen: Screen): boolean {
  const access = accessFor(role, screen);
  return access === 'full' || access === 'own';
}

export function canWriteRecord(
  role: Role | null | undefined,
  screen: Screen,
  ownerId: string | null | undefined,
  userId: string | undefined
): boolean {
  const access = accessFor(role, screen);
  if (access === 'full') return true;
  if (access === 'own') return !!userId && ownerId === userId;
  return false;
}

export const ROLE_LABELS: Record<Role, string> = {
  lead: 'Lead',
  editor: 'Editor',
  writer: 'Writer',
  illustrator: 'Illustrator',
  ra: 'RA',
  fellow: 'Fellow',
  translator: 'Translator',
};
