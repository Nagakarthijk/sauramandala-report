interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'emerald' | 'blue' | 'amber' | 'red' | 'violet' | 'slate'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-100 text-emerald-800',
    blue: 'bg-blue-100 text-blue-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    violet: 'bg-violet-100 text-violet-800',
    slate: 'bg-slate-200 text-slate-700',
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className ?? ''}`}
    >
      {children}
    </span>
  )
}
