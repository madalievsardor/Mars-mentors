import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, BookOpen, GraduationCap, Building2, RefreshCw, Clock, TrendingUp } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from 'recharts'
import { useDashboard, useDashboardTimeline, useTriggerSync } from '../hooks/useQueries'
import StatCard from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import type { FilialOverview } from '../types'

function getMentorStatus(ratio: number): 'good' | 'average' | 'high' {
  if (ratio < 8) return 'good'
  if (ratio <= 12) return 'average'
  return 'high'
}

const statusConfig = {
  good: {
    badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
    bar: '#22c55e',
    dot: 'bg-emerald-500',
    progress: 'bg-gradient-to-r from-emerald-500 to-teal-500',
  },
  average: {
    badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
    bar: '#f59e0b',
    dot: 'bg-amber-500',
    progress: 'bg-gradient-to-r from-amber-500 to-orange-500',
  },
  high: {
    badge: 'bg-red-500/15 text-red-400 border border-red-500/25',
    bar: '#ef4444',
    dot: 'bg-red-500',
    progress: 'bg-gradient-to-r from-red-500 to-rose-500',
  },
}

// Clean, distinct, bright-on-dark palette — one solid line per branch.
const TIMELINE_COLORS = [
  '#6366f1', // indigo
  '#22d3ee', // cyan
  '#34d399', // emerald
  '#fbbf24', // amber
  '#fb7185', // rose
  '#a78bfa', // violet
  '#38bdf8', // sky
  '#f472b6', // pink
]

interface CustomBarTooltipProps {
  active?: boolean
  payload?: { value: number; payload: FilialOverview }[]
  label?: string
}

function CustomBarTooltip({ active, payload, label }: CustomBarTooltipProps) {
  const { t } = useTranslation()
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0].payload
  return (
    <div className="bg-[#1e2433] border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-xs space-y-1.5">
      <p className="text-slate-300 font-semibold mb-2">{label}</p>
      <div className="flex justify-between gap-6">
        <span className="text-slate-500">{t('dashboard.mentors')}</span>
        <span className="text-indigo-400 font-bold">{d.mentorCount}</span>
      </div>
      <div className="flex justify-between gap-6">
        <span className="text-slate-500">{t('dashboard.groups')}</span>
        <span className="text-violet-400 font-bold">{d.groupCount}</span>
      </div>
      <div className="flex justify-between gap-6">
        <span className="text-slate-500">{t('dashboard.students')}</span>
        <span className="text-emerald-400 font-bold">{d.totalStudents}</span>
      </div>
      <div className="flex justify-between gap-6 pt-1 border-t border-white/[0.06]">
        <span className="text-slate-500">{t('dashboard.ratio')}</span>
        <span className="text-white font-bold">{d.ratio.toFixed(1)}</span>
      </div>
    </div>
  )
}

