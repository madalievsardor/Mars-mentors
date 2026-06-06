import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, Search, Save, CheckCircle, XCircle, AlertCircle, SlidersHorizontal } from 'lucide-react'
import { useNotificationSettings, useUpdateNotification, useMentors } from '../hooks/useQueries'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import type { NotificationSetting } from '../types'

interface LocalSetting extends NotificationSetting {
  dirty?: boolean
  currentStudents?: number
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        enabled ? 'bg-emerald-500' : 'bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function NotificationsPage() {
  const { t } = useTranslation()
  const { data: settings, isLoading, isError, error, refetch } = useNotificationSettings()
  const { data: mentors } = useMentors()
  const updateMutation = useUpdateNotification()

  const [localSettings, setLocalSettings] = useState<LocalSetting[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  useEffect(() => {
    if (settings) {
      const mentorMap = new Map(mentors?.map((m) => [m.mentorId, m.studentCount]) ?? [])
      setLocalSettings(
        settings.map((s) => ({
          ...s,
          dirty: false,
          currentStudents: mentorMap.get(s.mentorId) ?? undefined,
        })),
      )
    }
  }, [settings, mentors])

  const branches = useMemo(
    () => Array.from(new Set(localSettings.map((s) => s.branch))).sort(),
    [localSettings],
  )

  const filtered = useMemo(() => {
    let result = localSettings
    if (branchFilter) result = result.filter((s) => s.branch === branchFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((s) => s.mentorName.toLowerCase().includes(q))
    }
    return result
  }, [localSettings, branchFilter, searchQuery])

  const dirtyCount = localSettings.filter((s) => s.dirty).length
  const enabledCount = filtered.filter((s) => s.enabled).length

  const updateLocal = (mentorId: string, changes: Partial<Pick<LocalSetting, 'enabled' | 'threshold'>>) => {
    setLocalSettings((prev) =>
      prev.map((s) => (s.mentorId === mentorId ? { ...s, ...changes, dirty: true } : s)),
    )
  }

  const handleBulk = (enable: boolean) => {
    setLocalSettings((prev) =>
      prev.map((s) =>
        !branchFilter || s.branch === branchFilter ? { ...s, enabled: enable, dirty: true } : s,
      ),
    )
  }

  const handleSaveAll = async () => {
    const dirty = localSettings.filter((s) => s.dirty)
    if (!dirty.length) return
    setSaveStatus('saving')
    try {
      await Promise.all(
        dirty.map((s) =>
          updateMutation.mutateAsync({
            mentorId: s.mentorId,
            payload: { enabled: s.enabled, threshold: s.threshold },
          }),
        ),
      )
      setLocalSettings((prev) => prev.map((s) => ({ ...s, dirty: false })))
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell size={22} className="text-indigo-400" />
            {t('notifications.title')}
          </h1>
          <p className="text-slate-500 text-sm mt-1">{t('notifications.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {saveStatus === 'success' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              <CheckCircle size={14} /> {t('notifications.saved')}
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={14} /> {t('notifications.error')}
            </div>
          )}
          <button
            onClick={handleSaveAll}
            disabled={dirtyCount === 0 || saveStatus === 'saving'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
          >
            {saveStatus === 'saving' ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
            {saveStatus === 'saving'
              ? t('notifications.saving')
              : dirtyCount > 0
              ? t('notifications.saveCount', { count: dirtyCount })
              : t('notifications.save')}
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-indigo-500/[0.07] border border-indigo-500/20 rounded-2xl px-4 py-3 text-sm text-slate-400">
        <span className="text-indigo-300 font-medium">Qanday ishlaydi?</span>
        {' '}Mentor o'quvchi soni kamaysa yoki chegara qiymatiga yetsa — Telegram'ga bildirishnoma keladi.
        Har bir mentor uchun alohida yoqish/o'chirish va chegara qiymati belgilash mumkin.
      </div>

      {/* Filters */}
      <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 flex-1 min-w-48">
            <Search size={14} className="text-slate-600 flex-shrink-0" />
            <input
              type="text"
              placeholder="Mentor qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="grow bg-transparent text-sm text-slate-300 placeholder-slate-600 outline-none"
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

          <button
            onClick={() => handleBulk(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-sm font-medium transition-colors"
          >
            <CheckCircle size={13} />
            {branchFilter ? t('notifications.enableBranch') : t('notifications.enableAll')}
          </button>
          <button
            onClick={() => handleBulk(false)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-400 text-sm font-medium transition-colors"
          >
            <XCircle size={13} />
            {branchFilter ? t('notifications.disableBranch') : t('notifications.disableAll')}
          </button>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && !isError && localSettings.length > 0 && (
        <div className="flex items-center gap-5 text-sm flex-wrap">
          <span className="text-slate-500">
            Jami: <span className="text-slate-300 font-semibold">{filtered.length} ta mentor</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-500">{t('notifications.enabled')}:</span>
            <span className="text-emerald-400 font-semibold">{enabledCount}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-600" />
            <span className="text-slate-500">{t('notifications.disabled')}:</span>
            <span className="text-slate-400 font-semibold">{filtered.length - enabledCount}</span>
          </span>
          {dirtyCount > 0 && (
            <span className="text-amber-400 font-medium">
              ⚠ {dirtyCount} ta o'zgarish saqlanmagan
            </span>
          )}
        </div>
      )}

      {isLoading && <LoadingSpinner message={t('notifications.loading')} />}
      {isError && <ErrorMessage message={(error as Error)?.message} onRetry={() => refetch()} />}

      {/* Table */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-3 px-5 text-xs font-semibold text-slate-600 uppercase tracking-wider w-1/3">Mentor</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Filial</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Joriy</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <span title="Shu chegara soniga yetganda xabar keladi">Chegara ⓘ</span>
                </th>
                <th className="text-center py-3 px-5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Holat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((setting) => (
                <tr
                  key={setting.mentorId}
                  className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${
                    setting.dirty ? 'bg-amber-500/[0.04]' : ''
                  }`}
                >
                  {/* Mentor */}
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        setting.enabled ? 'bg-indigo-500/15 text-indigo-400' : 'bg-slate-700/50 text-slate-500'
                      }`}>
                        {setting.mentorName.charAt(0)}
                      </div>
                      <div>
                        <p className={`font-medium text-sm ${setting.enabled ? 'text-slate-200' : 'text-slate-500'}`}>
                          {setting.mentorName}
                        </p>
                        {setting.dirty && (
                          <p className="text-amber-400 text-xs">o'zgartirildi</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Branch */}
                  <td className="py-3 px-4">
                    <span className="text-slate-500 text-sm">{setting.branch}</span>
                  </td>

                  {/* Current students */}
                  <td className="py-3 px-4 text-center">
                    {setting.currentStudents !== undefined ? (
                      <span className={`text-sm font-semibold ${
                        setting.currentStudents >= setting.threshold
                          ? 'text-red-400'
                          : setting.currentStudents >= setting.threshold * 0.8
                          ? 'text-amber-400'
                          : 'text-slate-300'
                      }`}>
                        {setting.currentStudents}
                      </span>
                    ) : (
                      <span className="text-slate-700 text-sm">—</span>
                    )}
                  </td>

                  {/* Threshold */}
                  <td className="py-3 px-4">
                    <div className="flex justify-center">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={setting.threshold}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10)
                          if (!isNaN(v) && v >= 1 && v <= 100) updateLocal(setting.mentorId, { threshold: v })
                        }}
                        className="w-16 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-center text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
                      />
                    </div>
                  </td>

                  {/* Toggle */}
                  <td className="py-3 px-5">
                    <div className="flex flex-col items-center gap-1">
                      <Toggle
                        enabled={setting.enabled}
                        onChange={(v) => updateLocal(setting.mentorId, { enabled: v })}
                      />
                      <span className={`text-xs font-medium ${setting.enabled ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {setting.enabled ? 'Yoqiq' : 'O\'chiq'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && localSettings.length > 0 && (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl flex flex-col items-center py-16 gap-3">
          <Search size={36} className="text-slate-700" />
          <p className="text-slate-500">Hech narsa topilmadi</p>
          <button
            onClick={() => { setSearchQuery(''); setBranchFilter('') }}
            className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
          >
            Filtrni tozalash
          </button>
        </div>
      )}

      {!isLoading && !isError && localSettings.length === 0 && (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl flex flex-col items-center py-20 gap-3">
          <Bell size={40} className="text-slate-700" />
          <p className="text-slate-500">{t('notifications.noSettings')}</p>
        </div>
      )}
    </div>
  )
}
