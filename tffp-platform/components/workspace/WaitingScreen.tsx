'use client';

import { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { NewProjectForm } from '@/components/workspace/NewProjectForm';
import { signOut } from '@/app/workspace/actions';

export function WaitingScreen() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <Card className="w-full max-w-md">
        <CardHeader title="You're signed in — almost there" />
        <CardBody className="space-y-5">
          {!showCreate ? (
            <>
              <p className="text-sm text-ink/70">
                You aren&apos;t a member of any project yet. Ask your project lead to add
                you, or start a new project of your own.
              </p>
              <div className="flex gap-3">
                <button
                  className="text-sm font-medium text-forest hover:underline"
                  onClick={() => setShowCreate(true)}
                >
                  Create a new project
                </button>
                <button className="text-sm text-ink/50 hover:underline" onClick={() => signOut()}>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <NewProjectForm />
              <button
                className="text-xs text-ink/50 hover:underline"
                onClick={() => setShowCreate(false)}
              >
                ← back
              </button>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
