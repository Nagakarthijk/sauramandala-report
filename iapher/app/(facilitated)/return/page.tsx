'use client'

import { useRouter } from 'next/navigation'

export default function ReturnPage() {
  const router = useRouter()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: '#0f172a' }}
    >
      <div className="max-w-sm w-full space-y-6">
        <div className="text-white space-y-2">
          <p className="text-2xl font-bold">Please hand the device back to the staff member</p>
          <p className="text-lg opacity-60 mt-4">Survey complete — thank you.</p>
        </div>

        <button
          onClick={() => router.push('/')}
          className="w-full min-h-[64px] bg-slate-700 text-white font-bold text-lg rounded-2xl hover:bg-slate-600 transition-colors"
        >
          Survey complete — return to home
        </button>
      </div>
    </div>
  )
}
