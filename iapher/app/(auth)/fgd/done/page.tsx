import Link from 'next/link'

export default function FGDDonePage() {
  return (
    <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-sm w-full space-y-5">
        <div className="text-5xl">✓</div>
        <h1 className="text-2xl font-bold text-slate-900">Session complete</h1>
        <p className="text-slate-600">
          Your notes and reflections have been saved. Thank you for facilitating this session.
        </p>
        <div className="space-y-3">
          <Link
            href="/fgd/setup"
            className="block w-full min-h-[52px] bg-emerald-600 text-white rounded-xl font-medium flex items-center justify-center hover:bg-emerald-700"
          >
            Start another session
          </Link>
          <Link
            href="/"
            className="block w-full min-h-[52px] border border-slate-200 text-slate-700 rounded-xl font-medium flex items-center justify-center hover:bg-slate-50"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  )
}
