import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CalendarCheck, Check, X, Minus, Snowflake, Clock, MapPin, BookOpen, Calendar, User } from 'lucide-react'
import { useGroupAttendance, useMarkAttendance } from '../hooks/useQueries'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import type { CellState } from '../types'

// ──────────── month tab helpers ────────────

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtTab(year: number, month: number): string {
  return `${MONTH_ABBR[month - 1]} ${String(year).slice(2)}`
}

/** Generates a list of {year, month} objects: 12 months back + current + 2 ahead. */
function generateMonthTabs(): { year: number; month: number }[] {
  const now = new Date()
  const cy = now.getFullYear()
  const cm = now.getMonth() + 1 // 1-based
  const tabs: { year: number; month: number }[] = []
  for (let offset = -12; offset <= 2; offset++) {
    let m = cm + offset
    let y = cy
    while (m <= 0) { m += 12; y-- }
    while (m > 12) { m -= 12; y++ }
    tabs.push({ year: y, month: m })
  }
  return tabs
}

interface EditingCell {
  studentId: number
  studentName: string
  date: string
  current: CellState
  x: number
  y: number
}

// Muted, dashboard-grade cell styling — soft tinted fills with a subtle border
// (no bright solid blocks / glows), so the grid reads as data, not a game board.
const CELL_STYLE: Record<CellState, string> = {
  present: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  absent: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  violet: 'bg-violet-500/12 text-violet-300 border border-violet-500/30',
  unmarked: 'bg-white/[0.015] border border-white/[0.05] text-slate-700',
}

