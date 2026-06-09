import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Clock, BookOpen, Users, TrendingUp, UserMinus } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useMentorHistory, useMentorLeftStudents } from '../hooks/useQueries'
import LoadingSpinner from './LoadingSpinner'
import type { Mentor } from '../types'

interface MentorModalProps {
  mentor: Mentor
  onClose: () => void
}

const gradeLabels = { senior: 'Senior', middle: 'Middle', junior: 'Junior' }
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

export default function MentorModal({ mentor, onClose }: MentorModalProps) {
  const { t } = useTranslation()
  const { data: history, isLoading } = useMentorHistory(mentor.id)
  const { data: leftData, isLoading: leftLoading } = useMentorLeftStudents(mentor.id)
  const leftStudents = leftData?.leftStudents ?? []
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const chartData = history?.map((h) => ({
    date: new Date(h.date).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }),
    "O'quvchilar": h.studentCount,
    Guruhlar: h.groupCount,
  }))

  const isOverloaded = mentor.studentCount >= 30

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom sm:modal-middle"
      onClose={onClose}
      onClick={(e) => { if (e.target === dialogRef.current) onClose() }}
    >
      <div className="modal-box w-full max-w-2xl p-0 max-h-[90vh] overflow-y-auto bg-[#161b27] border border-white/[0.08] rounded-2xl shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/[0.06] sticky top-0 bg-[#161b27] z-10">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-bold ${
              isOverloaded ? 'bg-red-500/15 text-red-400' : 'bg-indigo-500/15 text-indigo-400'
            }`}>
              {mentor.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">{mentor.name}</h3>
              <p className="text-slate-500 text-sm">{mentor.branch}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${gradeBadgeMap[mentor.grade]}`}>
              {gradeLabels[mentor.grade]}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
              aria-label={t('modal.close')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 p-6 pb-0">
          <div className="bg-violet-500/[0.08] border border-violet-500/20 rounded-2xl p-4 text-center">
            <p className="text-violet-400 font-bold text-3xl">{mentor.groupCount}</p>
            <p className="text-slate-500 text-xs mt-1.5">{t('modal.groupCount')}</p>
          </div>
          <div className={`${isOverloaded ? 'bg-red-500/[0.08] border border-red-500/20' : 'bg-emerald-500/[0.08] border border-emerald-500/20'} rounded-2xl p-4 text-center`}>
            <p className={`font-bold text-3xl ${isOverloaded ? 'text-red-400' : 'text-emerald-400'}`}>
              {mentor.studentCount}
            </p>
            <p className="text-slate-500 text-xs mt-1.5">{t('modal.studentCount')}</p>
          </div>
        </div>

        {/* Groups */}
        <div className="p-6">
          <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <BookOpen size={14} className="text-indigo-400" />
            {t('modal.groupList')}
          </h4>
          {mentor.groups && mentor.groups.length > 0 ? (
            <div className="space-y-2">
              {mentor.groups.map((group) => (
                <div
                  key={group.name}
                  className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 hover:border-indigo-500/20 transition-colors"
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
                      const count = group.studentCount ?? (raw['students_number'] as number) ?? 0
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
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 text-sm text-center py-6">{t('modal.noGroups')}</p>
          )}
        </div>

        {/* Left students */}
        <div className="px-6 pb-2">
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

        {/* History chart */}
        <div className="px-6 pb-6">
          <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-indigo-400" />
            {t('modal.trend')}
          </h4>
          {isLoading ? (
            <LoadingSpinner size="sm" />
          ) : chartData && chartData.length > 0 ? (
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
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
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>{t('modal.closeBtn')}</button>
      </form>
    </dialog>
  )
}
