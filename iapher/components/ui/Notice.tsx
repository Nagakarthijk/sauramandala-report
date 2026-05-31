interface NoticeProps {
  variant?: 'info' | 'warning' | 'error' | 'success'
  title?: string
  children: React.ReactNode
  className?: string
}

export function Notice({ variant = 'info', title, children, className }: NoticeProps) {
  const styles = {
    info: { wrap: 'bg-blue-50 border-blue-200 text-blue-800', icon: 'ℹ️' },
    warning: { wrap: 'bg-amber-50 border-amber-200 text-amber-800', icon: '⚠️' },
    error: { wrap: 'bg-red-50 border-red-200 text-red-800', icon: '✕' },
    success: { wrap: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: '✓' },
  }
  const { wrap, icon } = styles[variant]
  return (
    <div className={`border rounded-xl p-4 ${wrap} ${className ?? ''}`} role="alert">
      <div className="flex gap-3">
        <span aria-hidden="true">{icon}</span>
        <div>
          {title && <p className="font-semibold mb-1">{title}</p>}
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </div>
  )
}
