interface Stat {
  label: string
  value: number | string
  icon?: string
  color?: string
}

interface StatGridProps {
  stats: Stat[]
}

export function StatGrid({ stats }: StatGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm"
        >
          {stat.icon && <div className="text-2xl mb-2">{stat.icon}</div>}
          <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
          <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}
