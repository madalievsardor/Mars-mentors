import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Search, ChevronRight, AlertTriangle } from 'lucide-react'
import { useGroupsList } from '../hooks/useQueries'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import type { GroupListItem } from '../types'

function IssueBadge({ violet, unmarked }: { violet: number; unmarked: number }) {
  if (violet === 0 && unmarked === 0) return null
  return (
    <div className="flex items-center gap-1">
      {violet > 0 && (
        <span className="flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          {violet}
        </span>
      )}
      {unmarked > 0 && (
        <span className="flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-500/15 text-slate-300 border border-slate-500/25">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          {unmarked}
        </span>
      )}
    </div>
  )
}

function GroupRow({ group, index }: { group: GroupListItem; index: number }) {
  const navigate = useNavigate()
  const issueTotal = group.suspectVioletCount + group.unmarkedCount

  return (
    <tr
      onClick={() => navigate(`/attendance/group/${group.groupId}`)}
      className="group cursor-pointer hover:bg-violet-500/[0.06] transition-colors"
    >
      <td className="px-4 py-3 text-slate-600 text-sm tabular-nums">{index}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-200 text-sm font-medium">{group.groupName}</span>
          {issueTotal > 0 && (
            <IssueBadge violet={group.suspectVioletCount} unmarked={group.unmarkedCount} />
          )}
        </div>
        {group.lessonStartTime && (
          <span className="text-slate-600 text-xs">{group.lessonStartTime}</span>
        )}
      </td>
      <td className="px-4 py-3 text-slate-300 text-sm">{group.mentorName}</td>
      <td className="px-4 py-3 text-slate-400 text-sm">{group.branch || '—'}</td>
      <td className="px-4 py-3 text-slate-400 text-sm truncate max-w-[180px]">{group.category || '—'}</td>
      <td className="px-4 py-3 text-sm tabular-nums text-center">
        <span className={group.studentsCount > 0 ? 'text-indigo-300 font-semibold' : 'text-slate-600'}>
          {group.studentsCount}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        {issueTotal > 0 ? (
          <IssueBadge violet={group.suspectVioletCount} unmarked={group.unmarkedCount} />
        ) : (
          <span className="text-slate-700 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <ChevronRight size={16} className="text-slate-700 group-hover:text-violet-400 transition-colors inline-block" />
      </td>
    </tr>
  )
}

export default function GroupsPage() {
  const { data: groups, isLoading, isError, error, refetch } = useGroupsList()
  const [query, setQuery] = useState('')
  const [branchFilter, setBranchFilter] = useState('')

  const branches = useMemo(() => {
    if (!groups) return []
    return Array.from(new Set(groups.map((g) => g.branch).filter(Boolean))).sort()
  }, [groups])

  const filtered = useMemo(() => {
    if (!groups) return []
    const q = query.trim().toLowerCase()
    return groups.filter((g) => {
      const matchQ =
        !q ||
        g.groupName.toLowerCase().includes(q) ||
        g.mentorName.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q)
      const matchBranch = !branchFilter || g.branch === branchFilter
      return matchQ && matchBranch
    })
  }, [groups, query, branchFilter])

  const totalStudents = useMemo(
    () => filtered.reduce((acc, g) => acc + g.studentsCount, 0),
    [filtered],
  )

  const issueGroups = useMemo(
    () => filtered.filter((g) => g.suspectVioletCount + g.unmarkedCount > 0).length,
    [filtered],
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
          <Users size={24} className="text-indigo-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Guruhlar</h1>
          <p className="text-slate-500 text-sm mt-0.5">Barcha aktiv guruhlar va davomat holati</p>
        </div>
      </div>

      {isLoading && <LoadingSpinner message="Guruhlar yuklanmoqda..." />}
      {isError && (
        <ErrorMessage
          message={(error as Error)?.message || 'Xatolik yuz berdi'}
          onRetry={() => refetch()}
        />
      )}

      {groups && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#161b27] border border-white/[0.07] rounded-xl px-4 py-3">
              <p className="text-slate-500 text-xs mb-1">Jami guruhlar</p>
              <p className="text-2xl font-bold text-white">{filtered.length}</p>
            </div>
            <div className="bg-[#161b27] border border-white/[0.07] rounded-xl px-4 py-3">
              <p className="text-slate-500 text-xs mb-1">O'quvchilar</p>
              <p className="text-2xl font-bold text-indigo-300">{totalStudents}</p>
            </div>
            <div className="bg-[#161b27] border border-white/[0.07] rounded-xl px-4 py-3">
              <p className="text-slate-500 text-xs mb-1">Filiallar</p>
              <p className="text-2xl font-bold text-white">{branches.length}</p>
            </div>
            <div className="bg-[#161b27] border border-white/[0.07] rounded-xl px-4 py-3">
              <p className="text-slate-500 text-xs mb-1">Davomat muammo</p>
              <p className={`text-2xl font-bold ${issueGroups > 0 ? 'text-violet-300' : 'text-slate-600'}`}>
                {issueGroups}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Guruh, mentor yoki kurs bo'yicha..."
                className="w-full bg-[#161b27] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-[#161b27] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-violet-500/50"
            >
              <option value="">Barcha filiallar</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-[#161b27] border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 w-10">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Guruh</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Mentor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 hidden sm:table-cell">Filial</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 hidden md:table-cell">Kurs</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-600">O'quvchi</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-600">Davomat</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-600 text-sm">
                        Guruh topilmadi
                      </td>
                    </tr>
                  ) : (
                    filtered.map((g, i) => (
                      <GroupRow key={g.groupId} group={g} index={i + 1} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {issueGroups > 0 && (
            <p className="text-xs text-slate-600 flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-violet-400" />
              Binafsha = davomat olinmagan kun; kulrang = belgilanmagan o'quvchi
            </p>
          )}
        </>
      )}
    </div>
  )
}
