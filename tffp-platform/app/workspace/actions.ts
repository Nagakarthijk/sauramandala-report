'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';
import { CURRENT_PROJECT_COOKIE } from '@/lib/workspace';

export async function createProject(formData: FormData) {
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

  if (!name || !organisation) return;

  const { data: project, error } = await supabase
    .from('projects')
    .insert({ name, organisation, region: region || null, languages })
    .select()
    .single();

  if (error || !project) {
    console.error('create project failed', error?.message);
    return;
  }

  // Bootstraps under the "first member of a project with none yet" RLS
  // policy — see supabase/migrations/0001_init.sql.
  const { error: memberError } = await supabase
    .from('project_members')
    .insert({ project_id: project.id, user_id: user.id, role: 'lead' });

  if (memberError) {
    console.error('create lead membership failed', memberError.message);
    return;
  }

  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    action: 'project.created',
    targetTable: 'projects',
    targetId: project.id,
  });

  cookies().set(CURRENT_PROJECT_COOKIE, project.id, { path: '/', maxAge: 60 * 60 * 24 * 365 });
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
