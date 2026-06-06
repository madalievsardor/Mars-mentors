import { useState, useMemo } from 'react'
import { Search, SlidersHorizontal, TrendingDown, TrendingUp, Users, BookOpen, Minus } from 'lucide-react'
import { useMentors } from '../hooks/useQueries'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import MentorModal from '../components/MentorModal'
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
    badge: (
      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
        <TrendingUp size={9} />
        Yaxshi
      </span>
    ),
  },
  average: {
    cardClass: 'mentor-card-average',
    avatarBg: 'bg-amber-500/15',
    avatarText: 'text-amber-400',
    countColor: 'text-amber-400',
    progressClass: 'bg-gradient-to-r from-amber-500 to-orange-500',
    badge: (
      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
        <Minus size={9} />
        O'rtacha
      </span>
    ),
  },
  decreased: {
    cardClass: 'mentor-card-overloaded',
    avatarBg: 'bg-red-500/15',
    avatarText: 'text-red-400',
    countColor: 'text-red-400',
    progressClass: 'bg-gradient-to-r from-red-500 to-rose-500',
    badge: (
      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
        <TrendingDown size={9} />
        Kamaydi
      </span>
    ),
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

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'students-desc', label: "O'quvchilar (ko'p→kam)" },
  { value: 'students-asc', label: "O'quvchilar (kam→ko'p)" },
  { value: 'groups-desc', label: "Guruhlar (ko'p→kam)" },
  { value: 'name', label: "Ism bo'yicha (A–Z)" },
]

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

function MentorCard({ mentor, onClick }: { mentor: Mentor; onClick: () => void }) {
  const tier = getMentorTier(mentor)
  const cfg = tierConfig[tier]
  const progressPct = Math.min((mentor.studentCount / STUDENT_GOOD) * 100, 100)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`rounded-2xl p-5 cursor-pointer transition-all duration-200 animate-slide-up ${cfg.cardClass}`}
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
              {cfg.badge}
            </div>
            <p className="text-slate-600 text-xs mt-0.5">{mentor.branch}</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${gradeBadgeMap[mentor.grade]}`}>
          {gradeLabelMap[mentor.grade]}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <BookOpen size={11} className="text-violet-400 mx-auto mb-1" />
          <p className="text-violet-400 font-bold text-xl">{mentor.groupCount}</p>
          <p className="text-slate-600 text-xs">Guruhlar</p>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <Users size={11} className={`${cfg.countColor} mx-auto mb-1`} />
          <p className={`font-bold text-xl ${cfg.countColor}`}>{mentor.studentCount}</p>
          <p className="text-slate-600 text-xs">O'quvchilar</p>
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-slate-600 text-xs">Yuklama ({STUDENT_GOOD} chegara)</span>
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
            Kechagidan {mentor.prevStudentCount - mentor.studentCount} ta kamaydi
          </p>
        )}
      </div>
    </div>
  )
}

export default function MentorsPage() {
  const { data: mentors, isLoading, isError, error, refetch } = useMentors()
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [gradeFilter, setGradeFilter] = useState<MentorGrade | ''>('')
  const [sortBy, setSortBy] = useState<SortOption>('students-desc')

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
          <h1 className="text-2xl font-bold text-white">Mentorlar</h1>
          <p className="text-slate-500 text-sm mt-1">Barcha mentorlar va ularning yuklamalari</p>
        </div>
        {decreasedCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm font-medium">
            <TrendingDown size={15} />
            {decreasedCount} ta mentorda o'quvchi kamaydi
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
              placeholder="Mentor qidirish..."
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
              <option value="" className="bg-[#161b27]">Barcha filiallar</option>
              {branches.map((b) => <option key={b} value={b} className="bg-[#161b27]">{b}</option>)}
            </select>
          </div>

          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value as MentorGrade | '')}
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none cursor-pointer appearance-none"
          >
            <option value="" className="bg-[#161b27]">Barcha darajalar</option>
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
            {filtered.length} ta mentor
            {hasActiveFilters && <span className="text-indigo-400 ml-2">• Filtr qo'llanilgan</span>}
          </p>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Yaxshi: <span className="text-emerald-400 font-semibold ml-0.5">{tierCounts.good}</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              O'rtacha: <span className="text-amber-400 font-semibold ml-0.5">{tierCounts.average}</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Kamaydi: <span className="text-red-400 font-semibold ml-0.5">{tierCounts.decreased}</span>
            </span>
          </div>
        </div>
      )}

      {isLoading && <LoadingSpinner message="Mentorlar yuklanmoqda..." />}
      {isError && (
        <ErrorMessage
          message={(error as Error)?.message || "Ma'lumotlarni yuklashda xatolik"}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((mentor) => (
            <MentorCard key={mentor.id} mentor={mentor} onClick={() => setSelectedMentor(mentor)} />
          ))}
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && mentors && mentors.length > 0 && (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl flex flex-col items-center py-20 gap-3">
          <Search size={36} className="text-slate-700" />
          <p className="text-slate-500">Filtr bo'yicha mentor topilmadi</p>
          <button
            onClick={() => { setSearchQuery(''); setBranchFilter(''); setGradeFilter('') }}
            className="text-indigo-400 hover:text-indigo-300 text-sm font-medium mt-1 transition-colors"
          >
            Filtrni tozalash
          </button>
        </div>
      )}

      {!isLoading && !isError && mentors && mentors.length === 0 && (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl flex flex-col items-center py-20 gap-3">
          <Users size={36} className="text-slate-700" />
          <p className="text-slate-500">Hozircha mentorlar mavjud emas</p>
        </div>
      )}

      {selectedMentor && (
        <MentorModal mentor={selectedMentor} onClose={() => setSelectedMentor(null)} />
      )}
    </div>
  )
}
