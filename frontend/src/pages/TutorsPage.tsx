import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Search,
  RefreshCw,
  Building2,
  Star,
  Clock,
  ArrowDownUp,
  Coffee,
  Pencil,
  UserMinus,
  UserPlus,
  X,
  AlertTriangle,
  Check,
  Phone,
  KeyRound,
  Briefcase,
  Trash2,
} from 'lucide-react'
import {
  useTutors,
  useTutorSlots,
  useTutorBookings,
  useRemoveTutor,
  useDeleteTutor,
  useBranches,
  useCreateTutorAccount,
  QUERY_KEYS,
} from '../hooks/useQueries'
import { useQueryClient } from '@tanstack/react-query'
import { updateTutorSlots as apiUpdateTutorSlots, updateTutorProfile as apiUpdateTutorProfile } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import type {
  TutorBrief,
  Weekday,
  ScheduleRange,
  TutorScheduleType,
} from '../types'

// Du..Ya order — matches the backend's 7-entry grid.
export const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

type SortKey = 'name' | 'rating'

// Half-hour start times 06:00..23:30 for the schedule time pickers.
export const HOUR_OPTIONS: string[] = (() => {
  const out: string[] = []
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  out.push('24:00')
  return out
})()

export function Modal({
  title,
  icon: Icon,
  onClose,
  children,
}: {
  title: string
  icon: typeof Clock
  onClose: () => void
  children: React.ReactNode
}) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#161b27] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
              <Icon size={16} />
            </div>
            <h3 className="text-base font-bold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Unified tutor edit modal — name, branch (filial rotate) and the full weekly
 * work schedule in one place.
 *
 * Save flow: review → confirm → apply. On confirm we send only what actually
 * changed: a single PATCH /tutors/:id for the profile (name/branch) when any of
 * those differ, plus one POST /tutors/:id/slots per weekday whose interval was
 * edited. Untouched fields/days are never sent, keeping the write idempotent.
 */
