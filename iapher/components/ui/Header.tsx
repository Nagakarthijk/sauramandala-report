'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface HeaderProps {
  title?: string
  showBack?: boolean
  backHref?: string
  rightElement?: React.ReactNode
}

export function Header({ title, showBack, backHref, rightElement }: HeaderProps) {
  const router = useRouter()

  function handleBack() {
    if (backHref) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="flex items-center gap-3 px-4 py-3 min-h-[56px]">
        {showBack && (
          <button
            onClick={handleBack}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600"
            aria-label="Go back"
          >
            ←
          </button>
        )}
        {title && (
          <h1 className="flex-1 font-semibold text-slate-900 truncate">{title}</h1>
        )}
        {!title && !showBack && (
          <Link href="/" className="flex-1 font-bold text-emerald-700 text-lg">
            Iapher
          </Link>
        )}
        {rightElement && <div className="ml-auto">{rightElement}</div>}
      </div>
    </header>
  )
}
