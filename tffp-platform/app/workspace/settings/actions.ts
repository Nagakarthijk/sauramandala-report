'use server';

import { revalidatePath } from 'next/cache';
import { requireProject } from '@/lib/workspace';
import { createAdminClient } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/activity';
import type { ProjectSettings, Role } from '@/lib/types';

export async function updateProjectDetails(formData: FormData) {
  const { supabase, project } = await requireProject();

  const languagesRaw = String(formData.get('languages') || '');
  const languages = languagesRaw ? languagesRaw.split(',').map((l) => l.trim()).filter(Boolean) : [];

  await supabase
    .from('projects')
    .update({
      name: String(formData.get('name') || project.name),
      organisation: String(formData.get('organisation') || project.organisation),
      region: String(formData.get('region') || '') || null,
      languages,
    })
    .eq('id', project.id);

  revalidatePath('/workspace/settings');
}

export async function updateIntegrationSettings(formData: FormData) {
  const { supabase, project } = await requireProject();

  const next: ProjectSettings = {
    ai_enabled: formData.get('ai_enabled') === 'on',
    ai_provider: (String(formData.get('ai_provider') || 'anthropic') || null) as ProjectSettings['ai_provider'],
    sw_enabled: formData.get('sw_enabled') === 'on',
    hf_enabled: formData.get('hf_enabled') === 'on',
    hf_dataset_id: String(formData.get('hf_dataset_id') || '') || null,
  };

  await supabase.from('projects').update({ settings: next }).eq('id', project.id);
  revalidatePath('/workspace/settings');
}

// Invites a user by email (creating their auth account if it doesn't
// exist yet) and adds them to the project with the chosen role. Uses the
// service-role admin client because an inviter's own RLS-scoped session
// can't look up or create arbitrary auth.users rows.
export async function inviteMember(formData: FormData) {
  const { supabase, project, user } = await requireProject();

  const email = String(formData.get('email') || '').trim().toLowerCase();
  const role = String(formData.get('role') || '') as Role;
  if (!email || !role) return;

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error('admin client unavailable', e);
    return;
  }

  let userId: string | null = null;

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/auth/callback?next=/workspace`,
  });

  if (invited?.user) {
    userId = invited.user.id;
  } else if (inviteError) {
    // Most likely: this email already has an account. Look it up instead
    // of failing — re-inviting an existing member should just add them.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
  }

  if (!userId) {
    console.error('could not resolve or invite user', email, inviteError?.message);
    return;
  }

  const { error: memberError } = await admin
    .from('project_members')
    .upsert({ project_id: project.id, user_id: userId, role }, { onConflict: 'project_id,user_id' });

  if (memberError) {
    console.error('add member failed', memberError.message);
    return;
  }

  await logActivity(supabase, {
    projectId: project.id,
    userId: user.id,
    action: 'member.invited',
    targetTable: 'project_members',
    metadata: { email, role },
  });

  revalidatePath('/workspace/settings');
}

export async function changeMemberRole(memberId: string, role: Role) {
  const { supabase, project } = await requireProject();
  await supabase.from('project_members').update({ role }).eq('id', memberId).eq('project_id', project.id);
  revalidatePath('/workspace/settings');
}

export async function removeMember(memberId: string) {
  const { supabase, project } = await requireProject();
  await supabase.from('project_members').delete().eq('id', memberId).eq('project_id', project.id);
  revalidatePath('/workspace/settings');
}
