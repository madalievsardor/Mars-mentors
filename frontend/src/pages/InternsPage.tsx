import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GraduationCap,
  Users,
  UserCheck,
  UserX,
  UserMinus,
  Search,
  RefreshCw,
  ChevronDown,
  Building2,
  X,
  CalendarClock,
  CalendarCheck,
  BookOpenCheck,
  Flame,
  Phone,
  Send,
  AtSign,
  Award,
  Gift,
  AlertTriangle,
  Crown,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useInterns, useInternDetail, useMentors } from '../hooks/useQueries'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '../hooks/useQueries'
import StatCard from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import {
  getGradeRec,
  getMonthsElapsed,
  needToStay,
  needToUp,
  resolveName,
  normalizeName,
  CYCLE_MONTHS,
  type GradeRec,
} from '../utils/grade'
import type { MentorInterns, InternDetail } from '../types'

// Grade-recommendation badge styling (intern % of total students). Mirrors the
// indicator that used to live on the Mentors page; pure indicator, does not
// change the real grade.
const GRADE_REC_CONFIG: Record<GradeRec, { badgeClass: string; Icon: typeof TrendingUp; labelKey: string }> = {
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

// Grade → colour. Keys are the int-server camelCase grade ids.
const GRADE_STYLE: Record<string, string> = {
  junior: 'bg-sky-500/15 text-sky-300 border border-sky-500/25',
  strongJunior: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25',
  middle: 'bg-amber-500/15 text-amber-300 border border-amber-500/25',
  strongMiddle: 'bg-orange-500/15 text-orange-300 border border-orange-500/25',
  senior: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
  unknown: 'bg-slate-500/15 text-slate-300 border border-slate-500/25',
}

const GRADE_LABEL: Record<string, string> = {
  junior: 'Junior',
  strongJunior: 'Strong Jr',
  middle: 'Middle',
  strongMiddle: 'Strong Mid',
  senior: 'Senior',
  unknown: '—',
}

function gradeChip(grade: string) {
  return GRADE_STYLE[grade] ?? GRADE_STYLE.unknown
}

// Status → small dot colour (active=green, frozen=cold blue, archived/unknown=grey).
const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-400',
  frozen: 'bg-sky-400',
  archived: 'bg-slate-500',
  unknown: 'bg-slate-600',
}

function statusDot(status: string) {
  return STATUS_DOT[status] ?? STATUS_DOT.unknown
}

