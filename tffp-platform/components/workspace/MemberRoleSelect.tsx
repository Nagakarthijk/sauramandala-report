'use client';

import { useTransition } from 'react';
import { changeMemberRole, removeMember } from '@/app/workspace/settings/actions';
import { Select } from '@/components/ui/Input';
import { ROLE_LABELS } from '@/lib/permissions';
import type { Role } from '@/lib/types';

const ROLES = Object.keys(ROLE_LABELS) as Role[];

export function MemberRoleSelect({
  memberId,
  role,
  isSelf,
}: {
  memberId: string;
  role: Role;
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Select
        className="w-36"
        defaultValue={role}
        disabled={isSelf}
        onChange={(e) => startTransition(() => changeMemberRole(memberId, e.target.value as Role))}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </Select>
      {!isSelf && (
        <button
          className="text-xs text-rust hover:underline"
          onClick={() => startTransition(() => removeMember(memberId))}
        >
          Remove
        </button>
      )}
      {isPending && <span className="text-xs text-ink/30">saving…</span>}
    </div>
  );
}
