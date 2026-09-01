import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Project, ProjectMember, Role } from '@/lib/types';

export const CURRENT_PROJECT_COOKIE = 'tffp_project_id';

export interface Membership extends ProjectMember {
  project: Project;
}

// Every /workspace page needs the same three things: who's signed in,
// which project they're currently working in, and their role on it.
// Centralising it here keeps that logic (and the redirect-if-missing
// behaviour) out of every individual page.
export async function getWorkspaceContext() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: memberships } = await supabase
    .from('project_members')
    .select('*, project:projects(*)')
    .eq('user_id', user.id)
    .returns<Membership[]>();

  const list = memberships ?? [];
  const requestedId = cookies().get(CURRENT_PROJECT_COOKIE)?.value;
  const membership = list.find((m) => m.project_id === requestedId) ?? list[0] ?? null;

  return {
    supabase,
    user,
    memberships: list,
    membership,
    project: membership?.project ?? null,
    role: (membership?.role ?? null) as Role | null,
  };
}

// Use inside a page/action that requires a selected project — redirects
// to /workspace (which itself shows the waiting screen or a selector)
// rather than rendering with a null project.
export async function requireProject() {
  const ctx = await getWorkspaceContext();
  if (!ctx.project) redirect('/workspace');
  return ctx as typeof ctx & { project: Project; role: Role };
}