function FilialCard({ filial }: { filial: FilialOverview }) {
  const { t } = useTranslation()
  const status = getMentorStatus(filial.ratio)
  const cfg = statusConfig[status]
  const progressPct = Math.min((filial.ratio / 16) * 100, 100)
  const statusLabel = status === 'good' ? t('dashboard.good') : status === 'average' ? t('dashboard.average') : t('dashboard.high')

  return (
    <div className={`rounded-2xl p-5 transition-all duration-200 cursor-default
      ${status === 'good' ? 'mentor-card-good' : status === 'average' ? 'mentor-card-average' : 'mentor-card-overloaded'}
    `}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-200 text-sm">{filial.branch}</h3>
          <p className="text-slate-600 text-xs mt-0.5">{t('dashboard.branch')}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badge}`}>
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <p className="text-indigo-400 font-bold text-xl">{filial.mentorCount}</p>
          <p className="text-slate-600 text-xs mt-0.5">{t('dashboard.mentor')}</p>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <p className="text-violet-400 font-bold text-xl">{filial.groupCount}</p>
          <p className="text-slate-600 text-xs mt-0.5">{t('dashboard.group')}</p>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <p className="text-emerald-400 font-bold text-xl">{filial.totalStudents}</p>
          <p className="text-slate-600 text-xs mt-0.5">{t('dashboard.student')}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-600 text-xs">{t('dashboard.studentGroupRatio')}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
            {filial.ratio.toFixed(1)}
          </span>
        </div>
        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${cfg.progress}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function FilialTableRow({ filial }: { filial: FilialOverview }) {
  const { t } = useTranslation()
  const status = getMentorStatus(filial.ratio)
  const cfg = statusConfig[status]
  const statusLabel = status === 'good' ? t('dashboard.good') : status === 'average' ? t('dashboard.average') : t('dashboard.high')
  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
          <span className="font-medium text-slate-200 text-sm">{filial.branch}</span>
        </div>
      </td>
      <td className="py-3.5 px-4 text-center text-indigo-400 font-semibold text-sm">{filial.mentorCount}</td>
      <td className="py-3.5 px-4 text-center text-violet-400 font-semibold text-sm">{filial.groupCount}</td>
      <td className="py-3.5 px-4 text-center text-emerald-400 font-semibold text-sm">{filial.totalStudents}</td>
      <td className="py-3.5 px-4 text-center">
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${cfg.badge}`}>
          {filial.ratio.toFixed(1)}
        </span>
      </td>
      <td className="py-3.5 px-4 text-center">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badge}`}>
          {statusLabel}
        </span>
      </td>
    </tr>
  )
}

// Pure timeline line chart body — rendered inside the chart toggle card.
// Returns null when there's no historical data so the toggle can fall back.
function TimelineChartBody() {
  const { t } = useTranslation()
  const { data, isLoading } = useDashboardTimeline()

  if (isLoading || !data || !data.available || data.points.length === 0) {
    return (
      <div className="h-[340px] flex items-center justify-center text-slate-600 text-sm">
        {t('dashboard.noData')}
      </div>
    )
  }

  return (
    <>
      <p className="text-slate-600 text-xs mb-6">{t('dashboard.timelineSubtitle')}</p>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data.points} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#475569', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: '#475569', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: '#0f1420',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: '#cbd5e1', fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ padding: '1px 0' }}
            cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 }}
          />
          <Legend
            verticalAlign="middle"
            align="right"
            layout="vertical"
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, paddingLeft: 16, color: '#94a3b8' }}
          />
          {data.branches.map((branch, i) => (
            <Line
              key={branch}
              type="monotone"
              dataKey={branch}
              name={branch}
              stroke={TIMELINE_COLORS[i % TIMELINE_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive
              animationDuration={1200}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </>
  )
}

// Pure comparison bar chart body — rendered inside the chart toggle card.
function ComparisonChartBody({ chartData }: { chartData: (FilialOverview & { name: string })[] | undefined }) {
  const { t } = useTranslation()
  return (
    <>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#475569', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: '#475569', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="mentorCount" name={t('dashboard.mentors')} radius={[4, 4, 0, 0]}>
            {chartData?.map((_entry, i) => (
              <Cell key={i} fill="#6366f1" fillOpacity={0.8} />
            ))}
          </Bar>
          <Bar dataKey="groupCount" name={t('dashboard.groups')} radius={[4, 4, 0, 0]}>
            {chartData?.map((_entry, i) => (
              <Cell key={i} fill="#a78bfa" fillOpacity={0.6} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-5 mt-4 justify-center">
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />
          {t('dashboard.mentors')}
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-3 h-3 rounded-sm bg-violet-400 inline-block" />
          {t('dashboard.groups')}
        </span>
      </div>
    </>
  )
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation()
  const { data: filials, isLoading, isError, error, refetch } = useDashboard()
  const syncMutation = useTriggerSync()
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncError, setSyncError] = useState(false)
  const [chartMode, setChartMode] = useState<'comparison' | 'timeline'>('comparison')

  const localeCode = useMemo(() => {
    if (i18n.language === 'uz') return 'uz-UZ'
    if (i18n.language === 'ru') return 'ru-RU'
    return 'en-US'
  }, [i18n.language])

  const stats = filials
    ? {
        totalMentors: filials.reduce((s, f) => s + f.mentorCount, 0),
        totalGroups: filials.reduce((s, f) => s + f.groupCount, 0),
        totalStudents: filials.reduce((s, f) => s + f.totalStudents, 0),
        activeBranches: filials.length,
      }
    : null

  const handleSync = async () => {
    setSyncError(false)
    try {
      const result = await syncMutation.mutateAsync()
      const time = result.syncedAt
        ? new Date(result.syncedAt).toLocaleTimeString(localeCode)
        : new Date().toLocaleTimeString(localeCode)
      setLastSync(time)
    } catch {
      setSyncError(true)
      setLastSync(new Date().toLocaleTimeString(localeCode))
    }
  }

  const chartData = filials?.map((f) => ({
    ...f,
    name: f.branch.length > 12 ? f.branch.slice(0, 12) + '…' : f.branch,
  }))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={handleSync}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium transition-all duration-150 shadow-lg shadow-indigo-500/20"
          >
            <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
            {syncMutation.isPending ? t('dashboard.syncing') : t('dashboard.sync')}
          </button>
          {lastSync && (
            <span className={`flex items-center gap-1.5 text-xs ${syncError ? 'text-red-400' : 'text-slate-600'}`}>
              <Clock size={11} />
              {t('dashboard.lastSync')}: {lastSync}
            </span>
          )}
        </div>
      </div>

      {/* Sync error alert */}
      {syncError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-red-400 text-sm">
          {t('dashboard.syncError')}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="stats stats-vertical sm:stats-horizontal w-full bg-transparent gap-3">
          <StatCard title={t('dashboard.totalMentors')} value={stats.totalMentors} icon={Users} color="blue" />
          <StatCard title={t('dashboard.totalGroups')} value={stats.totalGroups} icon={BookOpen} color="purple" />
          <StatCard title={t('dashboard.totalStudents')} value={stats.totalStudents} icon={GraduationCap} color="emerald" />
          <StatCard title={t('dashboard.activeBranches')} value={stats.activeBranches} icon={Building2} color="amber" />
        </div>
      )}

      {/* Loading & Error */}
      {isLoading && <LoadingSpinner message={t('dashboard.loading')} />}
      {isError && (
        <ErrorMessage
          message={(error as Error)?.message || t('dashboard.loadError')}
          onRetry={() => refetch()}
        />
      )}

      {/* Chart + Filials */}
      {filials && filials.length > 0 && (
        <>
          {/* Chart card with toggle: comparison bar chart (default) / timeline line chart */}
          <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-400" />
                <h2 className="font-semibold text-slate-200 text-sm">
                  {chartMode === 'comparison' ? t('dashboard.chartTitle') : t('dashboard.timelineTitle')}
                </h2>
              </div>
              {/* Toggle — segmented control (only one chart shows at a time) */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                {(['comparison', 'timeline'] as const).map((mode) => {
                  const active = chartMode === mode
                  return (
                    <button
                      key={mode}
                      onClick={() => setChartMode(mode)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {mode === 'comparison' ? t('dashboard.chartComparison') : t('dashboard.chartTimeline')}
                    </button>
                  )
                })}
              </div>
            </div>
            {chartMode === 'comparison' ? (
              <ComparisonChartBody chartData={chartData} />
            ) : (
              <TimelineChartBody />
            )}
          </div>

          {/* Cards grid (mobile/tablet) */}
          <div className="xl:hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-200">{t('dashboard.branchView')}</h2>
              <RatioLegend />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filials.map((filial) => (
                <FilialCard key={filial.branch} filial={filial} />
              ))}
            </div>
          </div>

          {/* Table (desktop) */}
          <div className="hidden xl:block">
            <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-base font-semibold text-slate-200">{t('dashboard.branchView')}</h2>
                <RatioLegend />
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('dashboard.branch')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('dashboard.mentors')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('dashboard.groups')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('dashboard.students')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('dashboard.ratio')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('dashboard.studentGroupRatio')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filials.map((filial) => (
                    <FilialTableRow key={filial.branch} filial={filial} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {filials && filials.length === 0 && (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl flex flex-col items-center py-20 gap-3">
          <Building2 size={40} className="text-slate-700" />
          <p className="text-slate-600">{t('dashboard.noData')}</p>
        </div>
      )}
    </div>
  )
}

function RatioLegend() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-4 text-xs text-slate-600">
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        {t('dashboard.legendGood')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        {t('dashboard.legendAverage')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        {t('dashboard.legendHigh')}
      </span>
    </div>
  )
}
