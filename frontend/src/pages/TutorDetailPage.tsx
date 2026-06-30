import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarClock,
  Clock,
  Coffee,
  Lightbulb,
  Pencil,
  RefreshCw,
  Settings2,
  ThumbsUp,
  Trash2,
  UserMinus,
} from 'lucide-react'
import { useTutors, useTutorSlots, QUERY_KEYS } from '../hooks/useQueries'
import { useQueryClient } from '@tanstack/react-query'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import {
  WEEKDAYS,
  Stars,
  StatTile,
  TutorEditModal,
  RemoveTutorModal,
  DeleteTutorModal,
} from './TutorsPage'
import type { ScheduleRange, Weekday } from '../types'

type EditModal = 'edit' | 'remove' | 'delete' | null

export default function TutorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const tutorId = id ? Number(id) : null

  const { data: tutorsData, isLoading: tutorsLoading } = useTutors()
  const {
    data: slotsData,
    isLoading: slotsLoading,
    isError: slotsError,
    refetch: refetchSlots,
  } = useTutorSlots(tutorId)

  const tutor = useMemo(
    () => tutorsData?.tutors.find((tu) => tu.id === tutorId) ?? null,
    [tutorsData, tutorId],
  )

  const [modal, setModal] = useState<EditModal>(null)

  const editableDays = useMemo<{ weekday: Weekday; ranges: ScheduleRange[] }[]>(
    () =>
      WEEKDAYS.map((wd) => ({
        weekday: wd,
        ranges: slotsData?.days.find((d) => d.weekday === wd)?.ranges ?? [],
      })),
    [slotsData],
  )

  if (tutorsLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner message={t('tutors.loading')} />
      </div>
    )
  }

  if (!tutor) {
    return (
      <div className="p-6 w-full space-y-4 animate-fade-in">
        <button
          onClick={() => navigate('/tutors')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={16} /> {t('tutors.title')}
        </button>
        <p className="text-slate-500 text-sm">{t('tutors.noResults')}</p>
      </div>
    )
  }

  const hasRating = tutor.avgRating != null && tutor.totalRatings > 0

  return (
    <div className="p-6 w-full space-y-5 animate-fade-in">
      {/* Back */}
      <button
        onClick={() => navigate('/tutors')}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm"
      >
        <ArrowLeft size={15} /> {t('tutors.title')}
      </button>

      {/* Header card */}
      <div className="bg-[#161b27] border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {tutor.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{tutor.name}</h1>
            <div className="flex items-center gap-4 mt-1.5 flex-wrap text-slate-500 text-sm">
              <span className="flex items-center gap-1.5">
                <Building2 size={14} />
                {tutor.branch || 'вЂ”'}
              </span>
              {hasRating && (
                <span className="flex items-center gap-1.5 text-amber-300">
                  <Stars value={tutor.avgRating!} />
                  <span className="font-semibold tabular-nums">
                    {tutor.avgRating!.toFixed(1)}
                  </span>
                  <span className="text-slate-600 tabular-nums">
                    В· {tutor.totalRatings} {t('tutors.reviews')}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Management actions */}
        <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-white/[0.06]">
          <span className="flex items-center gap-1.5 text-slate-600 text-[11px] uppercase tracking-wider font-semibold mr-1">
            <Settings2 size={12} /> {t('tutors.edit.manage')}
          </span>
          <button
            onClick={() => setModal('edit')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/15 border border-indigo-500/30 text-indigo-200 text-xs font-semibold hover:bg-indigo-600/25 transition-colors"
          >
            <Pencil size={13} /> {t('tutors.edit.editTutor')}
          </button>
          <button
            onClick={() => setModal('remove')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-semibold hover:bg-rose-500/20 transition-colors"
          >
            <UserMinus size={13} /> {t('tutors.edit.removeTutor')}
          </button>
          <button
            onClick={() => setModal('delete')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-600/40 text-rose-200 text-xs font-semibold hover:bg-rose-600/30 transition-colors"
          >
            <Trash2 size={13} /> {t('tutors.edit.deleteTutor')}
          </button>
        </div>
      </div>

      {/* Modals */}
      {modal === 'edit' && (
        <TutorEditModal
          tutor={tutor}
          initialDays={editableDays}
          onClose={() => {
            setModal(null)
            void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tutors })
          }}
        />
      )}
      {modal === 'remove' && (
        <RemoveTutorModal
          tutor={tutor}
          onClose={() => {
            setModal(null)
            navigate('/tutors')
          }}
        />
      )}
      {modal === 'delete' && (
        <DeleteTutorModal
          tutor={tutor}
          onClose={() => {
            setModal(null)
            navigate('/tutors')
          }}
        />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatTile
          icon={CalendarCheck}
          label={t('tutors.workingDays')}
          value={slotsData?.available ? String(slotsData.workingDays) : 'вЂ”'}
          tone="indigo"
        />
        <StatTile
          icon={Clock}
          label={t('tutors.weeklyHours')}
          value={
            slotsData?.available
              ? `${slotsData.totalHours} ${t('tutors.hoursShort')}`
              : 'вЂ”'
          }
          tone="emerald"
        />
        <StatTile
          icon={ThumbsUp}
          label={t('tutors.understandable')}
          value={
            tutor.understandablePercent != null
              ? `${Math.round(tutor.understandablePercent)}%`
              : 'вЂ”'
          }
          tone="sky"
        />
        <StatTile
          icon={Lightbulb}
          label={t('tutors.interesting')}
          value={
            tutor.interestingPercent != null
              ? `${Math.round(tutor.interestingPercent)}%`
              : 'вЂ”'
          }
          tone="amber"
        />
      </div>

      {/* Weekly schedule */}
      <div className="bg-[#161b27] border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4 text-slate-500 text-xs uppercase tracking-wider font-semibold">
          <CalendarClock size={13} />
          {t('tutors.weeklySchedule')}
        </div>

        {slotsLoading && (
          <div className="py-8">
            <LoadingSpinner message={t('tutors.loadingSlots')} />
          </div>
        )}
        {slotsError && (
          <div className="py-4">
            <ErrorMessage
              message={t('tutors.loadError')}
              onRetry={() => void refetchSlots()}
            />
          </div>
        )}

        {slotsData && !slotsData.available && (
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
            <RefreshCw size={15} className="text-amber-300 animate-spin flex-shrink-0" />
            <p className="text-amber-200 text-sm">{t('tutors.waking')}</p>
          </div>
        )}

        {slotsData && slotsData.available && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {WEEKDAYS.map((wd) => {
              const day = slotsData.days.find((d) => d.weekday === wd)
              const ranges = day?.ranges ?? []
              const has = ranges.length > 0
              return (
                <div
                  key={wd}
                  className={`flex flex-col gap-1.5 rounded-xl px-3.5 py-2.5 border ${
                    has
                      ? 'bg-white/[0.03] border-white/[0.07]'
                      : 'bg-white/[0.01] border-white/[0.03]'
                  }`}
                >
                  <span
                    className={`text-xs font-bold uppercase tracking-wide ${
                      has ? 'text-indigo-300' : 'text-slate-600'
                    }`}
                  >
                    {t(`tutors.days.${wd}`)}
                  </span>
                  {has ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {ranges.map((r, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-2 py-0.5 text-xs font-semibold text-emerald-200 tabular-nums"
                        >
                          <Clock size={10} className="text-emerald-400" />
                          {r.from}вЂ“{r.to}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="flex items-center gap-1.5 text-slate-600 text-xs">
                      <Coffee size={12} />
                      {t('tutors.dayOff')}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Booking stats вЂ” placeholder (backend endpoint yo'q hali) */}
      <div className="bg-[#161b27] border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4 text-slate-500 text-xs uppercase tracking-wider font-semibold">
          <BarChart3 size={13} />
          Kunlik booking statistikasi
        </div>
        <div className="flex flex-col items-center py-10 gap-3 text-slate-700">
          <BarChart3 size={32} />
          <p className="text-sm text-slate-600">
            Booking tarixi endpointi hali backend da yo'q
          </p>
          <p className="text-xs text-slate-700">
            GET /api/tutors/:id/bookings qo'shilgach, oxirgi 7вЂ“30 kunlik
            statistika shu yerda ko'rsatiladi
          </p>
        </div>
      </div>
    </div>
  )
}
