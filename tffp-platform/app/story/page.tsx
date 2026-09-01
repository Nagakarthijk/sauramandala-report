import Link from 'next/link';

const CHAPTERS = [
  {
    title: '1. A visit',
    color: 'border-forest',
    body: `A field team travels to a village they've been introduced to through
    an existing relationship — never cold. They sit with a resource person,
    explain what the project is for, and ask if there's a story worth
    recording. Consent is asked for plainly, not assumed.`,
  },
  {
    title: '2. A recording',
    color: 'border-forest',
    body: `The resource person tells the story in their own language, in their
    own words, at their own pace. The recorder captures speaker, language,
    dialect, and consent alongside the audio file.`,
  },
  {
    title: '3. A verbatim transcript',
    color: 'border-turmeric',
    body: `Back at their desk, someone who speaks the language listens closely
    and types every word — pauses, laughter, local terms, all of it. Nothing
    is smoothed over yet. This is the record.`,
  },
  {
    title: '4. An English translation',
    color: 'border-turmeric',
    body: `Sentence by sentence, the verbatim text becomes English. This is
    the handoff: once it exists, anyone on the team can read the story,
    not just the people who speak the source language.`,
  },
  {
    title: '5. A condensation',
    color: 'border-rust',
    body: `An editor works the English translation down to four or seven
    hundred words — the shape of a story seed. What's removed, reordered,
    or tightened is written down, so no decision is silent.`,
  },
  {
    title: '6. A filter',
    color: 'border-rust',
    body: `Does it have an emotional hook? Can it be told simply without
    losing its truth? Does it treat the community with dignity? Is there
    sacred knowledge in it that shouldn't be published at all? A checklist,
    not a gut call.`,
  },
  {
    title: '7. A manuscript',
    color: 'border-indigo',
    body: `Page by page, text and illustration prompts are drafted together,
    reviewed in editorial rounds, and locked once everyone agrees it's
    ready — with the full history of every earlier draft kept, not
    overwritten.`,
  },
  {
    title: '8. A book, and then many books',
    color: 'border-indigo',
    body: `An illustrator builds a character sheet, then thumbnails, then
    final art. Once the English book is locked, it forks: translators carry
    it back into local languages, narrators record readalongs, and the
    story returns to where it came from — in a form a child can hold.`,
  },
];

export default function StoryPage() {
  return (
    <main className="min-h-screen bg-paper px-6 py-16 text-ink">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-ink/50 hover:underline">
          ← back
        </Link>
        <h1 className="mt-4 font-heading text-3xl">The journey of a story</h1>
        <p className="mt-2 text-ink/60">
          Eight chapters, from a village visit to a finished book. This is what
          the platform tracks at every step.
        </p>

        <div className="mt-10 space-y-8">
          {CHAPTERS.map((chapter) => (
            <div key={chapter.title} className={`border-l-4 pl-5 ${chapter.color}`}>
              <h2 className="font-heading text-xl">{chapter.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink/70">{chapter.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-lg bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-ink/70">Want to run this process for your own community?</p>
          <Link href="/plan" className="mt-2 inline-block font-medium text-indigo hover:underline">
            See the five-step planner →
          </Link>
        </div>
      </div>
    </main>
  );
}
