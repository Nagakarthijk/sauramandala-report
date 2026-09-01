import Link from 'next/link';

const DOORS = [
  {
    href: '/story',
    color: 'text-turmeric',
    title: 'Read a story',
    body: 'Follow one story from a field recording to a finished, illustrated children\'s book.',
  },
  {
    href: '/plan',
    color: 'text-indigo',
    title: 'Plan a project',
    body: 'Bringing this process to your own organisation? Start with the five-step planner.',
  },
  {
    href: '/workspace',
    color: 'text-forest',
    title: 'Enter the workspace',
    body: 'Sign in to record, transcribe, translate, and build books with your team.',
  },
];

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 bg-paper px-6 py-16 text-ink">
      <div className="max-w-2xl text-center">
        <h1 className="font-heading text-4xl">TFFP Platform</h1>
        <p className="mt-3 text-ink/70">
          An open production tracker for contextual children&rsquo;s literature —
          built for The Forgotten Folklore Project, and free for any
          organisation doing similar work anywhere.
        </p>
      </div>

      <div className="grid w-full max-w-4xl gap-6 sm:grid-cols-3">
        {DOORS.map((door) => (
          <Link
            key={door.href}
            href={door.href}
            className="flex flex-col gap-2 rounded-lg border border-ink/10 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className={`font-heading text-xl ${door.color}`}>{door.title}</span>
            <span className="text-sm text-ink/60">{door.body}</span>
          </Link>
        ))}
      </div>

      <p className="text-xs text-ink/40">
        Built by Sauramandala Foundation. Works with just humans — AI assist and
        other integrations are optional.
      </p>
    </main>
  );
}
