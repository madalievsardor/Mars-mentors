import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Search, SlidersHorizontal, TrendingDown, TrendingUp, Users, Minus, GraduationCap } from 'lucide-react'
import { useMentors, useInterns } from '../hooks/useQueries'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import { normalizeName, resolveName } from '../utils/grade'
import type { Mentor, MentorGrade } from '../types'

const STUDENT_GOOD = 25

function getMentorTier(mentor: Mentor): 'good' | 'average' | 'decreased' {
  if (mentor.trend === 'down') return 'decreased'
  if (mentor.studentCount >= STUDENT_GOOD) return 'good'
  return 'average'
}

const tierConfig = {
  good: {
    cardClass: 'mentor-card-good',
    avatarBg: 'bg-emerald-500/15',
    avatarText: 'text-emerald-400',
    countColor: 'text-emerald-400',
    progressClass: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
    Icon: TrendingUp,
  },
  average: {
    cardClass: 'mentor-card-average',
    avatarBg: 'bg-amber-500/15',
    avatarText: 'text-amber-400',
    countColor: 'text-amber-400',
    progressClass: 'bg-gradient-to-r from-amber-500 to-orange-500',
    badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
    Icon: Minus,
  },
  decreased: {
    cardClass: 'mentor-card-overloaded',
    avatarBg: 'bg-red-500/15',
    avatarText: 'text-red-400',
    countColor: 'text-red-400',
    progressClass: 'bg-gradient-to-r from-red-500 to-rose-500',
    badgeClass: 'bg-red-500/15 text-red-400 border border-red-500/25',
    Icon: TrendingDown,
  },
}

const gradeLabelMap: Record<MentorGrade, string> = {
  senior: 'Senior',
  middle: 'Middle',
  junior: 'Junior',
}

const gradeBadgeMap: Record<MentorGrade, string> = {
  senior: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  middle: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25',
  junior: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
}

type SortOption = 'students-desc' | 'students-asc' | 'name' | 'groups-desc'

function sortMentors(mentors: Mentor[], sort: SortOption): Mentor[] {
  return [...mentors].sort((a, b) => {
    switch (sort) {
      case 'students-desc': return b.studentCount - a.studentCount
      case 'students-asc': return a.studentCount - b.studentCount
      case 'groups-desc': return b.groupCount - a.groupCount
      case 'name': return a.name.localeCompare(b.name)
      default: return 0
    }
  })
}

