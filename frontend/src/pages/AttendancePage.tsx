import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CalendarCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  Building2,
  ChevronDown,
  ChevronRight,
  Check,
  Users,
  CircleHelp,
} from 'lucide-react'
import {
  useAttendanceOverview,
  useRefreshAttendanceOverview,
} from '../hooks/useQueries'
import StatCard from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import type { GroupIssueSummary, MentorAttendanceIssues } from '../types'

function fmtDay(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}.${m}`
}

function IssueBadges({
  violet,
  unmarked,
  big = false,
}: {
  violet: number
  unmarked: number
  big?: boolean
}) {
  const sz = big ? 'text-sm px-2.5 py-1' : 'text-[11px] px-2 py-0.5'
  return (
    <div className="flex items-center gap-1.5">
      {violet > 0 && (
        <span
          className={`flex items-center gap-1.5 font-bold rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25 ${sz}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          {violet}
        </span>
      )}
      {unmarked > 0 && (
        <span
          className={`flex items-center gap-1.5 font-bold rounded-full bg-slate-500/15 text-slate-300 border border-slate-500/25 ${sz}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          {unmarked}
        </span>
      )}
    </div>
  )
}

function GroupRow({ group }: { group: GroupIssueSummary }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/attendance/group/${group.groupId}`)}
      className="w-full flex items-center justify-between gap-3 bg-white/[0.02] hover:bg-violet-500/[0.08] border border-white/[0.05] hover:border-violet-500/25 rounded-xl px-3.5 py-3 text-left transition-all"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
          <CalendarCheck size={14} className="text-violet-300" />
        </div>
        <div className="min-w-0">
          <p className="text-slate-200 text-sm font-medium truncate">{group.groupName}</p>
          <p className="text-slate-600 text-[11px] truncate">
            {group.branch} · {t('attendance.lastLesson')}:{' '}
            {group.lastLessonDate ? fmtDay(group.lastLessonDate) : '—'} ·{' '}
            {t('attendance.activeCount', { count: group.activeStudents })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <IssueBadges violet={group.suspectVioletCount} unmarked={group.unmarkedCount} />
        <ChevronRight size={16} className="text-slate-600" />
      </div>
    </button>
  )
}

function MentorCard({
  mentor,
  defaultOpen,
}: {
  mentor: MentorAttendanceIssues
  defaultOpen: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-gradient-to-br from-[#171c29] to-[#14182340] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-violet-500/25 transition-all">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 p-4 text-left transition-colors"
      >
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-500/20 border border-violet-500/20 text-violet-200 flex items-center justify-center text-base font-bold flex-shrink-0">
          {mentor.mentorName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-100 text-sm truncate">{mentor.mentorName}</p>
          <div className="flex items-center gap-1.5 mt-0.5 text-slate-500 text-xs">
            <Building2 size={11} />
            <span className="truncate">{mentor.branch || '—'}</span>
            <span className="text-slate-700">·</span>
            <span>{t('attendance.groupCount', { count: mentor.groups.length })}</span>
          </div>
        </div>
        <IssueBadges
          violet={mentor.totalSuspectViolet}
          unmarked={mentor.totalUnmarked}
          big
        />
        <ChevronDown
          size={16}
          className={`text-slate-600 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-2">
          {mentor.groups.map((g) => (
            <GroupRow key={g.groupId} group={g} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AttendancePage() {
  const { t } = useTranslation()
  const { data, isLoading, isError, error, refetch } = useAttendanceOverview()
  const refreshMutation = useRefreshAttendanceOverview()
  const [query, setQuery] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    if (!q) return data.mentors
    return data.mentors.filter((m) => m.mentorName.toLowerCase().includes(q))
  }, [data, query])

  const refreshing = refreshMutation.isPending

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <CalendarCheck size={24} className="text-violet-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('attendance.title')}</h1>
            <p className="text-slate-500 text-sm mt-0.5">{t('attendance.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 text-white text-sm font-medium transition-all shadow-lg shadow-violet-500/25"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? t('attendance.refreshing') : t('attendance.refresh')}
        </button>
      </div>

      {/* Loading / error */}
      {isLoading && <LoadingSpinner message={t('attendance.scanning')} />}
      {isError && (
        <ErrorMessage
          message={(error as Error)?.message || t('attendance.loadError')}
          onRetry={() => refetch()}
        />
      )}

      {data && !data.available && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl px-4 py-3.5">
          <AlertTriangle size={16} className="text-amber-300 flex-shrink-0" />
          <p className="text-amber-200 text-sm">{t('attendance.unavailable')}</p>
        </div>
      )}

      {data && data.available && (
        <>
          {/* Stats */}
          <div className="stats stats-vertical sm:stats-horizontal w-full bg-transparent gap-3">
            <StatCard title={t('attendance.statMentors')} value={data.totalMentorsWithIssues} icon={Users} color="purple" />
            <StatCard title={t('attendance.statViolet')} value={data.totalSuspectViolet} icon={AlertTriangle} color="purple" />
            <StatCard title={t('attendance.statUnmarked')} value={data.totalUnmarked} icon={CalendarCheck} color="amber" />
            <StatCard title={t('attendance.statGroups')} value={data.totalGroupsScanned} icon={Building2} color="blue" />
          </div>

          {/* Heuristic note (collapsible, subtle) */}
          <div className="bg-violet-500/[0.05] border border-violet-500/15 rounded-2xl overflow-hidden">
            <button
              onClick={() => setNoteOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2.5 text-violet-200/90 text-xs font-medium">
                <CircleHelp size={15} className="text-violet-300 flex-shrink-0" />
                {t('attendance.howItWorks')}
              </span>
              <ChevronDown
                size={15}
                className={`text-violet-300/70 transition-transform flex-shrink-0 ${noteOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {noteOpen && (
              <p className="px-4 pb-3.5 -mt-0.5 text-violet-200/70 text-xs leading-relaxed">
                {t('attendance.heuristicNote')}
              </p>
            )}
          </div>

          {/* Window + updated */}
          <div className="flex items-center justify-between gap-3 flex-wrap text-slate-600 text-xs -mt-1">
            <span>
              {t('attendance.windowNote', {
                from: fmtDay(data.windowFrom),
                till: fmtDay(data.windowTill),
              })}
            </span>
            <span>
              {t('attendance.updatedAt', {
                time: new Date(data.generatedAt).toLocaleTimeString('uz-UZ', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('attendance.searchPlaceholder')}
              className="w-full bg-[#161b27] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
            />
          </div>

          {/* List */}
          {filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map((m, i) => (
                <MentorCard key={m.mentorId} mentor={m} defaultOpen={i === 0 && !query} />
              ))}
            </div>
          ) : (
            <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl flex flex-col items-center py-16 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <Check size={28} className="text-emerald-400" />
              </div>
              <p className="text-slate-400">
                {query ? t('attendance.noResults') : t('attendance.noIssues')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
