import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Search, RefreshCw, Building2, Clock, BookOpen, UserCheck } from 'lucide-react'
import { getNaborGroups } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'

const DAYS_LABEL: Record<number, string> = {
  1: 'Du-Chor-Jum',
  2: 'Se-Pay-Shan',
}

function useNaborGroups() {
  return useQuery({
    queryKey: ['nabor'],
    queryFn: getNaborGroups,
    staleTime: 3 * 60 * 1000,
  })
}

export default function NaborPage() {
  const { data, isLoading, isError, refetch, isFetching } = useNaborGroups()
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('')

  const branches = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.map((g) => g.branch).filter(Boolean))) as string[]
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.filter((g) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        g.name.toLowerCase().includes(q) ||
        (g.mentor ?? '').toLowerCase().includes(q) ||
        (g.category ?? '').toLowerCase().includes(q)
      const matchBranch = !branchFilter || g.branch === branchFilter
      return matchSearch && matchBranch
    })
  }, [data, search, branchFilter])

  const totalStudents = useMemo(
    () => filtered.reduce((s, g) => s + g.studentsCount, 0),
    [filtered],
  )

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Nabor guruhlar</h1>
          <p className="text-slate-500 text-sm mt-1">Hozirda ro'yxatga olish ochiq guruhlar</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-slate-300 text-sm font-medium hover:bg-white/[0.08] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
          {isFetching ? 'Yuklanmoqda...' : 'Yangilash'}
        </button>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-[#161b27] border border-white/[0.06] rounded-xl p-4">
            <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Guruhlar</p>
            <p className="text-2xl font-bold text-white">{filtered.length}</p>
          </div>
          <div className="bg-[#161b27] border border-white/[0.06] rounded-xl p-4">
            <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Talabalar</p>
            <p className="text-2xl font-bold text-emerald-400">{totalStudents}</p>
          </div>
          <div className="bg-[#161b27] border border-white/[0.06] rounded-xl p-4">
            <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Mentorlar</p>
            <p className="text-2xl font-bold text-indigo-400">
              {new Set(filtered.map((g) => g.mentorId).filter(Boolean)).size}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Guruh, mentor, kurs..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#161b27] border border-white/[0.08] text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#161b27] border border-white/[0.08] text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50"
        >
          <option value="">Barcha filiallar</option>
          {branches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {isLoading && <LoadingSpinner message="Nabor guruhlar yuklanmoqda..." />}
      {isError && <ErrorMessage message="Ma'lumot yuklab bo'lmadi" onRetry={() => refetch()} />}

      {data && filtered.length === 0 && (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl flex flex-col items-center py-16 gap-2">
          <Users size={28} className="text-slate-700" />
          <p className="text-slate-600 text-sm">Hech narsa topilmadi</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-600 w-10">#</th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-600">Guruh</th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-600">Mentor</th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-600">Filial</th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-600">Kurs</th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-600">Vaqt</th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-600">Talabalar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g, i) => (
                <tr
                  key={g.id}
                  className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3 text-slate-600 text-xs tabular-nums text-right">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2 py-0.5 text-xs font-bold text-indigo-300">
                        <BookOpen size={11} />
                        {g.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-slate-300">
                      <UserCheck size={13} className="text-slate-600 flex-shrink-0" />
                      {g.mentor ?? <span className="text-slate-600">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-slate-400">
                      <Building2 size={12} className="text-slate-600 flex-shrink-0" />
                      {g.branch ?? '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {g.category ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-xs text-emerald-300 font-medium tabular-nums">
                        <Clock size={11} />
                        {g.lessonStart.slice(0, 5)}–{g.lessonEnd.slice(0, 5)}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {DAYS_LABEL[g.days] ?? `${g.days}-kun`}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold tabular-nums ${g.studentsCount > 0 ? 'text-amber-300' : 'text-slate-600'}`}>
                      {g.studentsCount > 0 ? g.studentsCount : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
