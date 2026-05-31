'use client'

import { useRouter } from 'next/navigation'

export default function HandoffPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ backgroundColor: '#16a34a' }}>
      <div className="max-w-sm w-full space-y-8">
        <div className="text-white space-y-3">
          <p className="text-2xl font-bold">Please hand the device to the young person</p>
          <p className="text-lg opacity-80">Phi pynïapher ia u/ka mynsiem sha u khynmaw nongïaid</p>
          <p className="text-lg opacity-80">Ngi pataoana ia device sha khynmaw aro</p>
          <p className="text-lg opacity-80">Ka ïapher ia u/ka mynsiem sha u khynmaw nongïaid</p>
        </div>

        <button
          onClick={() => router.push('/facilitated/private/1')}
          className="w-full min-h-[64px] bg-white text-green-800 font-bold text-lg rounded-2xl hover:bg-green-50 transition-colors"
        >
          I am ready — Begin →
        </button>
      </div>
    </div>
  )
}
