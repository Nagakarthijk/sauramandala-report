'use client'

interface ThemeBarProps {
  themes: { label: string; count: number; pct: number; color?: string }[]
}

export function ThemeBar({ themes }: ThemeBarProps) {
  const sorted = [...themes].sort((a, b) => b.count - a.count).slice(0, 10)

  return (
    <div className="space-y-3">
      {sorted.map((t) => (
        <div key={t.label}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-700 font-medium">{t.label}</span>
            <span className="text-slate-500">{t.count} ({t.pct}%)</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${t.pct}%`,
                backgroundColor: t.color ?? '#10b981',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
