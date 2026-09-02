'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';
import { CURRENT_PROJECT_COOKIE } from '@/lib/workspace';

export interface CreateProjectState {
  error?: string;
}

// TEMPORARY debug helper — decodes a JWT's payload without verifying it,
// purely so we can show what role/sub the database is actually seeing
// for a failing request. Remove once the RLS issue is confirmed fixed.
function debugDecodeJwt(token: string | undefined | null): string {
  if (!token) return 'no access_token on session';
  try {
    const payloadSegment = token.split('.')[1];
    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
    return `role=${payload.role ?? 'none'} sub=${payload.sub ?? 'none'} aud=${payload.aud ?? 'none'} exp=${payload.exp ?? 'none'}`;
  } catch (e) {
    return `decode failed: ${e instanceof Error ? e.message : String(e)}`;
  }
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

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { data: whoami, error: whoamiError } = await supabase.rpc('whoami');
  const dbSees = whoamiError
    ? `whoami() rpc failed: ${whoamiError.message}`
    : `db-sees uid=${whoami?.[0]?.uid ?? 'null'} role=${whoami?.[0]?.role ?? 'null'}`;
  const debugInfo = `[debug: app-user-id=${user.id} token(${debugDecodeJwt(session?.access_token)}) ${dbSees}]`;

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

  const { data: project, error } = await supabase
    .from('projects')
    .insert({ name, organisation, region: region || null, languages })
    .select()
    .single();

  if (error || !project) {
    console.error('create project failed', error?.message);
    return { error: `${error?.message || 'Could not create the project.'} ${debugInfo}` };
  }

  // Bootstraps under the "first member of a project with none yet" RLS
  // policy — see supabase/migrations/0001_init.sql.
  const { error: memberError } = await supabase
    .from('project_members')
    .insert({ project_id: project.id, user_id: user.id, role: 'lead' });

  if (memberError) {
    console.error('create lead membership failed', memberError.message);
    return { error: `${memberError.message} ${debugInfo}` };
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
