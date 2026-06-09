import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Search, SlidersHorizontal, TrendingDown, TrendingUp, Users, BookOpen, Minus, GraduationCap } from 'lucide-react'
import { useMentors, useInterns } from '../hooks/useQueries'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import MentorModal from '../components/MentorModal'
import type { Mentor, MentorGrade } from '../types'

const STUDENT_GOOD = 25

// Grade is evaluated on a 6-month cycle. Easy to change here when a new cycle
// starts. Current cycle: 1 Apr 2026 → 1 Oct 2026.
const CYCLE_START = new Date('2026-04-01')
const CYCLE_MONTHS = 6

// Whole months elapsed since the cycle start, clamped to 0..CYCLE_MONTHS.
function getMonthsElapsed(): number {
  const now = new Date()
  const months = Math.floor((now.getTime() - CYCLE_START.getTime()) / (30.44 * 24 * 60 * 60 * 1000))
  return Math.max(0, Math.min(CYCLE_MONTHS, months))
}

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

type GradeRec = 'up' | 'stay' | 'down'

// Grade recommendation thresholds (intern percentage of total students).
// < 7% → grade should go down; 7–12% → stays; > 12% → should go up.
function getGradeRec(internPct: number): GradeRec {
  if (internPct < 7) return 'down'
  if (internPct > 12) return 'up'
  return 'stay'
}

