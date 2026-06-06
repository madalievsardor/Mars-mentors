import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bell, TrendingDown, Users, Save, CheckCircle,
  AlertCircle, SlidersHorizontal, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useNotificationSettings, useUpdateNotification, useMentors } from '../hooks/useQueries'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import type { NotificationSetting } from '../types'

interface LocalSetting extends NotificationSetting {
  dirty?: boolean
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
  const { data: mentors, isLoading: mentorsLoading } = useMentors()
  const { data: settings, isLoading: settingsLoading, isError, error, refetch } = useNotificationSettings()
  const updateMutation = useUpdateNotification()

  const [localSettings, setLocalSettings] = useState<LocalSetting[]>([])
  const [branchFilter, setBranchFilter] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (settings) setLocalSettings(settings.map((s) => ({ ...s, dirty: false })))
  }, [settings])

  // Mentors with decreased student count
  const decreasedMentors = useMemo(
    () => (mentors ?? []).filter((m) => m.trend === 'down' && m.prevStudentCount !== null),
    [mentors],
  )

  const branches = useMemo(
    () => Array.from(new Set(localSettings.map((s) => s.branch))).sort(),
    [localSettings],
  )

  const filteredSettings = useMemo(() => {
    if (!branchFilter) return localSettings
    return localSettings.filter((s) => s.branch === branchFilter)
  }, [localSettings, branchFilter])

  const dirtyCount = localSettings.filter((s) => s.dirty).length

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

  const isLoading = mentorsLoading || settingsLoading

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell size={22} className="text-indigo-400" />
            {t('notifications.title')}
          </h1>
          <p className="text-slate-500 text-sm mt-1">O'quvchi soni kamaygan mentorlar va Telegram sozlamalari</p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'success' && (
            <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
              <CheckCircle size={14} /> Saqlandi
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-red-400 text-sm">
              <AlertCircle size={14} /> Xato yuz berdi
            </span>
          )}
        </div>
      </div>

      {isLoading && <LoadingSpinner message="Yuklanmoqda..." />}
      {isError && <ErrorMessage message={(error as Error)?.message} onRetry={() => refetch()} />}

      {/* ── SECTION 1: Kamaygan mentorlar ── */}
      {!isLoading && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={16} className="text-red-400" />
            <h2 className="text-base font-semibold text-slate-200">O'quvchisi kamaygan mentorlar</h2>
            {decreasedMentors.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-xs font-semibold border border-red-500/25">
                {decreasedMentors.length} ta
              </span>
            )}
          </div>

          {decreasedMentors.length === 0 ? (
            <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl flex flex-col items-center py-10 gap-2">
              <CheckCircle size={32} className="text-emerald-500/50" />
              <p className="text-slate-500 text-sm">Hozircha hech kimda kamayish yo'q</p>
            </div>
          ) : (
            <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left py-3 px-5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Mentor</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Filial</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Kecha</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Bugun</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Farq</th>
                  </tr>
                </thead>
                <tbody>
                  {decreasedMentors.map((mentor) => {
                    const diff = (mentor.prevStudentCount ?? 0) - mentor.studentCount
                    return (
                      <tr key={mentor.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {mentor.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-slate-200 font-medium text-sm">{mentor.name}</p>
                              <p className="text-slate-600 text-xs">{mentor.grade}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-sm">{mentor.branch}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-slate-400 text-sm font-medium">{mentor.prevStudentCount}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-slate-200 text-sm font-semibold">{mentor.studentCount}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-red-400 font-semibold text-sm">
                            <TrendingDown size={13} />
                            -{diff}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 2: Telegram sozlamalari (collapsible) ── */}
      {!isLoading && localSettings.length > 0 && (
        <div>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#161b27] border border-white/[0.06] rounded-2xl hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-indigo-400" />
              <span className="text-slate-200 font-medium text-sm">Telegram bildirishnoma sozlamalari</span>
              <span className="text-slate-600 text-xs">— {localSettings.filter(s => s.enabled).length} ta yoqilgan</span>
            </div>
            {settingsOpen ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
          </button>

          {settingsOpen && (
            <div className="mt-3 space-y-3">
              {/* Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
                  <SlidersHorizontal size={14} className="text-slate-600" />
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="bg-transparent text-sm text-slate-300 focus:outline-none cursor-pointer appearance-none"
                  >
                    <option value="" className="bg-[#161b27]">Barcha filiallar</option>
                    {branches.map((b) => <option key={b} value={b} className="bg-[#161b27]">{b}</option>)}
                  </select>
                </div>
                <button
                  onClick={() => handleBulk(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-sm font-medium transition-colors"
                >
                  <CheckCircle size={13} /> Hammasini yoqish
                </button>
                <button
                  onClick={() => handleBulk(false)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-400 text-sm font-medium transition-colors"
                >
                  <AlertCircle size={13} /> Hammasini o'chirish
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={dirtyCount === 0 || saveStatus === 'saving'}
                  className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-all"
                >
                  {saveStatus === 'saving' ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
                  {dirtyCount > 0 ? `${dirtyCount} ta saqlash` : 'Saqlash'}
                </button>
              </div>

              {/* Table */}
              <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left py-3 px-5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Mentor</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Filial</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        <span title="Shu chegara soniga yetganda yoki kamaysa xabar keladi">Chegara</span>
                      </th>
                      <th className="text-center py-3 px-5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Holat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSettings.map((setting) => (
                      <tr
                        key={setting.mentorId}
                        className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${setting.dirty ? 'bg-amber-500/[0.04]' : ''}`}
                      >
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${setting.enabled ? 'bg-indigo-500/15 text-indigo-400' : 'bg-slate-700/50 text-slate-500'}`}>
                              {setting.mentorName.charAt(0)}
                            </div>
                            <p className={`font-medium text-sm ${setting.enabled ? 'text-slate-200' : 'text-slate-500'}`}>
                              {setting.mentorName}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-sm">{setting.branch}</td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center items-center gap-1.5">
                            <Users size={11} className="text-slate-600" />
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={setting.threshold}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10)
                                if (!isNaN(v) && v >= 1 && v <= 100) updateLocal(setting.mentorId, { threshold: v })
                              }}
                              className="w-14 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-center text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
                            />
                          </div>
                        </td>
                        <td className="py-3 px-5">
                          <div className="flex flex-col items-center gap-1">
                            <Toggle enabled={setting.enabled} onChange={(v) => updateLocal(setting.mentorId, { enabled: v })} />
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}
