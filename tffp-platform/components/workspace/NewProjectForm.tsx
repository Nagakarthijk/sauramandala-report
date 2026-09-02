'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createProject, type CreateProjectState } from '@/app/workspace/actions';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Creating…' : 'Create project'}
    </Button>
  );
}

const initialState: CreateProjectState = {};

export function NewProjectForm() {
  const [state, formAction] = useFormState(createProject, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Project name" htmlFor="name">
        <Input id="name" name="name" required placeholder="TFFP Meghalaya" autoComplete="off" />
      </Field>
      <Field label="Organisation" htmlFor="organisation">
        <Input id="organisation" name="organisation" required placeholder="Sauramandala Foundation" autoComplete="organization" />
      </Field>
      <Field label="Region" htmlFor="region" hint="optional">
        <Input id="region" name="region" placeholder="Garo Hills, Meghalaya" autoComplete="off" />
      </Field>
      <Field label="Languages" htmlFor="languages" hint="comma-separated, e.g. khasi, garo, english">
        <Input id="languages" name="languages" placeholder="khasi, garo, pnar, english" autoComplete="off" />
      </Field>
      {state?.error ? <p className="text-sm text-rust">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
