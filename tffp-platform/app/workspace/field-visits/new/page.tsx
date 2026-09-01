import Link from 'next/link';
import { createFieldVisit } from '@/app/workspace/field-visits/actions';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function NewFieldVisitPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/workspace/field-visits" className="text-sm text-ink/50 hover:underline">
        ← Field visits
      </Link>
      <Card>
        <CardHeader title="Log a field visit" />
        <CardBody>
          <form action={createFieldVisit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Visit date" htmlFor="visit_date">
                <Input id="visit_date" name="visit_date" type="date" />
              </Field>
              <Field label="Region" htmlFor="region">
                <Input id="region" name="region" placeholder="Garo Hills" />
              </Field>
            </div>
            <Field label="Location" htmlFor="location">
              <Input id="location" name="location" placeholder="Village / settlement name" />
            </Field>
            <Field label="Resource person(s)" htmlFor="resource_persons" hint="name, age, role, language spoken">
              <Textarea id="resource_persons" name="resource_persons" rows={2} />
            </Field>
            <Field label="Subject / theme" htmlFor="subject_theme">
              <Input id="subject_theme" name="subject_theme" placeholder="Origin story of the river" />
            </Field>
            <Field label="How was this contact identified?" htmlFor="how_identified">
              <Input id="how_identified" name="how_identified" />
            </Field>
            <Field label="Outcome" htmlFor="outcome">
              <Select id="outcome" name="outcome" defaultValue="">
                <option value="">— not yet known —</option>
                <option value="strong_seed">Strong seed</option>
                <option value="multiple_seeds">Multiple seeds</option>
                <option value="partial">Partial</option>
                <option value="referral">Referral to someone else</option>
                <option value="no_seed">No seed</option>
              </Select>
            </Field>
            <Field label="Visit notes" htmlFor="visit_notes">
              <Textarea id="visit_notes" name="visit_notes" rows={4} />
            </Field>
            <Button type="submit">Save visit</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
