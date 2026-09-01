import Link from 'next/link';

const STEPS = [
  {
    title: '1. Set up the platform',
    body: `Run the Supabase migration in this repo against your own project (five
    minutes in the SQL editor), set three environment variables, and deploy —
    Netlify, Vercel, or any Node host. No API keys required to start.`,
  },
  {
    title: '2. Build your team',
    body: `Create a project, become its lead, and invite the roles you need:
    editors, writers, illustrators, RAs or fellows for fieldwork, and
    translators. Everyone sees only their own project's data.`,
  },
  {
    title: '3. Go to the field',
    body: `Log field visits, record conversations, and get verbatim transcripts
    and English translations into the system — the two-column transcript
    editor is built for exactly this, and it's the screen to test first
    with a real recording.`,
  },
  {
    title: '4. Turn recordings into books',
    body: `Condense, filter, and draft a concept note; build the manuscript
    page by page with illustration prompts; run editorial rounds; track
    illustration milestones. Every version is kept, nothing is overwritten.`,
  },
  {
    title: '5. Publish and localise',
    body: `Lock the English manuscript, fork it into translations for each of
    your project's languages, record readalongs, and export the corpus your
    process quietly produced along the way — a speech corpus, a parallel
    text corpus, or a full project backup.`,
  },
];

export default function PlanPage() {
  return (
    <main className="min-h-screen bg-paper px-6 py-16 text-ink">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-ink/50 hover:underline">
          ← back
        </Link>
        <h1 className="mt-4 font-heading text-3xl">Bring this to your organisation</h1>
        <p className="mt-2 text-ink/60">
          The platform is open source and designed to be replicated. Nothing
          here is specific to any one project or language.
        </p>

        <ol className="mt-10 space-y-6">
          {STEPS.map((step) => (
            <li key={step.title} className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm">
              <h2 className="font-heading text-lg">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink/70">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 rounded-lg bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-ink/70">Ready to start?</p>
          <Link href="/workspace" className="mt-2 inline-block font-medium text-forest hover:underline">
            Enter the workspace →
          </Link>
        </div>
      </div>
    </main>
  );
}
