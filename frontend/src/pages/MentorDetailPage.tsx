import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  BookOpen,
  Users,
  TrendingUp,
  UserMinus,
  Clock,
  ChevronRight,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useMentors, useMentorHistory, useMentorLeftStudents, useInterns } from '../hooks/useQueries'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'

/** Normalize a mentor name for loose matching (lowercase + collapse whitespace). */
const normalizeName = (s: string) =>
  s.toLowerCase().replace(/\s+/g, ' ').trim()

const gradeLabels: Record<string, string> = {
  senior: 'Senior',
  middle: 'Middle',
  junior: 'Junior',
}

const gradeBadgeMap: Record<string, string> = {
  senior: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  middle: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25',
  junior: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
}

interface TooltipEntry {
  color: string
  name: string
  value: number
}
interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-[#1e2433] border border-white/10 rounded-xl px-3 py-2.5 shadow-2xl text-xs space-y-1.5">
      <p className="text-slate-500 mb-1.5">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="font-semibold">
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  )
}

export default function MentorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const {
    data: mentors,
    isLoading: mentorsLoading,
    isError: mentorsError,
    error,
    refetch,
  } = useMentors()

  const mentor = useMemo(
    () => mentors?.find((m) => String(m.id) === id),
    [mentors, id],
  )

  const { data: history, isLoading: historyLoading } = useMentorHistory(mentor?.id ?? null)
  const { data: leftData, isLoading: leftLoading } = useMentorLeftStudents(mentor?.id ?? null)
  const leftStudents = leftData?.leftStudents ?? []

  const { data: internsData } = useInterns()

  const internCount = useMemo(() => {
    if (!internsData?.available || !mentor) return null
    const match = internsData.mentors.find(
      (m) => normalizeName(m.mentorName) === normalizeName(mentor.name),
    )
    return match?.internCount ?? 0
  }, [internsData, mentor])

  const chartData = history?.map((h) => ({
    date: new Date(h.date).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }),
    "O'quvchilar": h.studentCount,
    Guruhlar: h.groupCount,
  }))

  const isOverloaded = (mentor?.studentCount ?? 0) >= 30

  if (mentorsLoading) {
    return (
      <div className="p-6 w-full">
        <LoadingSpinner message={t('mentors.loading')} />
      </div>
    )
  }

  if (mentorsError) {
    return (
      <div className="p-6 w-full">
        <ErrorMessage
          message={(error as Error)?.message || t('mentors.loadError')}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  if (!mentor) {
    return (
      <div className="p-6 w-full space-y-6 animate-fade-in">
        <button
          onClick={() => navigate('/mentors')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} />
          {t('attendance.back')}
        </button>
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl flex flex-col items-center py-20 gap-3">
          <Users size={36} className="text-slate-700" />
          <p className="text-slate-500">{t('mentors.noMentors')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 w-full space-y-6 animate-fade-in">
      {/* Orqaga tugmasi */}
      <button
        onClick={() => navigate('/mentors')}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium"
      >
        <ArrowLeft size={16} />
        {t('attendance.back')}
      </button>

      {/* Mentor header kartasi */}
      <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 ${
              isOverloaded
                ? 'bg-red-500/15 text-red-400'
                : 'bg-indigo-500/15 text-indigo-400'
            }`}
          >
            {mentor.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-2xl text-white leading-tight">{mentor.name}</h1>
            <p className="text-slate-500 text-sm mt-0.5">{mentor.branch}</p>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
              gradeBadgeMap[mentor.grade]
            }`}
          >
            {gradeLabels[mentor.grade]}
          </span>
        </div>
      </div>

      {/* Statistika */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-violet-500/[0.08] border border-violet-500/20 rounded-2xl p-4 text-center">
          <p className="text-violet-400 font-bold text-3xl">{mentor.groupCount}</p>
          <p className="text-slate-500 text-xs mt-1.5">{t('modal.groupCount')}</p>
        </div>
        <div
          className={`rounded-2xl p-4 text-center ${
            isOverloaded
              ? 'bg-red-500/[0.08] border border-red-500/20'
              : 'bg-emerald-500/[0.08] border border-emerald-500/20'
          }`}
        >
          <p
            className={`font-bold text-3xl ${
              isOverloaded ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {mentor.studentCount}
          </p>
          <p className="text-slate-500 text-xs mt-1.5">{t('modal.studentCount')}</p>
        </div>
        <div className="bg-sky-500/[0.08] border border-sky-500/20 rounded-2xl p-4 text-center">
          <p className="text-sky-400 font-bold text-3xl">
            {internCount !== null ? internCount : '—'}
          </p>
          <p className="text-slate-500 text-xs mt-1.5">{t('modal.internCount')}</p>
        </div>
      </div>

      {/* Guruhlar ro'yxati */}
      <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl p-6">
        <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <BookOpen size={14} className="text-indigo-400" />
          {t('modal.groupList')}
        </h4>
        {mentor.groups && mentor.groups.length > 0 ? (
          <div className="space-y-2">
            {mentor.groups.map((group) => (
              <button
                key={group.id ?? group.name}
                onClick={() => {
                  if (!group.id) return
                  navigate(`/attendance/group/${group.id}`)
                }}
                title={t('modal.openAttendance')}
                className="w-full flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-left hover:bg-violet-500/[0.08] hover:border-violet-500/25 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen size={12} className="text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-200 text-sm font-medium truncate">{group.name}</p>
                    <p className="text-slate-600 text-xs">
                      {typeof group.category === 'string'
                        ? group.category
                        : (group.category as unknown as { name?: string })?.name ?? ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                  {(() => {
                    const raw = group as unknown as Record<string, unknown>
                    const time = group.time || (raw['lesson_start_time'] as string) || ''
                    const count =
                      group.studentCount ?? (raw['students_number'] as number) ?? 0
                    return (
                      <>
                        {time && (
                          <span className="flex items-center gap-1.5 text-slate-500 text-xs">
                            <Clock size={11} />
                            {time}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
                          <Users size={11} />
                          {count} o'quvchi
                        </span>
                      </>
                    )
                  })()}
                  <ChevronRight size={15} className="text-slate-600" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-slate-600 text-sm text-center py-6">{t('modal.noGroups')}</p>
        )}
      </div>

      {/* Ketgan o'quvchilar */}
      <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl p-6">
        <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <UserMinus size={14} className="text-red-400" />
          {t('modal.leftStudents')}
          {leftStudents.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
              {t('modal.leftCount', { count: leftStudents.length })}
            </span>
          )}
        </h4>
        {leftLoading ? (
          <LoadingSpinner size="sm" />
        ) : leftStudents.length > 0 ? (
          <div className="space-y-2">
            {leftStudents.map((s) => (
              <div
                key={`${s.studentId}-${s.groupName}`}
                className="flex items-center justify-between bg-red-500/[0.05] border border-red-500/15 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <UserMinus size={12} className="text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-200 text-sm font-medium truncate">{s.name}</p>
                    <p className="text-slate-600 text-xs truncate">{s.groupName}</p>
                  </div>
                </div>
                <span className="text-slate-500 text-xs flex-shrink-0 ml-3">
                  {t('modal.leftSince', { date: s.lastSeenDate })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 text-center">
            <p className="text-slate-600 text-sm">
              {leftData ? t('modal.noLeft') : t('modal.leftCollecting')}
            </p>
          </div>
        )}
      </div>

      {/* Tarix grafigi */}
      <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl p-6">
        <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <TrendingUp size={14} className="text-indigo-400" />
          {t('modal.trend')}
        </h4>
        {historyLoading ? (
          <LoadingSpinner size="sm" />
        ) : chartData && chartData.length > 0 ? (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: -15, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#475569', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="O'quvchilar"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="Guruhlar"
                  stroke="#a78bfa"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: '#a78bfa', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-3 justify-center">
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-4 h-0.5 bg-indigo-500 inline-block rounded-full" />
                {t('modal.students')}
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-4 h-0.5 bg-violet-400 inline-block rounded-full" />
                {t('modal.groups')}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-10 text-center">
            <p className="text-slate-600 text-sm">{t('modal.noHistory')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
