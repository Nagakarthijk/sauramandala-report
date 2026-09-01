import { requireProject } from '@/lib/workspace';
import { accessFor, ROLE_LABELS } from '@/lib/permissions';
import {
  updateProjectDetails,
  updateIntegrationSettings,
  inviteMember,
} from '@/app/workspace/settings/actions';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { MemberRoleSelect } from '@/components/workspace/MemberRoleSelect';
import type { Role } from '@/lib/types';

export default async function SettingsPage() {
  const { supabase, project, role: myRole, user } = await requireProject();

  if (accessFor(myRole, 'settings') === 'none') {
    return (
      <EmptyState title="Lead access only" description="Settings are managed by the project lead." />
    );
  }

  const { data: members } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: true });

  let emailByUserId = new Map<string, string>();
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    emailByUserId = new Map(data?.users.map((u) => [u.id, u.email ?? '']) ?? []);
  } catch {
    // SUPABASE_SERVICE_ROLE_KEY not configured — fall back to showing user ids below.
  }

  const settings = project.settings;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-heading text-2xl">Settings</h1>

      <Card>
        <CardHeader title="Project details" />
        <CardBody>
          <form action={updateProjectDetails} className="grid grid-cols-2 gap-4">
            <Field label="Name" htmlFor="name">
              <Input id="name" name="name" defaultValue={project.name} />
            </Field>
            <Field label="Organisation" htmlFor="organisation">
              <Input id="organisation" name="organisation" defaultValue={project.organisation} />
            </Field>
            <Field label="Region" htmlFor="region">
              <Input id="region" name="region" defaultValue={project.region ?? ''} />
            </Field>
            <Field label="Languages" htmlFor="languages" hint="comma-separated">
              <Input id="languages" name="languages" defaultValue={project.languages.join(', ')} />
            </Field>
            <Button type="submit" className="col-span-2 w-fit">Save details</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Members" />
        <CardBody className="space-y-3">
          {(members ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between border-b border-ink/5 pb-2 last:border-0">
              <span className="text-sm">{emailByUserId.get(m.user_id) || m.user_id.slice(0, 8)}</span>
              <MemberRoleSelect memberId={m.id} role={m.role as Role} isSelf={m.user_id === user.id} />
            </div>
          ))}

          <form action={inviteMember} className="flex items-end gap-2 border-t border-ink/10 pt-4">
            <div className="flex-1">
              <Field label="Invite by email" htmlFor="email">
                <Input id="email" name="email" type="email" required />
              </Field>
            </div>
            <div className="w-40">
              <Field label="Role" htmlFor="role">
                <Select id="role" name="role" defaultValue="ra">
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button type="submit">Invite</Button>
          </form>
          <p className="text-xs text-ink/40">
            Requires SUPABASE_SERVICE_ROLE_KEY on the server and an email provider configured in
            Supabase Auth. Without it, add people manually via a project_members row in Supabase
            for now.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Integrations" subtitle="All optional, all off by default." />
        <CardBody>
          <form action={updateIntegrationSettings} className="space-y-4">
            <div className="space-y-2 rounded-md border border-ink/10 p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="ai_enabled" defaultChecked={!!settings.ai_enabled} className="h-4 w-4" />
                AI assist (Suggest buttons on condensation & illustration prompts)
              </label>
              <Field label="Provider" htmlFor="ai_provider">
                <Select id="ai_provider" name="ai_provider" defaultValue={settings.ai_provider ?? 'anthropic'}>
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="ollama">Ollama / OpenAI-compatible</option>
                </Select>
              </Field>
              <p className="text-xs text-ink/40">
                API key comes from ANTHROPIC_API_KEY / OPENAI_API_KEY on the server — not stored here.
              </p>
            </div>

            <div className="space-y-2 rounded-md border border-ink/10 p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="sw_enabled" defaultChecked={!!settings.sw_enabled} className="h-4 w-4" />
                StoryWeaver SLS export button on the readalong screen
              </label>
              <p className="text-xs text-ink/40">
                No API call is made to StoryWeaver — this only formats a CSV for manual upload.
              </p>
            </div>

            <div className="space-y-2 rounded-md border border-ink/10 p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="hf_enabled" defaultChecked={!!settings.hf_enabled} className="h-4 w-4" />
                Push corpus exports to a HuggingFace dataset
              </label>
              <Field label="Dataset id" htmlFor="hf_dataset_id" hint="e.g. your-org/tffp-meghalaya-corpus">
                <Input id="hf_dataset_id" name="hf_dataset_id" defaultValue={settings.hf_dataset_id ?? ''} />
              </Field>
              <p className="text-xs text-ink/40">Requires HUGGINGFACE_TOKEN on the server.</p>
            </div>

            <Button type="submit">Save integrations</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
