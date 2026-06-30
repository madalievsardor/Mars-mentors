import { useState } from 'react'
import { Activity, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'
import { useApiLogs } from '../hooks/useQueries'
import LoadingSpinner from '../components/LoadingSpinner'
import type { LogCategory, ApiLogEntry } from '../types'

const TABS: { key: LogCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'mentor', label: 'Mentor API' },
  { key: 'admin', label: 'Admin API' },
  { key: 'tutor', label: 'Tutor API' },
  { key: 'auth', label: 'Auth' },
]

const METHOD_COLOR: Record<string, string> = {
  GET: 'text-sky-400 bg-sky-500/10',
  POST: 'text-emerald-400 bg-emerald-500/10',
  PUT: 'text-amber-400 bg-amber-500/10',
  PATCH: 'text-violet-400 bg-violet-500/10',
  DELETE: 'text-red-400 bg-red-500/10',
}

function LogRow({ entry }: { entry: ApiLogEntry }) {
  const isErr = entry.error || (entry.status !== null && entry.status >= 400)
  const methodCls = METHOD_COLOR[entry.method] ?? 'text-slate-400 bg-slate-500/10'
  const dt = new Date(entry.ts)
  const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}:${String(dt.getSeconds()).padStart(2, '0')}`

  return (
    <tr className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${isErr ? 'bg-red-500/[0.03]' : ''}`}>
      <td className="py-2 px-3 text-slate-600 text-xs tabular-nums whitespace-nowrap">{time}</td>
      <td className="py-2 px-3">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums ${methodCls}`}>
          {entry.method}
        </span>
      </td>
      <td className="py-2 px-3 text-slate-300 text-xs font-mono max-w-[340px] truncate" title={entry.path}>
        {entry.path}
      </td>
      <td className="py-2 px-3 text-center">
        {entry.status !== null ? (
          <span className={`text-xs font-semibold tabular-nums ${entry.status < 400 ? 'text-emerald-400' : 'text-red-400'}`}>
            {entry.status}
          </span>
        ) : (
          <span className="text-slate-600 text-xs">—</span>
        )}
      </td>
      <td className="py-2 px-3 text-center">
        <span className="text-xs text-slate-500 tabular-nums">{entry.durationMs}ms</span>
      </td>
      <td className="py-2 px-3">
        {entry.error ? (
          <span className="text-red-400 text-xs truncate max-w-[160px] block" title={entry.error}>
            {entry.error.slice(0, 60)}
          </span>
        ) : (
          <CheckCircle size={12} className="text-emerald-500/50" />
        )}
      </td>
    </tr>
  )
}

export default function LogsPage() {
  const [tab, setTab] = useState<LogCategory | 'all'>('all')
  const { data, isLoading, isFetching, refetch } = useApiLogs(
    tab === 'all' ? undefined : tab,
  )

  const entries = data ?? []
  const errCount = entries.filter((e) => e.error || (e.status !== null && e.status >= 400)).length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity size={22} className="text-indigo-400" />
            Mars API Loglar
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Oxirgi 500 ta API chaqiruv — har 10 soniyada yangilanadi
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-slate-200 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Yangilash
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <span className="flex items-center gap-1.5 text-slate-400">
          <Activity size={13} className="text-indigo-400" />
          <span className="text-white font-semibold tabular-nums">{entries.length}</span> ta log
        </span>
        {errCount > 0 && (
          <span className="flex items-center gap-1.5 text-red-400">
            <AlertCircle size={13} />
            <span className="font-semibold tabular-nums">{errCount}</span> ta xato
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white transition-all'
                : 'px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-300 transition-all'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="py-12">
            <LoadingSpinner message="Loglar yuklanmoqda..." />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-slate-700">
            <Activity size={32} />
            <p className="text-slate-500 text-sm">
              Hozircha log yo'q — biror sahifani ochsangiz, API chaqiruvlar bu yerda ko'rinadi
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Vaqt</th>
                  <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Method</th>
                  <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Endpoint</th>
                  <th className="text-center py-2.5 px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="text-center py-2.5 px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Davom</th>
                  <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Natija</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <LogRow key={e.id} entry={e} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
