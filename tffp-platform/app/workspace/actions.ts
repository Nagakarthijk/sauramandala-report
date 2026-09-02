'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';
import { CURRENT_PROJECT_COOKIE } from '@/lib/workspace';

export interface CreateProjectState {
  error?: string;
}

export async function createProject(
  _prevState: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const name = String(formData.get('name') ?? '').trim();
  const organisation = String(formData.get('organisation') ?? '').trim();
  const region = String(formData.get('region') ?? '').trim();
  const languagesRaw = String(formData.get('languages') ?? '').trim();
  const languages = languagesRaw
    ? languagesRaw.split(',').map((l) => l.trim()).filter(Boolean)
    : [];

  if (!name || !organisation) {
    return { error: 'Project name and organisation are both required.' };
  }

  // Generated here rather than read back via `.select()` after insert:
  // Postgres requires a freshly-inserted row to also satisfy the
  // table's SELECT policy for INSERT...RETURNING to succeed, and this
  // user isn't a project_members row yet at the moment this row is
  // created — that only happens in the next statement. Knowing the id
  // upfront means we never need RETURNING for this insert at all.
  const projectId = crypto.randomUUID();

  const { error: projectError } = await supabase
    .from('projects')
    .insert({ id: projectId, name, organisation, region: region || null, languages });

  if (projectError) {
    console.error('create project failed', projectError.message);
    return { error: projectError.message };
  }

  // Bootstraps under the "first member of a project with none yet" RLS
  // policy — see supabase/migrations/0001_init.sql.
  const { error: memberError } = await supabase
    .from('project_members')
    .insert({ project_id: projectId, user_id: user.id, role: 'lead' });

  if (memberError) {
    console.error('create lead membership failed', memberError.message);
    return { error: memberError.message };
  }

  await logActivity(supabase, {
    projectId,
    userId: user.id,
    action: 'project.created',
    targetTable: 'projects',
    targetId: projectId,
  });

  cookies().set(CURRENT_PROJECT_COOKIE, projectId, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  redirect('/workspace');
}

export async function switchProject(projectId: string) {
  cookies().set(CURRENT_PROJECT_COOKIE, projectId, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  redirect('/workspace');
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/auth/login');
}
