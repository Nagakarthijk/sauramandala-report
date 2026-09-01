import Link from 'next/link';
import { requireProject } from '@/lib/workspace';
import { canWrite } from '@/lib/permissions';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import type { FieldVisit } from '@/lib/types';

const OUTCOME_COLOR: Record<string, 'forest' | 'turmeric' | 'rust' | 'neutral'> = {
  strong_seed: 'forest',
  multiple_seeds: 'forest',
  partial: 'turmeric',
  referral: 'turmeric',
  no_seed: 'neutral',
};

export default async function FieldVisitsPage() {
  const { supabase, project, role } = await requireProject();

  const { data } = await supabase
    .from('field_visits')
    .select('*')
    .eq('project_id', project.id)
    .order('visit_date', { ascending: false })
    .returns<FieldVisit[]>();

  const visits = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">Field visits</h1>
          <p className="text-sm text-ink/60">{project.name}</p>
        </div>
        {canWrite(role, 'field_visits') && (
          <Link href="/workspace/field-visits/new">
            <Button>+ Log a visit</Button>
          </Link>
        )}
      </div>

      {visits.length === 0 ? (
        <EmptyState
          title="No field visits yet"
          description="Every recording starts with a visit. Log the first one to get going."
          action={
            canWrite(role, 'field_visits') ? (
              <Link href="/workspace/field-visits/new">
                <Button>+ Log a visit</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3">
          {visits.map((visit) => (
            <Link key={visit.id} href={`/workspace/field-visits/${visit.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardBody className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{visit.location || 'Unnamed location'}</span>
                      {visit.outcome && (
                        <Badge color={OUTCOME_COLOR[visit.outcome] ?? 'neutral'}>
                          {visit.outcome.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-ink/60">
                      {formatDate(visit.visit_date)} · {visit.subject_theme || 'no theme noted'}
                    </p>
                  </div>
                  <span className="text-sm text-ink/40">{visit.region}</span>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
