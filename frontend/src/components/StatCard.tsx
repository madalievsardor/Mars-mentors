import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  color: 'blue' | 'emerald' | 'purple' | 'amber'
  subtitle?: string
}

const colorConfig = {
  blue: {
    bg: 'stat-bg-blue',
    iconBg: 'bg-indigo-500/15',
    iconColor: 'text-indigo-400',
    valueClass: 'bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent',
  },
  emerald: {
    bg: 'stat-bg-emerald',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    valueClass: 'bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent',
  },
  purple: {
    bg: 'stat-bg-purple',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    valueClass: 'bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent',
  },
  amber: {
    bg: 'stat-bg-amber',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    valueClass: 'bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent',
  },
}

export default function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
  const c = colorConfig[color]
  return (
    <div className={`stat rounded-2xl ${c.bg} animate-fade-in`}>
      <div className="stat-figure">
        <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center`}>
          <Icon size={20} className={c.iconColor} />
        </div>
      </div>
      <div className="stat-title text-slate-500 text-xs font-medium uppercase tracking-wide">{title}</div>
      <div className={`stat-value text-3xl font-bold ${c.valueClass}`}>{value}</div>
      {subtitle && <div className="stat-desc text-slate-600 text-xs">{subtitle}</div>}
    </div>
  )
}