export function TutorEditModal({
  tutor,
  initialDays,
  onClose,
}: {
  tutor: TutorBrief
  initialDays: { weekday: Weekday; ranges: ScheduleRange[] }[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: branchData, isLoading: branchesLoading } = useBranches(true)
  const branches = branchData?.branches ?? []

  // ── profile fields ──
  const [first = ''] = tutor.name.split(' ')
  const [firstName, setFirstName] = useState(first)
  const [lastName, setLastName] = useState(
    tutor.name.split(' ').slice(1).join(' '),
  )
  const [branchId, setBranchId] = useState<number | null>(tutor.branchId)

  // ── per-weekday schedule (from/till per day) ──
  type DayState = { from: string; till: string }
  const initialSchedule = useMemo<Record<Weekday, DayState>>(() => {
    const out = {} as Record<Weekday, DayState>
    for (const wd of WEEKDAYS) {
      const r = initialDays.find((d) => d.weekday === wd)?.ranges[0]
      out[wd] = { from: r?.from ?? '09:00', till: r?.to ?? '09:00' }
    }
    return out
  }, [initialDays])
  const [schedule, setSchedule] =
    useState<Record<Weekday, DayState>>(initialSchedule)

  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  const setDay = (wd: Weekday, patch: Partial<DayState>) =>
    setSchedule((s) => ({ ...s, [wd]: { ...s[wd], ...patch } }))

  // Quick-fill: Mon–Fri 09:00–19:00, Sat & Sun stay off (from === till).
  const fillWeekdays = () =>
    setSchedule((s) => {
      const next = { ...s }
      for (const wd of WEEKDAYS) {
        if (wd === 'saturday' || wd === 'sunday') {
          next[wd] = { from: '09:00', till: '09:00' }
        } else {
          next[wd] = { from: '09:00', till: '19:00' }
        }
      }
      return next
    })

  // Quick-clear: every day off.
  const clearSchedule = () =>
    setSchedule((s) => {
      const next = { ...s }
      for (const wd of WEEKDAYS) next[wd] = { from: '09:00', till: '09:00' }
      return next
    })

  // What changed, so we only send the necessary writes.
  const nameChanged =
    firstName.trim() !== first ||
    lastName.trim() !== tutor.name.split(' ').slice(1).join(' ')
  const branchChanged = branchId !== tutor.branchId
  const changedDays = WEEKDAYS.filter(
    (wd) =>
      schedule[wd].from !== initialSchedule[wd].from ||
      schedule[wd].till !== initialSchedule[wd].till,
  )
  const profileChanged = nameChanged || branchChanged
  const anyChange = profileChanged || changedDays.length > 0
  const formValid = firstName.trim().length > 0 && lastName.trim().length > 0

  const selectedBranch = branches.find((b) => b.id === branchId)

  const handleSave = async () => {
    setSaving(true)
    setError(false)
    try {
      if (profileChanged) {
        await apiUpdateTutorProfile(tutor.id, {
          ...(nameChanged
            ? { firstName: firstName.trim(), lastName: lastName.trim() }
            : {}),
          ...(branchChanged && branchId != null ? { branchId } : {}),
        })
      }
      for (const wd of changedDays) {
        await apiUpdateTutorSlots(tutor.id, {
          day: wd,
          fromHour: schedule[wd].from,
          tillHour: schedule[wd].till,
        })
      }
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tutors })
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.tutorSlots(tutor.id),
      })
      onClose()
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('tutors.edit.editTitle')} icon={Pencil} onClose={onClose}>
      <div className="max-h-[60vh] overflow-y-auto pr-1 -mr-1 space-y-4">
        {/* Profile */}
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
            <Pencil size={12} /> {t('tutors.edit.profileSection')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                {t('tutors.edit.firstName')}
              </label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-[#0f131c] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                {t('tutors.edit.lastName')}
              </label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-[#0f131c] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              {t('tutors.edit.branch')}
            </label>
            <div className="relative">
              <Building2
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"
              />
              <select
                value={branchId ?? ''}
                onChange={(e) =>
                  setBranchId(e.target.value ? Number(e.target.value) : null)
                }
                disabled={branchesLoading}
                className="w-full bg-[#0f131c] border border-white/[0.1] rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 cursor-pointer disabled:opacity-60"
              >
                <option value="">
                  {branchesLoading
                    ? t('tutors.create.branchLoading')
                    : t('tutors.create.branchSelect')}
                </option>
                {/* Keep the tutor's current branch selectable even if it's not
                    in the derived list yet. */}
                {branchId != null &&
                  !branches.some((b) => b.id === branchId) &&
                  tutor.branch && (
                    <option value={branchId}>{tutor.branch}</option>
                  )}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1 flex items-center gap-1.5">
            <Clock size={12} /> {t('tutors.edit.scheduleSection')}
          </div>
          <p className="text-slate-600 text-[11px] mb-2.5">
            {t('tutors.edit.scheduleDayHint')}
          </p>
          <div className="flex flex-wrap gap-2 mb-2.5">
            <button
              type="button"
              onClick={fillWeekdays}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600/15 border border-indigo-500/30 text-indigo-200 text-[11px] font-semibold hover:bg-indigo-600/25 transition-colors tabular-nums"
            >
              {t('tutors.edit.fillWeekdays')}
            </button>
            <button
              type="button"
              onClick={clearSchedule}
              className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 text-[11px] font-semibold hover:bg-white/[0.07] transition-colors"
            >
              {t('tutors.edit.clearSchedule')}
            </button>
          </div>
          <div className="space-y-1.5">
            {WEEKDAYS.map((wd) => {
              const d = schedule[wd]
              const off = d.from === d.till
              return (
                <div
                  key={wd}
                  className="flex items-center gap-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl px-3 py-2"
                >
                  <span className="text-xs font-bold uppercase tracking-wide w-9 flex-shrink-0 text-indigo-300">
                    {t(`tutors.days.${wd}`)}
                  </span>
                  <select
                    value={d.from}
                    onChange={(e) => setDay(wd, { from: e.target.value })}
                    className="flex-1 min-w-0 bg-[#0f131c] border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs text-slate-200 tabular-nums focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                  >
                    {HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-slate-600 text-xs">–</span>
                  <select
                    value={d.till}
                    onChange={(e) => setDay(wd, { till: e.target.value })}
                    className="flex-1 min-w-0 bg-[#0f131c] border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs text-slate-200 tabular-nums focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                  >
                    {HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span
                    className={`flex-shrink-0 w-14 text-right text-[10px] font-semibold ${
                      off ? 'text-amber-300/80' : 'text-emerald-300/80'
                    }`}
                  >
                    {off ? (
                      <span className="inline-flex items-center gap-1">
                        <Coffee size={10} /> {t('tutors.dayOff')}
                      </span>
                    ) : (
                      ''
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-rose-400 text-xs mt-3">{t('tutors.edit.saveError')}</p>
      )}

      {!confirm ? (
        <div className="flex gap-2.5 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 text-sm font-medium hover:bg-white/[0.07] transition-colors"
          >
            {t('tutors.edit.cancel')}
          </button>
          <button
            onClick={() => setConfirm(true)}
            disabled={!formValid || !anyChange}
            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {t('tutors.edit.save')}
          </button>
        </div>
      ) : (
        <div className="mt-5 bg-amber-500/10 border border-amber-500/25 rounded-xl p-4">
          <p className="text-amber-200 text-sm font-medium flex items-center gap-2 mb-3">
            <AlertTriangle size={15} /> {t('tutors.edit.confirmSave')}
          </p>
          <div className="space-y-1.5 text-sm mb-3">
            {nameChanged && (
              <div className="flex items-center gap-2 text-slate-200">
                <Pencil size={13} className="text-indigo-300" />
                <span className="font-semibold">
                  {firstName} {lastName}
                </span>
              </div>
            )}
            {branchChanged && (
              <div className="flex items-center gap-2 text-slate-200">
                <Building2 size={13} className="text-indigo-300" />
                {selectedBranch?.title ?? tutor.branch ?? '—'}
              </div>
            )}
            {changedDays.map((wd) => {
              const d = schedule[wd]
              const off = d.from === d.till
              return (
                <div
                  key={wd}
                  className="flex items-center gap-2 text-slate-300 tabular-nums"
                >
                  <Clock size={13} className="text-emerald-300" />
                  <span className="font-semibold text-indigo-300">
                    {t(`tutors.days.${wd}`)}
                  </span>{' '}
                  · {off ? t('tutors.edit.dayOffOption') : `${d.from}–${d.till}`}
                </div>
              )
            })}
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => setConfirm(false)}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 text-sm font-medium hover:bg-white/[0.07] disabled:opacity-60 transition-colors"
            >
              {t('tutors.edit.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              {saving ? t('tutors.edit.saving') : t('tutors.edit.confirm')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export function RemoveTutorModal({
  tutor,
  onClose,
}: {
  tutor: TutorBrief
  onClose: () => void
}) {
  const { t } = useTranslation()
  const mutation = useRemoveTutor()

  const handleRemove = () => {
    mutation.mutate(tutor.id, { onSuccess: () => onClose() })
  }

  return (
    <Modal title={t('tutors.edit.removeTitle')} icon={UserMinus} onClose={onClose}>
      <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/25 rounded-xl p-4 mb-4">
        <AlertTriangle size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
        <p className="text-rose-200 text-sm">
          {t('tutors.edit.removeConfirm', { name: tutor.name })}
        </p>
      </div>

      {mutation.isError && (
        <p className="text-rose-400 text-xs mb-3">{t('tutors.edit.saveError')}</p>
      )}

      <div className="flex gap-2.5">
        <button
          onClick={onClose}
          disabled={mutation.isPending}
          className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 text-sm font-medium hover:bg-white/[0.07] disabled:opacity-60 transition-colors"
        >
          {t('tutors.edit.cancel')}
        </button>
        <button
          onClick={handleRemove}
          disabled={mutation.isPending}
          className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {mutation.isPending ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <UserMinus size={14} />
          )}
          {mutation.isPending ? t('tutors.edit.saving') : t('tutors.edit.remove')}
        </button>
      </div>
    </Modal>
  )
}

/**
 * ⚠️ Strong-confirmation modal for PERMANENTLY deleting a user from Mars.
 *
 * Unlike {@link RemoveTutorModal} (which only demotes the tutor to a mentor),
 * this hits DELETE /tutors/:id → DELETE /api/v2/users/{id} and wipes the Mars
 * account for good. To guard against accidents the operator must type the
 * tutor's exact name before the destructive button enables.
 */
export function DeleteTutorModal({
  tutor,
  onClose,
}: {
  tutor: TutorBrief
  onClose: () => void
}) {
  const { t } = useTranslation()
  const mutation = useDeleteTutor()
  const [confirmName, setConfirmName] = useState('')

  // Case-insensitive, whitespace-tolerant name match.
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
  const nameMatches = norm(confirmName) === norm(tutor.name)

  const handleDelete = () => {
    if (!nameMatches) return
    mutation.mutate(tutor.id, { onSuccess: () => onClose() })
  }

  return (
    <Modal title={t('tutors.edit.deleteTitle')} icon={Trash2} onClose={onClose}>
      <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 mb-4">
        <AlertTriangle size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-rose-200 text-sm font-semibold">
            {t('tutors.edit.deleteWarning')}
          </p>
          <p className="text-rose-300/80 text-xs mt-1.5">
            {t('tutors.edit.deleteIrreversible')}
          </p>
        </div>
      </div>

      <label className="block text-xs font-semibold text-slate-400 mb-1.5">
        {t('tutors.edit.deleteTypeName', { name: tutor.name })}
      </label>
      <input
        value={confirmName}
        onChange={(e) => setConfirmName(e.target.value)}
        autoFocus
        placeholder={tutor.name}
        className="w-full bg-[#0f131c] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-rose-500/50"
      />

      {mutation.isError && (
        <p className="text-rose-400 text-xs mt-3">{t('tutors.edit.saveError')}</p>
      )}

      <div className="flex gap-2.5 mt-5">
        <button
          onClick={onClose}
          disabled={mutation.isPending}
          className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 text-sm font-medium hover:bg-white/[0.07] disabled:opacity-60 transition-colors"
        >
          {t('tutors.edit.cancel')}
        </button>
        <button
          onClick={handleDelete}
          disabled={mutation.isPending || !nameMatches}
          className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {mutation.isPending ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}
          {mutation.isPending
            ? t('tutors.edit.saving')
            : t('tutors.edit.deleteConfirm')}
        </button>
      </div>
    </Modal>
  )
}

/**
 * Create a brand-new Mars account for a new hire and turn it into a tutor.
 *
 * Three steps in one modal:
 *  1. "form"     — Ism / Familiya / Telefon / Parol / Filial / Bandlik.
 *  2. "confirm"  — review the entered data before creating the real account.
 *  3. on success — hands off the new tutor's id to {@link TutorEditModal}
 *     (rendered by the parent) so the full weekly schedule can be set right
 *     away via the 7-day grid + "Mon–Fri 09:00–19:00" quick-fill.
 */
function CreateTutorModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (tutor: TutorBrief) => void
}) {
  const { t } = useTranslation()
  const { data: branchData, isLoading: branchesLoading } = useBranches(true)
  const mutation = useCreateTutorAccount()

  const [step, setStep] = useState<'form' | 'confirm'>('form')
  // Backend may return { ok:false, message } without throwing — surface it.
  const [resultError, setResultError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('+998')
  const [password, setPassword] = useState('')
  const [branchId, setBranchId] = useState<number | null>(null)
  const [schedule, setSchedule] = useState<TutorScheduleType>('full-time')

  const branches = branchData?.branches ?? []
  const phoneOk = /^\+?\d{9,15}$/.test(phone.trim())
  const formValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    phoneOk &&
    branchId != null

  const selectedBranch = branches.find((b) => b.id === branchId)

  const handleCreate = () => {
    if (!formValid || branchId == null) return
    setResultError(null)
    mutation.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        password: password.trim() || undefined,
        branchId,
        schedule,
      },
      {
        onError: () => {
          setResultError(t('tutors.create.createError'))
        },
        onSuccess: (res) => {
          if (!res.ok || !res.userId) {
            // Mars rejected the create/promote — show its actual reason.
            setResultError(res.message ?? t('tutors.create.createError'))
            return
          }
          // Hand a synthetic TutorBrief to the schedule editor.
          onCreated({
            id: res.userId,
            name: res.name ?? `${firstName} ${lastName}`.trim(),
            username: '',
            branch: selectedBranch?.title ?? '',
            branchId,
            avgRating: null,
            totalRatings: 0,
            interestingPercent: null,
            understandablePercent: null,
          })
        },
      },
    )
  }

  return (
    <Modal title={t('tutors.create.title')} icon={UserPlus} onClose={onClose}>
      {step === 'form' ? (
        <>
          <p className="text-slate-500 text-xs mb-4">{t('tutors.create.hint')}</p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                {t('tutors.edit.firstName')}
              </label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
                className="w-full bg-[#0f131c] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                {t('tutors.edit.lastName')}
              </label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-[#0f131c] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              {t('tutors.create.phone')}
            </label>
            <div className="relative">
              <Phone
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998901234567"
                className="w-full bg-[#0f131c] border border-white/[0.1] rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-200 tabular-nums placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            {phone.length > 4 && !phoneOk && (
              <p className="text-amber-300/80 text-xs mt-1">
                {t('tutors.create.phoneInvalid')}
              </p>
            )}
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              {t('tutors.create.password')}
            </label>
            <div className="relative">
              <KeyRound
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('tutors.create.passwordOptional')}
                className="w-full bg-[#0f131c] border border-white/[0.1] rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-1">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                {t('tutors.create.branch')}
              </label>
              <div className="relative">
                <Building2
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"
                />
                <select
                  value={branchId ?? ''}
                  onChange={(e) =>
                    setBranchId(e.target.value ? Number(e.target.value) : null)
                  }
                  disabled={branchesLoading}
                  className="w-full bg-[#0f131c] border border-white/[0.1] rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 cursor-pointer disabled:opacity-60"
                >
                  <option value="">
                    {branchesLoading
                      ? t('tutors.create.branchLoading')
                      : t('tutors.create.branchSelect')}
                  </option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                {t('tutors.create.schedule')}
              </label>
              <div className="relative">
                <Briefcase
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"
                />
                <select
                  value={schedule}
                  onChange={(e) =>
                    setSchedule(e.target.value as TutorScheduleType)
                  }
                  className="w-full bg-[#0f131c] border border-white/[0.1] rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                >
                  <option value="full-time">
                    {t('tutors.create.fullTime')}
                  </option>
                  <option value="part-time">
                    {t('tutors.create.partTime')}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 mt-5">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 text-sm font-medium hover:bg-white/[0.07] transition-colors"
            >
              {t('tutors.edit.cancel')}
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={!formValid}
              className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {t('tutors.create.next')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4">
            <p className="text-amber-200 text-sm font-medium flex items-center gap-2 mb-3">
              <AlertTriangle size={15} /> {t('tutors.create.confirmTitle')}
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-slate-200">
                <UserPlus size={13} className="text-indigo-300" />
                <span className="font-semibold">
                  {firstName} {lastName}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-300 tabular-nums">
                <Phone size={13} className="text-slate-500" />
                {phone}
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Building2 size={13} className="text-slate-500" />
                {selectedBranch?.title ?? '—'}
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Briefcase size={13} className="text-slate-500" />
                {schedule === 'full-time'
                  ? t('tutors.create.fullTime')
                  : t('tutors.create.partTime')}
              </div>
            </div>
            <p className="text-amber-300/70 text-xs mt-3">
              {t('tutors.create.confirmHint')}
            </p>
          </div>

          {(resultError || mutation.isError) && (
            <p className="text-rose-400 text-xs mt-3">
              {resultError ?? t('tutors.create.createError')}
            </p>
          )}

          <div className="flex gap-2.5 mt-5">
            <button
              onClick={() => setStep('form')}
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 text-sm font-medium hover:bg-white/[0.07] disabled:opacity-60 transition-colors"
            >
              {t('tutors.create.back')}
            </button>
            <button
              onClick={handleCreate}
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <UserPlus size={14} />
              )}
              {mutation.isPending
                ? t('tutors.create.creating')
                : t('tutors.create.create')}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

export function Stars({ value }: { value: number }) {
  // Render 5 stars, filling proportionally to the 0..5 rating.
  return (
    <span className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = value >= i + 1
        const half = !filled && value > i
        return (
          <Star
            key={i}
            size={12}
            className={
              filled
                ? 'fill-amber-300 text-amber-300'
                : half
                  ? 'fill-amber-300/50 text-amber-300'
                  : 'text-slate-700'
            }
          />
        )
      })}
    </span>
  )
}



export function StatTile({
  icon: Icon,
  label,
  value,
  tone = 'slate',
}: {
  icon: typeof Clock
  label: string
  value: string
  tone?: 'slate' | 'emerald' | 'amber' | 'sky' | 'indigo'
}) {
  const toneCls: Record<string, string> = {
    slate: 'text-slate-200',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    sky: 'text-sky-300',
    indigo: 'text-indigo-300',
  }
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
        <Icon size={12} className="flex-shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p className={`text-lg font-bold tabular-nums ${toneCls[tone]}`}>{value}</p>
    </div>
  )
}

function TutorTableRow({
  index,
  tutor,
}: {
  index: number
  tutor: TutorBrief
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: slots } = useTutorSlots(tutor.id)
  const { data: bookings } = useTutorBookings(tutor.id)
  const slotsReady = slots?.available
  const hasRating = tutor.avgRating != null && tutor.totalRatings > 0

  return (
    <tr
      onClick={() => navigate(`/tutors/${tutor.id}`)}
      className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.03] cursor-pointer transition-colors group"
    >
      <td className="px-4 py-3 text-slate-600 text-xs tabular-nums text-right w-10">
        {index}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-200 flex items-center justify-center text-sm font-bold flex-shrink-0">
            {tutor.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors">
            {tutor.name}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-400">
        <div className="flex items-center gap-1.5">
          <Building2 size={12} className="text-slate-600 flex-shrink-0" />
          {tutor.branch || '—'}
        </div>
      </td>
      <td className="px-4 py-3">
        {hasRating ? (
          <div className="flex items-center gap-1.5">
            <Stars value={tutor.avgRating!} />
            <span className="text-xs font-semibold text-amber-300 tabular-nums">
              {tutor.avgRating!.toFixed(1)}
            </span>
          </div>
        ) : (
          <span className="text-slate-600 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-slate-300">
        {slotsReady ? (
          `${slots!.workingDays} ${t('tutors.workingDays').toLowerCase()}`
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-slate-300">
        {slotsReady ? (
          `${slots!.totalHours} ${t('tutors.hoursShort')}`
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums">
        {bookings != null ? (
          <span className={bookings.total > 0 ? 'text-indigo-300 font-semibold' : 'text-slate-600'}>
            {bookings.total > 0 ? bookings.total : '—'}
          </span>
        ) : (
          <span className="text-slate-700">...</span>
        )}
      </td>
    </tr>
  )
}

export default function TutorsPage() {
  const { t } = useTranslation()
  const { data, isLoading, isError, error, refetch } = useTutors()
  const queryClient = useQueryClient()

  const waking = !!data && !data.available
  const ready = !!data && data.available

  const [query, setQuery] = useState('')
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [refreshing, setRefreshing] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  // After a new account is created we open the schedule editor for that tutor.
  const [newTutor, setNewTutor] = useState<TutorBrief | null>(null)

  // Empty weekly grid for a freshly-created tutor (no slots yet).
  const emptyDays = useMemo(
    () => WEEKDAYS.map((wd) => ({ weekday: wd, ranges: [] as ScheduleRange[] })),
    [],
  )

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    let rows = [...data.tutors]
    if (q) rows = rows.filter((tu) => tu.name.toLowerCase().includes(q))
    if (branchFilter !== 'all')
      rows = rows.filter((tu) => tu.branch === branchFilter)
    if (sortKey === 'rating') {
      rows.sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1))
    } else {
      rows.sort((a, b) => a.name.localeCompare(b.name))
    }
    return rows
  }, [data, query, branchFilter, sortKey])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tutors })
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('tutors.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('tutors.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all shadow-lg shadow-emerald-500/20"
          >
            <UserPlus size={14} />
            {t('tutors.create.addTutor')}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? t('tutors.refreshing') : t('tutors.refresh')}
          </button>
        </div>
      </div>

      {createOpen && (
        <CreateTutorModal
          onClose={() => setCreateOpen(false)}
          onCreated={(tutor) => {
            // Close the create form, then open the schedule editor for the
            // brand-new tutor so the work hours can be set straight away.
            setCreateOpen(false)
            setNewTutor(tutor)
          }}
        />
      )}

      {newTutor && (
        // Reuse the unified editor: it gives the new tutor a full 7-day grid
        // plus the "Mon–Fri 09:00–19:00" quick-fill button, so the weekly
        // schedule can be set in one click instead of day-by-day.
        <TutorEditModal
          tutor={newTutor}
          initialDays={emptyDays}
          onClose={() => {
            setNewTutor(null)
            void handleRefresh()
          }}
        />
      )}

      {/* Mars waking up (cold start) — auto-retrying */}
      {waking && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl px-4 py-3.5">
          <RefreshCw size={16} className="text-amber-300 animate-spin flex-shrink-0" />
          <div>
            <p className="text-amber-200 text-sm font-semibold">{t('tutors.waking')}</p>
            <p className="text-amber-300/70 text-xs mt-0.5">{t('tutors.wakingHint')}</p>
          </div>
        </div>
      )}

      {isLoading && <LoadingSpinner message={t('tutors.loading')} />}
      {isError && (
        <ErrorMessage
          message={(error as Error)?.message || t('tutors.loadError')}
          onRetry={() => refetch()}
        />
      )}

      {/* Toolbar: search + branch filter + sort */}
      {ready && (
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('tutors.searchPlaceholder')}
              className="w-full bg-[#161b27] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="sm:w-52 bg-[#161b27] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
          >
            <option value="all">{t('common.allBranches')}</option>
            {data.branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <button
            onClick={() => setSortKey((k) => (k === 'name' ? 'rating' : 'name'))}
            title={t('tutors.sort')}
            className="flex items-center justify-center gap-1.5 bg-[#161b27] border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.04] transition-colors flex-shrink-0"
          >
            <ArrowDownUp size={13} className="text-slate-500" />
            {sortKey === 'name' ? t('tutors.sortName') : t('tutors.sortRating')}
          </button>
        </div>
      )}

      {/* Tutor grid */}
      {ready && (
        <>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-600 uppercase tracking-wider font-semibold">
              {t('tutors.list')}
            </span>
            <span className="text-xs text-slate-600 tabular-nums">
              {filtered.length}
            </span>
          </div>

          {filtered.length > 0 ? (
            <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-600 w-10">#</th>
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-600">{t('tutors.sortName')}</th>
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-600">{t('tutors.edit.branch')}</th>
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-600">{t('tutors.sortRating')}</th>
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-600">{t('tutors.workingDays')}</th>
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-600">{t('tutors.weeklyHours')}</th>
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-600">Bookinglar</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tu, i) => (
                    <TutorTableRow key={tu.id} index={i + 1} tutor={tu} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl flex flex-col items-center py-16 gap-2">
              <Users size={28} className="text-slate-700" />
              <p className="text-slate-600 text-sm">{t('tutors.noResults')}</p>
            </div>
          )}
        </>
      )}

    </div>
  )
}
