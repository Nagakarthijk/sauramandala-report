import { getWorkspaceContext } from '@/lib/workspace';
import { WaitingScreen } from '@/components/workspace/WaitingScreen';
import { Sidebar } from '@/components/workspace/Sidebar';
import { ProjectSwitcher } from '@/components/workspace/ProjectSwitcher';
import { signOut } from '@/app/workspace/actions';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { memberships, membership, role } = await getWorkspaceContext();

  if (!membership) {
    return <WaitingScreen />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role!} />
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-ink/10 bg-white px-6 py-3">
          <ProjectSwitcher memberships={memberships} currentProjectId={membership.project_id} />
          <form action={signOut}>
            <button className="text-sm text-ink/50 hover:underline" type="submit">
              Sign out
            </button>
          </form>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