const gradeRecConfig: Record<GradeRec, { badgeClass: string; Icon: typeof TrendingUp; labelKey: string }> = {
  up: {
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
    Icon: TrendingUp,
    labelKey: 'mentors.gradeUp',
  },
  stay: {
    badgeClass: 'bg-slate-500/15 text-slate-400 border border-slate-500/20',
    Icon: Minus,
    labelKey: 'mentors.gradeStay',
  },
  down: {
    badgeClass: 'bg-red-500/15 text-red-300 border border-red-500/25',
    Icon: TrendingDown,
    labelKey: 'mentors.gradeDown',
  },
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

function MentorCard({
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

  // Grade recommendation: only when intern count is matched (a real number, not
  // "—"/null) AND the mentor actually has students. Pure indicator — does not
  // change the real grade.
  const showGradeRec = internCount !== null && mentor.studentCount > 0
  const internPct = showGradeRec ? (internCount / mentor.studentCount) * 100 : 0
  const gradeRec = showGradeRec ? getGradeRec(internPct) : null
  const recCfg = gradeRec ? gradeRecConfig[gradeRec] : null
  const monthsElapsed = getMonthsElapsed()

  // Required intern counts derived from the grade thresholds (7% / >12%):
  // - needToStay: minimum interns so the grade does NOT drop (≥7%).
  // - needToUp:   minimum interns so the grade can go UP (>12%).
  const needToStay = showGradeRec ? Math.ceil(mentor.studentCount * 0.07) : 0
  const needToUp = showGradeRec ? Math.floor(mentor.studentCount * 0.12) + 1 : 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`rounded-2xl p-5 cursor-pointer transition-all duration-200 animate-slide-up select-none outline-none [-webkit-tap-highlight-color:transparent] ${cfg.cardClass}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${cfg.avatarBg} ${cfg.avatarText}`}>
            {mentor.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-200 text-sm leading-tight">{mentor.name}</h3>
              <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badgeClass}`}>
                <Icon size={9} />
                {tierLabel}
              </span>
            </div>
            <p className="text-slate-600 text-xs mt-0.5">{mentor.branch}</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${gradeBadgeMap[mentor.grade]}`}>
          {gradeLabelMap[mentor.grade]}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-1.5 mb-4">
        <div className="bg-white/[0.03] rounded-xl px-1.5 py-2.5 text-center min-w-0">
          <BookOpen size={11} className="text-violet-400 mx-auto mb-1" />
          <p className="text-violet-400 font-bold text-lg leading-none">{mentor.groupCount}</p>
          <p className="text-slate-500 text-[11px] leading-tight mt-1">{t('mentors.groups')}</p>
        </div>
        <div className="bg-white/[0.03] rounded-xl px-1.5 py-2.5 text-center min-w-0">
          <Users size={11} className={`${cfg.countColor} mx-auto mb-1`} />
          <p className={`font-bold text-lg leading-none ${cfg.countColor}`}>{mentor.studentCount}</p>
          <p className="text-slate-500 text-[11px] leading-tight mt-1">{t('mentors.students')}</p>
        </div>
        <div
          role={internCount !== null ? 'button' : undefined}
          tabIndex={internCount !== null ? 0 : undefined}
          onClick={(e) => {
            if (internCount === null) return
            e.stopPropagation()
            onOpenInterns()
          }}
          onKeyDown={(e) => {
            if (internCount === null) return
            if (e.key === 'Enter') {
              e.stopPropagation()
              onOpenInterns()
            }
          }}
          className={`bg-white/[0.03] rounded-xl px-1.5 py-2.5 text-center min-w-0 ${
            internCount !== null ? 'cursor-pointer hover:bg-white/[0.06] transition-colors' : ''
          }`}
        >
          <GraduationCap size={11} className="text-sky-400 mx-auto mb-1" />
          <p className="text-sky-400 font-bold text-lg leading-none">{internCount !== null ? internCount : '—'}</p>
          <p className="text-slate-500 text-[11px] leading-tight mt-1">{t('mentors.interns')}</p>
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-slate-600 text-xs">{t('mentors.workload', { limit: STUDENT_GOOD })}</span>
          <span className={`text-xs font-semibold ${cfg.countColor}`}>
            {mentor.studentCount}/{STUDENT_GOOD}
          </span>
        </div>
        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${cfg.progressClass}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {mentor.trend === 'down' && mentor.prevStudentCount !== null && (
          <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
            <TrendingDown size={10} />
            {t('mentors.decreased', { count: mentor.prevStudentCount - mentor.studentCount })}
          </p>
        )}
      </div>

      {/* Grade recommendation (indicator only) */}
      {recCfg && gradeRec && (
        <div className="mt-4 pt-3 border-t border-white/[0.06]">
          <span
            title={t('mentors.gradeRec')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full w-fit ${recCfg.badgeClass}`}
          >
            <recCfg.Icon size={11} />
            {internPct.toFixed(1)}% · {t(recCfg.labelKey)} · {t('mentors.cycleProgress', { elapsed: monthsElapsed, total: CYCLE_MONTHS })}
          </span>
          <p className="text-slate-400 text-[11px] leading-snug mt-2">
            {t('mentors.now')} {internCount} · {t('mentors.needToStay')} ≥{needToStay} · {t('mentors.needToUp')} ≥{needToUp}
          </p>
        </div>
      )}
    </div>
  )
}

// Normalize a name for cross-system matching. The same mentor can be written
// differently across Mars and int-server, e.g. "Ibrohim Tolqinov" vs
// "Ibrohim To'lqinov". We lowercase, strip every apostrophe variant, and drop
// all non-alphanumeric characters so only letters/digits remain. Result:
// "Ibrohim To'lqinov" → "ibrohimtolqinov" === "Ibrohim Tolqinov" → match.
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    // Remove Uzbek/ASCII apostrophe + accent variants outright (so they don't
    // become a separating boundary): ʻ ‘ ’ ʼ ` ´ '
    .replace(/[ʻ‘’ʼ`´']/g, '')
    // Drop everything that isn't a basic latin letter or digit (spaces, dots,
    // commas, dashes, any leftover punctuation).
    .replace(/[^a-z0-9]/g, '')
}

// Levenshtein edit distance between two strings. Used as a fuzzy fallback when
// the normalized names aren't byte-identical but clearly refer to the same
// person (e.g. "Abbosxon Xamidov" vs "Abbos Xamidov" → distance 2).
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

// Max edit distance (on normalized full names) at which a fuzzy match is still
// accepted as the same person.
const FUZZY_MAX_DISTANCE = 3

// Hand-curated map for people the fuzzy matcher can't catch — name/surname
// order swapped, or a spelling gap too large for distance ≤ 3. Keyed by
// normalized Mars name → normalized int-server name. Applied after exact/fuzzy.
const MANUAL_MAP: Record<string, string> = {
  // "Emirxan Ertan" (Mars) ↔ "Ertan Emirhan" (int) — first/last name swapped
  [normalizeName('Emirxan Ertan')]: normalizeName('Ertan Emirhan'),
  // "Islomjon Shaxobiddinov" (Mars) ↔ "Islom Shahobiddinov" (int)
  [normalizeName('Islomjon Shaxobiddinov')]: normalizeName('Islom Shahobiddinov'),
  // "Jamshidbek Saminjonov" (Mars) ↔ "Jamshid Salimjonov" (int)
  [normalizeName('Jamshidbek Saminjonov')]: normalizeName('Jamshid Salimjonov'),
}

export default function MentorsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: mentors, isLoading, isError, error, refetch } = useMentors()
  const { data: internsSummary } = useInterns()
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null)

  // Resolve each Mars mentor (by normalized name) to an int-server intern count.
  // Mars mentor IDs differ from int-server IDs, so we bridge the two systems by
  // name in three stages: EXACT (normalized equality) → FUZZY (Levenshtein ≤ 3,
  // closest int mentor, no ambiguous ties) → MANUAL (hand-curated overrides).
  const internCountByName = useMemo(() => {
    // Normalized int-server name → intern count.
    const internByNorm = new Map<string, number>()
    for (const m of internsSummary?.mentors ?? []) {
      internByNorm.set(normalizeName(m.mentorName), m.internCount)
    }
    const internNorms = Array.from(internByNorm.keys())

    const resolved = new Map<string, number>()
    for (const mentor of mentors ?? []) {
      const marsNorm = normalizeName(mentor.name)

      // 1. EXACT.
      if (internByNorm.has(marsNorm)) {
        resolved.set(marsNorm, internByNorm.get(marsNorm)!)
        continue
      }

      // 2. MANUAL override (checked before fuzzy to avoid accidental fuzzy hits).
      const manualTarget = MANUAL_MAP[marsNorm]
      if (manualTarget && internByNorm.has(manualTarget)) {
        resolved.set(marsNorm, internByNorm.get(manualTarget)!)
        continue
      }

      // 3. FUZZY: closest int mentor within FUZZY_MAX_DISTANCE. Skip ambiguous
      // ties (two int mentors equally close) to avoid false positives.
      let bestDist = FUZZY_MAX_DISTANCE + 1
      let bestNorm: string | null = null
      let tie = false
      for (const intNorm of internNorms) {
        const d = levenshtein(marsNorm, intNorm)
        if (d < bestDist) {
          bestDist = d
          bestNorm = intNorm
          tie = false
        } else if (d === bestDist) {
          tie = true
        }
      }
      if (bestNorm && bestDist <= FUZZY_MAX_DISTANCE && !tie) {
        resolved.set(marsNorm, internByNorm.get(bestNorm)!)
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((mentor) => {
            const internCount = internCountByName.get(normalizeName(mentor.name)) ?? null
            return (
              <MentorCard
                key={mentor.id}
                mentor={mentor}
                internCount={internCount}
                onClick={() => setSelectedMentor(mentor)}
                onOpenInterns={() => navigate('/interns', { state: { search: mentor.name } })}
              />
            )
          })}
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

      {selectedMentor && (
        <MentorModal mentor={selectedMentor} onClose={() => setSelectedMentor(null)} />
      )}
    </div>
  )
}
