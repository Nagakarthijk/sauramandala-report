'use client';

import { useState } from 'react';
import { createProject } from '@/app/workspace/actions';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';

export function NewProjectForm() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={async (formData) => {
        setSubmitting(true);
        await createProject(formData);
        setSubmitting(false);
      }}
      className="space-y-4"
    >
      <Field label="Project name" htmlFor="name">
        <Input id="name" name="name" required placeholder="TFFP Meghalaya" />
      </Field>
      <Field label="Organisation" htmlFor="organisation">
        <Input id="organisation" name="organisation" required placeholder="Sauramandala Foundation" />
      </Field>
      <Field label="Region" htmlFor="region" hint="optional">
        <Input id="region" name="region" placeholder="Garo Hills, Meghalaya" />
      </Field>
      <Field label="Languages" htmlFor="languages" hint="comma-separated, e.g. khasi, garo, english">
        <Input id="languages" name="languages" placeholder="khasi, garo, pnar, english" />
      </Field>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Creating…' : 'Create project'}
      </Button>
    </form>
  );
}