function MentorRow({
  mentor,
  internCount,
  onClick,
  onOpenInterns,
}: {
  mentor: Mentor
  internCount: number | null
  onClick: () => void
  onOpenInterns: () => void
}) {
  const { t } = useTranslation()
  const tier = getMentorTier(mentor)
  const cfg = tierConfig[tier]
  const progressPct = Math.min((mentor.studentCount / STUDENT_GOOD) * 100, 100)
  const { Icon } = cfg

  const tierLabel =
    tier === 'good'
      ? t('mentors.tierGood')
      : tier === 'average'
      ? t('mentors.tierAverage')
      : t('mentors.tierDecreased')

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="border-b border-white/[0.05] cursor-pointer transition-colors hover:bg-white/[0.03] focus:bg-white/[0.04] outline-none select-none [-webkit-tap-highlight-color:transparent]"
    >
      {/* Mentor */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${cfg.avatarBg} ${cfg.avatarText}`}>
            {mentor.name.charAt(0)}
          </div>
          <span className="font-semibold text-slate-200 text-sm leading-tight whitespace-nowrap">{mentor.name}</span>
        </div>
      </td>

      {/* Branch */}
      <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{mentor.branch}</td>

      {/* Grade */}
      <td className="px-4 py-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${gradeBadgeMap[mentor.grade]}`}>
          {gradeLabelMap[mentor.grade]}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cfg.badgeClass}`}>
          <Icon size={10} />
          {tierLabel}
        </span>
      </td>

      {/* Groups */}
      <td className="px-4 py-3 text-center">
        <span className="text-violet-400 font-bold text-sm">{mentor.groupCount}</span>
      </td>

      {/* Students */}
      <td className="px-4 py-3 text-center">
        <span className={`font-bold text-sm ${cfg.countColor}`}>{mentor.studentCount}</span>
      </td>

      {/* Interns */}
      <td className="px-4 py-3 text-center">
        {internCount !== null ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onOpenInterns()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation()
                onOpenInterns()
              }
            }}
            className="inline-flex items-center gap-1 text-sky-400 font-bold text-sm cursor-pointer hover:text-sky-300 transition-colors"
          >
            <GraduationCap size={12} />
            {internCount}
          </span>
        ) : (
          <span className="text-slate-600 text-sm">—</span>
        )}
      </td>

      {/* Workload */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${cfg.progressClass}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className={`text-xs font-semibold whitespace-nowrap ${cfg.countColor}`}>
            {mentor.studentCount}/{STUDENT_GOOD}
          </span>
        </div>
      </td>
    </tr>
  )
}

export default function MentorsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: mentors, isLoading, isError, error, refetch } = useMentors()
  const { data: internsSummary } = useInterns()
  // Resolve each Mars mentor (by normalized name) to an int-server intern count.
  // Mars mentor IDs differ from int-server IDs, so we bridge the two systems by
  // name via the shared resolver (EXACT → MANUAL → FUZZY ≤ 3).
  const internCountByName = useMemo(() => {
    // Normalized int-server name → intern count.
    const internByNorm = new Map<string, number>()
    for (const m of internsSummary?.mentors ?? []) {
      internByNorm.set(normalizeName(m.mentorName), m.internCount)
    }
    const internNorms = Array.from(internByNorm.keys())

    const resolved = new Map<string, number>()
    for (const mentor of mentors ?? []) {
      const matched = resolveName(mentor.name, internNorms)
      if (matched !== null) {
        resolved.set(normalizeName(mentor.name), internByNorm.get(matched)!)
      }
    }
    return resolved
  }, [internsSummary, mentors])
  const [searchQuery, setSearchQuery] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState<MentorGrade | ''>('')
  const [sortBy, setSortBy] = useState<SortOption>('students-desc')

  const sortOptions: { value: SortOption; label: string }[] = useMemo(() => [
    { value: 'students-desc', label: t('mentors.sortStudentsDesc') },
    { value: 'students-asc', label: t('mentors.sortStudentsAsc') },
    { value: 'groups-desc', label: t('mentors.sortGroupsDesc') },
    { value: 'name', label: t('mentors.sortByName') },
  ], [t])

  const branches = useMemo(
    () => Array.from(new Set(mentors?.map((m) => m.branch) ?? [])).sort(),
    [mentors],
  )

  const filtered = useMemo(() => {
    if (!mentors) return []
    let result = mentors
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (m) => m.name.toLowerCase().includes(q) || m.branch.toLowerCase().includes(q),
      )
    }
    if (branchFilter) result = result.filter((m) => m.branch === branchFilter)
    if (gradeFilter) result = result.filter((m) => m.grade === gradeFilter)
    return sortMentors(result, sortBy)
  }, [mentors, searchQuery, branchFilter, gradeFilter, sortBy])

  const decreasedCount = mentors?.filter((m) => m.trend === 'down').length ?? 0
  const hasActiveFilters = Boolean(searchQuery || branchFilter || gradeFilter)

  const tierCounts = useMemo(() => ({
    good: filtered.filter((m) => getMentorTier(m) === 'good').length,
    average: filtered.filter((m) => getMentorTier(m) === 'average').length,
    decreased: filtered.filter((m) => getMentorTier(m) === 'decreased').length,
  }), [filtered])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('mentors.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('mentors.subtitle')}</p>
        </div>
        {decreasedCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm font-medium">
            <TrendingDown size={15} />
            {t('mentors.decreasedAlert', { count: decreasedCount })}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
            <Search size={14} className="text-slate-600 flex-shrink-0" />
            <input
              type="text"
              placeholder={t('mentors.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="grow text-sm bg-transparent text-slate-300 placeholder-slate-600 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
            <SlidersHorizontal size={14} className="text-slate-600 flex-shrink-0" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="grow bg-transparent text-sm text-slate-300 focus:outline-none cursor-pointer appearance-none"
            >
              <option value="" className="bg-[#161b27]">{t('mentors.allBranches')}</option>
              {branches.map((b) => <option key={b} value={b} className="bg-[#161b27]">{b}</option>)}
            </select>
          </div>

          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value as MentorGrade | '')}
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none cursor-pointer appearance-none"
          >
            <option value="" className="bg-[#161b27]">{t('mentors.allGrades')}</option>
            <option value="senior" className="bg-[#161b27]">Senior</option>
            <option value="middle" className="bg-[#161b27]">Middle</option>
            <option value="junior" className="bg-[#161b27]">Junior</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none cursor-pointer appearance-none"
          >
            {sortOptions.map((o) => <option key={o.value} value={o.value} className="bg-[#161b27]">{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Summary bar */}
      {mentors && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-slate-500 text-sm">
            {t('mentors.mentorCount', { count: filtered.length })}
            {hasActiveFilters && <span className="text-indigo-400 ml-2">• {t('mentors.filterApplied')}</span>}
          </p>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {t('mentors.tierGood')}: <span className="text-emerald-400 font-semibold ml-0.5">{tierCounts.good}</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {t('mentors.tierAverage')}: <span className="text-amber-400 font-semibold ml-0.5">{tierCounts.average}</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {t('mentors.tierDecreased')}: <span className="text-red-400 font-semibold ml-0.5">{tierCounts.decreased}</span>
            </span>
          </div>
        </div>
      )}

      {isLoading && <LoadingSpinner message={t('mentors.loading')} />}
      {isError && (
        <ErrorMessage
          message={(error as Error)?.message || t('mentors.loadError')}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl overflow-hidden animate-slide-up">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0d1117] sticky top-0 z-10 border-b border-white/[0.08]">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{t('mentors.colMentor')}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{t('mentors.colBranch')}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{t('mentors.colGrade')}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{t('mentors.colStatus')}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center whitespace-nowrap">{t('mentors.colGroups')}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center whitespace-nowrap">{t('mentors.colStudents')}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center whitespace-nowrap">{t('mentors.colInterns')}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{t('mentors.colWorkload')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((mentor) => {
                  const internCount = internCountByName.get(normalizeName(mentor.name)) ?? null
                  return (
                    <MentorRow
                      key={mentor.id}
                      mentor={mentor}
                      internCount={internCount}
                      onClick={() => navigate(`/mentors/${mentor.id}`)}
                      onOpenInterns={() => navigate('/interns', { state: { search: mentor.name } })}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && mentors && mentors.length > 0 && (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl flex flex-col items-center py-20 gap-3">
          <Search size={36} className="text-slate-700" />
          <p className="text-slate-500">{t('mentors.noResults')}</p>
          <button
            onClick={() => { setSearchQuery(''); setBranchFilter(''); setGradeFilter('') }}
            className="text-indigo-400 hover:text-indigo-300 text-sm font-medium mt-1 transition-colors"
          >
            {t('mentors.clearFilter')}
          </button>
        </div>
      )}

      {!isLoading && !isError && mentors && mentors.length === 0 && (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl flex flex-col items-center py-20 gap-3">
          <Users size={36} className="text-slate-700" />
          <p className="text-slate-500">{t('mentors.noMentors')}</p>
        </div>
      )}

    </div>
  )
}