// The status filter options, in display order. 'all' means no filtering.
const STATUS_FILTERS = ['all', 'active', 'frozen', 'archived'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

// Mentor-presence filter: which mentors to list by their intern count.
const MENTOR_FILTERS = ['with', 'without', 'all'] as const
type MentorFilter = (typeof MENTOR_FILTERS)[number]

function MentorRow({
  mentor,
  studentCount,
  onSelect,
}: {
  mentor: MentorInterns
  // Mars student count matched by name, or null when this int-server mentor
  // can't be bridged to a Mars mentor (then no grade recommendation is shown).
  studentCount: number | null
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  // Heat: more interns → warmer left border; zero interns → neutral grey.
  const heat =
    mentor.internCount === 0
      ? 'border-l-slate-600'
      : mentor.internCount >= 10
        ? 'border-l-red-500'
        : mentor.internCount >= 6
          ? 'border-l-amber-500'
          : 'border-l-emerald-500'

  // Grade recommendation: only when a Mars student count is matched and > 0.
  const showGradeRec = studentCount !== null && studentCount > 0
  const internPct = showGradeRec ? (mentor.internCount / studentCount) * 100 : 0
  const gradeRec = showGradeRec ? getGradeRec(internPct) : null
  const recCfg = gradeRec ? GRADE_REC_CONFIG[gradeRec] : null
  const monthsElapsed = getMonthsElapsed()
  const stayCount = showGradeRec ? needToStay(studentCount) : 0
  const upCount = showGradeRec ? needToUp(studentCount) : 0

  return (
    <div className={`bg-[#161b27] border border-white/[0.06] border-l-2 ${heat} rounded-2xl overflow-hidden`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-sm font-bold flex-shrink-0">
          {mentor.mentorName.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-200 text-sm truncate">{mentor.mentorName}</p>
          <div className="flex items-center gap-1.5 mt-0.5 text-slate-500 text-xs">
            <Building2 size={11} />
            <span className="truncate">{mentor.branches.join(', ') || '—'}</span>
          </div>
        </div>

        {/* Grade breakdown chips */}
        <div className="hidden sm:flex items-center gap-1.5">
          {Object.entries(mentor.gradeBreakdown).map(([g, c]) => (
            <span key={g} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${gradeChip(g)}`}>
              {GRADE_LABEL[g] ?? g} {c}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {mentor.internCount === 0 ? (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/25">
              {t('interns.noInterns')}
            </span>
          ) : (
            <>
              <span className="text-2xl font-bold text-white tabular-nums">{mentor.internCount}</span>
              <span className="text-slate-600 text-xs">{t('interns.interns')}</span>
            </>
          )}
          <ChevronDown size={16} className={`text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Grade recommendation (indicator only) — shown when the int-server mentor
          is bridged by name to a Mars mentor with students. */}
      {recCfg && gradeRec && (
        <div className="px-4 pb-3.5 -mt-1.5 flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-1.5">
          <span
            title={t('mentors.gradeRec')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full w-fit ${recCfg.badgeClass}`}
          >
            <recCfg.Icon size={11} />
            {internPct.toFixed(1)}% · {t(recCfg.labelKey)} · {t('mentors.cycleProgress', { elapsed: monthsElapsed, total: CYCLE_MONTHS })}
          </span>
          <p className="text-slate-500 text-[11px] leading-snug">
            {t('mentors.now')} {mentor.internCount} · {t('mentors.needToStay')} ≥{stayCount} · {t('mentors.needToUp')} ≥{upCount}
          </p>
        </div>
      )}

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.05]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            {mentor.interns.map((it) => (
              <button
                key={it.id}
                onClick={() => onSelect(it.id)}
                className="flex items-center gap-2.5 bg-white/[0.02] hover:bg-white/[0.06] rounded-xl px-3 py-2 text-left transition-colors cursor-pointer"
              >
                <div className="relative w-7 h-7 rounded-lg bg-white/[0.05] text-slate-300 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {it.name.charAt(0).toUpperCase()}
                  <span
                    title={t(`interns.status.${it.status}`, it.status)}
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#161b27] ${statusDot(it.status)}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm truncate">{it.name}</p>
                  <p className="text-slate-600 text-[11px] truncate">{it.sphere}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${gradeChip(it.grade)}`}>
                  {GRADE_LABEL[it.grade] ?? it.grade}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const map: Record<string, { cls: string; label: string }> = {
    active: { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', label: t('interns.detail.statusActive') },
    frozen: { cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30', label: t('interns.detail.statusFrozen') },
    archived: { cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30', label: t('interns.detail.statusArchived') },
  }
  const s = map[status] ?? map.active
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${s.cls}`}>
      {s.label}
    </span>
  )
}

function MetricTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'slate',
}: {
  icon: typeof CalendarClock
  label: string
  value: string
  sub?: string
  tone?: 'slate' | 'emerald' | 'amber' | 'sky'
}) {
  const toneCls: Record<string, string> = {
    slate: 'text-slate-300',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    sky: 'text-sky-300',
  }
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
        <Icon size={12} />
        <span className="truncate">{label}</span>
      </div>
      <p className={`text-lg font-bold tabular-nums ${toneCls[tone]}`}>{value}</p>
      {sub && <p className="text-slate-600 text-[11px] mt-0.5">{sub}</p>}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Icon size={13} className="text-slate-600 flex-shrink-0" />
      <span className="text-slate-500 text-xs w-28 flex-shrink-0">{label}</span>
      <span className="text-slate-200 text-xs truncate">{value || '—'}</span>
    </div>
  )
}

function InternDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useInternDetail(id)

  const sinceText = (d: InternDetail) => {
    if (d.daysSinceLastLesson == null) return t('interns.detail.noLessons')
    if (d.daysSinceLastLesson === 0) return t('interns.detail.today')
    if (d.daysSinceLastLesson === 1) return t('interns.detail.yesterday')
    return t('interns.detail.daysAgo', { count: d.daysSinceLastLesson })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#161b27] border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <div className="p-10">
            <LoadingSpinner message={t('interns.detail.loading')} />
          </div>
        )}
        {isError && (
          <div className="p-8">
            <ErrorMessage message={t('interns.detail.loadError')} onRetry={() => refetch()} />
            <button onClick={onClose} className="mt-4 text-slate-500 text-sm hover:text-slate-300">
              {t('interns.detail.close')}
            </button>
          </div>
        )}
        {data && (
          <>
            {/* Header */}
            <div className="flex items-start gap-4 p-5 border-b border-white/[0.06] sticky top-0 bg-[#161b27]/95 backdrop-blur z-10">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-lg font-bold flex-shrink-0">
                {data.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white truncate">{data.name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${gradeChip(data.grade)}`}>
                    {GRADE_LABEL[data.grade] ?? data.grade}
                  </span>
                  {data.sphere && <span className="text-slate-500 text-xs">{data.sphere}</span>}
                  <StatusBadge status={data.status} />
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-slate-200 p-1 rounded-lg hover:bg-white/[0.05] transition-colors flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Attendance */}
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-2">
                  {t('interns.detail.attendance')}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <MetricTile
                    icon={CalendarCheck}
                    label={t('interns.detail.lastLesson')}
                    value={data.lastLessonDate ? fmtDate(data.lastLessonDate) : '—'}
                    tone="sky"
                  />
                  <MetricTile
                    icon={CalendarClock}
                    label={t('interns.detail.sinceLastLesson')}
                    value={sinceText(data)}
                    tone={
                      data.daysSinceLastLesson != null && data.daysSinceLastLesson > 7
                        ? 'amber'
                        : 'slate'
                    }
                  />
                  <MetricTile
                    icon={BookOpenCheck}
                    label={t('interns.detail.totalLessons')}
                    value={String(data.totalLessonsAttended)}
                    sub={`${t('interns.detail.thisMonth')}: ${data.confirmedLessonsThisMonth ?? 0}`}
                    tone="emerald"
                  />
                  <MetricTile
                    icon={Flame}
                    label={t('interns.detail.streak')}
                    value={`${data.currentStreak ?? 0} / ${data.longestStreak ?? 0}`}
                  />
                </div>
              </div>

              {/* Profile */}
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-2">
                  {t('interns.detail.profile')}
                </p>
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-2 divide-y divide-white/[0.04]">
                  <InfoRow icon={AtSign} label={t('interns.detail.username')} value={data.username ?? ''} />
                  <InfoRow icon={Phone} label={t('interns.detail.phone')} value={data.phoneNumber ?? ''} />
                  <InfoRow icon={Send} label={t('interns.detail.telegram')} value={data.telegram ?? ''} />
                  <InfoRow icon={CalendarClock} label={t('interns.detail.joinedAt')} value={fmtDate(data.dateJoined)} />
                  {data.level != null && (
                    <InfoRow icon={GraduationCap} label={t('interns.detail.level')} value={`${data.level} (XP ${data.xp ?? 0})`} />
                  )}
                  {data.score != null && (
                    <InfoRow icon={Award} label={t('interns.detail.score')} value={String(data.score)} />
                  )}
                </div>
              </div>

              {/* Mentors / branches */}
              {data.mentors.length > 0 && (
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-2">
                    {t('interns.detail.mentor')}
                  </p>
                  <div className="space-y-2">
                    {data.mentors.map((m) => (
                      <div key={m.id} className="flex items-center gap-2.5 bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-2">
                        <Building2 size={14} className="text-slate-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-200 text-sm truncate">{m.name || '—'}</p>
                          <p className="text-slate-600 text-[11px] truncate">{m.branch || '—'}</p>
                        </div>
                        {m.isHeadIntern && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                            <Crown size={10} /> {t('interns.detail.headIntern')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Plan */}
              {(data.weeklyTarget != null || data.deficit != null || data.isPlanBlocked != null) && (
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-2">
                    {t('interns.detail.plan')}
                  </p>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-slate-500 text-[11px]">{t('interns.detail.weeklyTarget')}</p>
                        <p className="text-slate-200 font-bold tabular-nums">{data.weeklyTarget ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-[11px]">{t('interns.detail.requiredByNow')}</p>
                        <p className="text-slate-200 font-bold tabular-nums">{data.requiredLessonsByNow ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-[11px]">{t('interns.detail.deficit')}</p>
                        <p className={`font-bold tabular-nums ${(data.deficit ?? 0) > 0 ? 'text-red-400' : 'text-emerald-300'}`}>
                          {data.deficit ?? '—'}
                        </p>
                      </div>
                    </div>
                    {data.isPlanBlocked && (
                      <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-1">
                        <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-red-300 text-xs font-semibold">{t('interns.detail.planBlocked')}</p>
                          {data.reason && <p className="text-red-400/80 text-[11px] mt-0.5">{data.reason}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Badges & bonus */}
              {(data.badgeCount > 0 || data.bonusLessonCount > 0) && (
                <div className="flex gap-2.5">
                  {data.badgeCount > 0 && (
                    <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
                      <Award size={14} className="text-amber-300" />
                      <span className="text-slate-300 text-sm">
                        {data.badgeCount} {t('interns.detail.badges')}
                      </span>
                    </div>
                  )}
                  {data.bonusLessonCount > 0 && (
                    <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
                      <Gift size={14} className="text-emerald-300" />
                      <span className="text-slate-300 text-sm">
                        {data.bonusLessonCount} {t('interns.detail.bonusLessons')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function InternsPage() {
  const { t } = useTranslation()
  const { data, isLoading, isError, error, refetch } = useInterns()
  const { data: marsMentors } = useMentors()
  const [selectedInternId, setSelectedInternId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  // When navigated here from a mentor card (Mentors page), pre-fill the search.
  const location = useLocation()
  const initialSearch =
    (location.state as { search?: string } | null)?.search ?? ''
  const [query, setQuery] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [mentorFilter, setMentorFilter] = useState<MentorFilter>('with')
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  // Unique, sorted list of branches across all mentors (drop empty strings).
  const branches = useMemo(() => {
    if (!data) return []
    const set = new Set<string>()
    for (const m of data.mentors) {
      for (const b of m.branches) {
        const name = (b ?? '').trim()
        if (name) set.add(name)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [data])

  // Bridge each int-server mentor (by normalized name) to a Mars mentor's student
  // count, so we can compute the grade recommendation (interns / students).
  // EXACT → MANUAL → FUZZY ≤ 3, mirroring the Mentors page. Keyed by normalized
  // int-server mentor name → Mars student count.
  const studentCountByName = useMemo(() => {
    const studentByNorm = new Map<string, number>()
    for (const m of marsMentors ?? []) {
      studentByNorm.set(normalizeName(m.name), m.studentCount)
    }
    const marsNorms = Array.from(studentByNorm.keys())

    const resolved = new Map<string, number>()
    for (const m of data?.mentors ?? []) {
      const matched = resolveName(m.mentorName, marsNorms)
      if (matched !== null) {
        resolved.set(normalizeName(m.mentorName), studentByNorm.get(matched)!)
      }
    }
    return resolved
  }, [marsMentors, data])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interns })
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()

    let rows = data.mentors
    if (q) rows = rows.filter((m) => m.mentorName.toLowerCase().includes(q))

    // Branch filter: keep only mentors that belong to the chosen branch.
    if (branchFilter !== 'all') {
      rows = rows.filter((m) => m.branches.some((b) => (b ?? '').trim() === branchFilter))
    }

    // Split: mentors that have interns vs. zero-intern mentors. The status filter
    // only makes sense for mentors with interns; zero-intern mentors have no
    // interns to match, so they bypass it entirely.
    let withInterns = rows.filter((m) => m.internCount > 0)
    const withoutInterns = rows.filter((m) => m.internCount === 0)

    // Status filter: keep only interns matching the chosen status, recompute the
    // mentor's count/grade chips from what remains, and drop mentors left empty.
    if (statusFilter !== 'all') {
      withInterns = withInterns
        .map((m) => {
          const interns = m.interns.filter((it) => it.status === statusFilter)
          const gradeBreakdown: Record<string, number> = {}
          for (const it of interns) {
            gradeBreakdown[it.grade] = (gradeBreakdown[it.grade] ?? 0) + 1
          }
          return { ...m, interns, internCount: interns.length, gradeBreakdown }
        })
        .filter((m) => m.internCount > 0)
    }

    // Mentor-presence select: only-with (default), only-without, or all.
    if (mentorFilter === 'without') return withoutInterns
    if (mentorFilter === 'all') return [...withInterns, ...withoutInterns]
    return withInterns
  }, [data, query, statusFilter, mentorFilter, branchFilter])

  // Per-status totals for the filter buttons (whole dataset, ignores search).
  const statusCounts = useMemo<Record<string, number>>(
    () => data?.statusDistribution ?? {},
    [data],
  )
  const totalStatusCount = useMemo(
    () => Object.values(statusCounts).reduce((a, b) => a + b, 0),
    [statusCounts],
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('interns.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('interns.subtitle')}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? t('interns.refreshing') : t('interns.refresh')}
        </button>
      </div>

      {/* Stats */}
      {data && (
        <div className="stats stats-vertical sm:stats-horizontal w-full bg-transparent gap-3">
          <StatCard title={t('interns.totalInterns')} value={data.totalInterns} icon={GraduationCap} color="emerald" />
          <StatCard title={t('interns.withInterns')} value={data.mentorsWithInterns} icon={UserCheck} color="blue" />
          <StatCard title={t('interns.totalMentors')} value={data.totalMentors} icon={Users} color="purple" />
          <StatCard title={t('interns.withoutInterns')} value={data.mentorsWithoutInterns} icon={UserX} color="amber" />
          <StatCard title={t('interns.unassigned')} value={data.unassignedInterns} icon={UserMinus} color="amber" />
        </div>
      )}

      {/* Grade distribution */}
      {data && (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl p-4">
          <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold mb-3">{t('interns.gradeDist')}</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.gradeDistribution)
              .sort((a, b) => b[1] - a[1])
              .map(([g, c]) => (
                <span key={g} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${gradeChip(g)}`}>
                  {GRADE_LABEL[g] ?? g}: {c}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Search */}
      {data && (
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('interns.searchPlaceholder')}
            className="w-full bg-[#161b27] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      )}

      {/* Status filter */}
      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-600 uppercase tracking-wider font-semibold mr-1">
            {t('interns.statusFilter')}
          </span>
          {STATUS_FILTERS.map((s) => {
            const active = statusFilter === s
            const count = s === 'all' ? totalStatusCount : statusCounts[s] ?? 0
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-white/[0.03] text-slate-400 border-white/[0.08] hover:bg-white/[0.06]'
                }`}
              >
                {s !== 'all' && <span className={`w-2 h-2 rounded-full ${statusDot(s)}`} />}
                {t(`interns.status.${s}`)}
                <span className={`tabular-nums ${active ? 'text-indigo-100' : 'text-slate-600'}`}>{count}</span>
              </button>
            )
          })}

          {/* Branch filter (select): all branches or one specific branch. */}
          <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            <span className="uppercase tracking-wider font-semibold text-slate-600">
              {t('interns.branchFilter')}
            </span>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-[#161b27] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
            >
              <option value="all">{t('common.allBranches')}</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          {/* Mentor-presence filter (select): with / without / all interns. */}
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <span className="uppercase tracking-wider font-semibold text-slate-600">
              {t('interns.mentorFilter')}
            </span>
            <select
              value={mentorFilter}
              onChange={(e) => setMentorFilter(e.target.value as MentorFilter)}
              className="bg-[#161b27] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
            >
              <option value="with">
                {t('interns.mentorFilterWith')} ({data.mentorsWithInterns})
              </option>
              <option value="without">
                {t('interns.mentorFilterWithout')} ({data.mentorsWithoutInterns})
              </option>
              <option value="all">
                {t('interns.mentorFilterAll')} ({data.totalMentors})
              </option>
            </select>
          </label>
        </div>
      )}

      {/* Loading & error */}
      {isLoading && <LoadingSpinner message={t('interns.loading')} />}
      {isError && (
        <ErrorMessage
          message={(error as Error)?.message || t('interns.loadError')}
          onRetry={() => refetch()}
        />
      )}

      {/* List */}
      {data && filtered.length > 0 && (
        <div className="space-y-2.5">
          {filtered.map((m) => (
            <MentorRow
              key={m.mentorId}
              mentor={m}
              studentCount={studentCountByName.get(normalizeName(m.mentorName)) ?? null}
              onSelect={setSelectedInternId}
            />
          ))}
        </div>
      )}

      {data && filtered.length === 0 && (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl flex flex-col items-center py-16 gap-3">
          <GraduationCap size={36} className="text-slate-700" />
          <p className="text-slate-600">
            {statusFilter !== 'all'
              ? t('interns.noStatusResults')
              : query
                ? t('interns.noResults')
                : t('interns.noData')}
          </p>
        </div>
      )}

      {selectedInternId && (
        <InternDetailModal id={selectedInternId} onClose={() => setSelectedInternId(null)} />
      )}
    </div>
  )
}
