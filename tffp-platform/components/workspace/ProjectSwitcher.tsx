'use client';

import { switchProject } from '@/app/workspace/actions';
import type { Membership } from '@/lib/workspace';

export function ProjectSwitcher({
  memberships,
  currentProjectId,
}: {
  memberships: Membership[];
  currentProjectId: string;
}) {
  if (memberships.length <= 1) {
    return <span className="font-heading text-lg">{memberships[0]?.project.name}</span>;
  }

  return (
    <select
      className="rounded-md border border-ink/20 bg-white px-2 py-1 font-heading text-lg"
      defaultValue={currentProjectId}
      onChange={(e) => switchProject(e.target.value)}
    >
      {memberships.map((m) => (
        <option key={m.project_id} value={m.project_id}>
          {m.project.name}
        </option>
      ))}
    </select>
  );
}