function fmtDay(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}.${m}`
}

export function CellBox({ state, size = 7 }: { state: CellState; size?: number }) {
  const px = size === 7 ? 'w-7 h-7' : 'w-6 h-6'
  const icon = size === 7 ? 14 : 12
  return (
    <div
      className={`${px} rounded-md flex items-center justify-center ${CELL_STYLE[state]}`}
    >
      {state === 'present' ? (
        <Check size={icon} strokeWidth={2.5} />
      ) : state === 'absent' ? (
        <X size={icon} strokeWidth={2.5} />
      ) : state === 'violet' ? (
        <X size={icon} strokeWidth={2.5} />
      ) : (
        <Minus size={icon - 2} className="text-slate-700" />
      )}
    </div>
  )
}

function Legend() {
  const { t } = useTranslation()
  const items: { state: CellState; label: string }[] = [
    { state: 'present', label: t('attendance.legendPresent') },
    { state: 'violet', label: t('attendance.legendViolet') },
    { state: 'absent', label: t('attendance.legendAbsent') },
    { state: 'unmarked', label: t('attendance.legendUnmarked') },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 pt-4 border-t border-white/[0.06]">
      {items.map((it) => (
        <span key={it.state} className="flex items-center gap-2 text-xs text-slate-400">
          <CellBox state={it.state} size={6} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

export default function GroupAttendancePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { groupId } = useParams<{ groupId: string }>()
  const id = Number(groupId)

  // Month selector state — default to the current calendar month.
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  })
  const monthTabs = useMemo(() => generateMonthTabs(), [])

  const { data, isLoading, isError, refetch } = useGroupAttendance(
    Number.isFinite(id) && id > 0 ? id : null,
    selectedMonth.year,
    selectedMonth.month,
  )
  const markMut = useMarkAttendance()
  const [editing, setEditing] = useState<EditingCell | null>(null)

  const visibleDays = data ? data.days : []

  const openEditor = (
    e: React.MouseEvent,
    studentId: number,
    studentName: string,
    date: string,
    current: CellState,
  ) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setEditing({
      studentId,
      studentName,
      date,
      current,
      x: Math.min(rect.left, window.innerWidth - 180),
      y: rect.bottom + 6,
    })
  }

  const applyMark = (status: 0 | 1) => {
    if (!editing || !data) return
    markMut.mutate({
      groupId: data.groupId,
      studentId: editing.studentId,
      date: editing.date,
      status,
    })
    setEditing(null)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors group"
      >
        <span className="w-8 h-8 rounded-xl bg-white/[0.04] group-hover:bg-white/[0.08] flex items-center justify-center transition-colors">
          <ArrowLeft size={16} />
        </span>
        {t('attendance.back')}
      </button>

      {/* Header card */}
      <div className="bg-gradient-to-br from-[#1b2030] to-[#161b27] border border-white/[0.07] rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
              <CalendarCheck size={22} className="text-violet-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">
                {data?.groupName ?? `#${groupId}`}
              </h1>
              {data && (
                <p className="text-slate-500 text-sm mt-0.5 truncate">
                  {data.mentorName} · {data.branch}
                </p>
              )}
              {/* Kurator (faqat bo'lsa) */}
              {data?.curatorName && (
                <p className="flex items-center gap-1.5 text-xs text-amber-400/80 mt-1">
                  <User size={11} className="flex-shrink-0" />
                  {t('attendance.curator')}: {data.curatorName}
                </p>
              )}
              {/* Chips qatori: yo'nalish, vaqt, xona, kunlar */}
              {data && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {data.courseName && (
                    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      <BookOpen size={10} />
                      {data.courseName}
                    </span>
                  )}
                  {data.lessonStartTime && (
                    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20">
                      <Clock size={10} />
                      {data.lessonStartTime}
                      {data.lessonEndTime && `–${data.lessonEndTime}`}
                    </span>
                  )}
                  {data.roomName && (
                    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      <MapPin size={10} />
                      {data.roomName}
                    </span>
                  )}
                  {data.lessonDays != null && (
                    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/20">
                      <Calendar size={10} />
                      {data.lessonDays === 2
                        ? t('attendance.lessonDaysEven')
                        : data.lessonDays === 1
                          ? t('attendance.lessonDaysOdd')
                          : t('attendance.lessonDaysCount', { count: data.lessonDays })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {data && (
            <div className="flex items-center gap-2">
              {data.suspectVioletCount > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-xl bg-violet-500/15 text-violet-300 border border-violet-500/25">
                  <span className="w-2 h-2 rounded-full bg-violet-400" />
                  {data.suspectVioletCount} {t('attendance.violetShort')}
                </span>
              )}
              {data.unmarkedCount > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-xl bg-slate-500/15 text-slate-300 border border-slate-500/25">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  {data.unmarkedCount} {t('attendance.unmarkedShort')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Month selector tabs */}
      <div className="bg-[#161b27] border border-white/[0.07] rounded-2xl px-4 py-3">
        <div className="flex overflow-x-auto gap-1 pb-0.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
          {monthTabs.map(({ year, month }) => {
            const isActive = year === selectedMonth.year && month === selectedMonth.month
            const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1
            return (
              <button
                key={`${year}-${month}`}
                onClick={() => setSelectedMonth({ year, month })}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    : isCurrent
                      ? 'bg-white/[0.06] text-slate-300 border border-white/[0.12] hover:bg-white/[0.10]'
                      : 'bg-transparent text-slate-500 border border-transparent hover:text-slate-300 hover:bg-white/[0.05]'
                }`}
              >
                {fmtTab(year, month)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="bg-[#161b27] border border-white/[0.07] rounded-2xl p-5">
        {isLoading && <LoadingSpinner message={t('attendance.loading')} />}
        {isError && (
          <ErrorMessage message={t('attendance.loadError')} onRetry={() => refetch()} />
        )}
        {data && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-[#161b27] text-left text-[11px] uppercase tracking-wider text-slate-600 font-semibold px-2 pb-3 w-[200px]">
                      {t('attendance.studentList')}
                    </th>
                    {visibleDays.map((d) => (
                      <th key={d.date} className="px-0 pb-3 align-bottom">
                        <div
                          className={`flex flex-col items-center gap-0.5 rounded-lg py-1 ${
                            d.isVioletDay ? 'bg-violet-500/10' : ''
                          }`}
                        >
                          <span
                            className={`text-[11px] font-bold leading-tight ${
                              d.isVioletDay ? 'text-violet-300' : 'text-slate-400'
                            }`}
                          >
                            {fmtDay(d.date)}
                          </span>
                          <span className="h-3 text-[9px] text-slate-600 w-full px-0.5 truncate text-center leading-none">
                            {d.teacher ?? ''}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s, idx) => (
                    <tr key={s.studentId} className={s.frozen ? 'opacity-45' : ''}>
                      <td
                        className={`sticky left-0 z-10 px-2 py-0.5 w-[200px] ${
                          idx % 2 === 0 ? 'bg-[#161b27]' : 'bg-[#181d2a]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[11px] w-5 tabular-nums flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-slate-200 text-sm truncate">{s.name}</span>
                          {s.isIntern && (
                            <span title="Intern" className="flex-shrink-0 text-xs leading-none">⭐</span>
                          )}
                          {s.frozen && (
                            <Snowflake size={12} className="text-sky-400 flex-shrink-0" />
                          )}
                        </div>
                      </td>
                      {s.cells.map((c, ci) => (
                        <td
                          key={c.date}
                          className={`px-0 py-0.5 ${
                            visibleDays[ci]?.isVioletDay ? 'bg-violet-500/[0.05]' : ''
                          }`}
                        >
                          <div className="flex justify-center">
                            {s.frozen ? (
                              <CellBox state={c.state} />
                            ) : (
                              <button
                                onClick={(e) =>
                                  openEditor(e, s.studentId, s.name, c.date, c.state)
                                }
                                title={t('attendance.editCell')}
                                className="rounded-md ring-offset-1 ring-offset-[#161b27] hover:ring-2 hover:ring-violet-400/50 transition"
                              >
                                <CellBox state={c.state} />
                              </button>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Legend />
          </>
        )}
      </div>

      {/* Per-cell editor popover (no modal) */}
      {editing && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setEditing(null)} />
          <div
            className="fixed z-50 bg-[#1e2433] border border-white/10 rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5 w-44 animate-fade-in"
            style={{ left: editing.x, top: editing.y }}
          >
            <p className="px-2 py-1 text-[11px] text-slate-500 truncate">
              {editing.studentName} · {fmtDay(editing.date)}
            </p>
            <button
              onClick={() => applyMark(1)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-emerald-300 hover:bg-emerald-500/15 transition"
            >
              <Check size={15} strokeWidth={2.5} /> {t('attendance.markPresent')}
            </button>
            <button
              onClick={() => applyMark(0)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-rose-300 hover:bg-rose-500/15 transition"
            >
              <X size={15} strokeWidth={2.5} /> {t('attendance.markAbsent')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
