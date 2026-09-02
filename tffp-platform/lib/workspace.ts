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
//
// Wrapped in try/catch: this runs before any page-level error handling
// gets a chance to, so an unexpected throw here (a network hiccup
// reaching Supabase Auth, a malformed session cookie) would otherwise
// take down every single workspace page with the same opaque
// "server-side exception" screen. Treat it the same as "not signed in"
// rather than crashing — worst case, the user has to sign in again.
export async function getWorkspaceContext() {
  const supabase = createClient();

  let user;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (err) {
    console.error('getUser() threw in getWorkspaceContext', err);
    redirect('/auth/login');
  }

  if (!user) redirect('/auth/login');

  let list: Membership[] = [];
  try {
    const { data: memberships, error } = await supabase
      .from('project_members')
      .select('*, project:projects(*)')
      .eq('user_id', user.id)
      .returns<Membership[]>();
    if (error) {
      console.error('project_members query failed in getWorkspaceContext', error.message);
    } else {
      list = memberships ?? [];
    }
  } catch (err) {
    console.error('project_members query threw in getWorkspaceContext', err);
  }

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
