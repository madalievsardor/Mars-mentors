import { useState, useMemo, useEffect } from 'react'
import { Bell, SlidersHorizontal, Save, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useNotificationSettings, useUpdateNotification } from '../hooks/useQueries'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import type { NotificationSetting } from '../types'

interface LocalSetting extends NotificationSetting {
  dirty?: boolean
}

export default function NotificationsPage() {
  const { data: settings, isLoading, isError, error, refetch } = useNotificationSettings()
  const updateMutation = useUpdateNotification()

  const [localSettings, setLocalSettings] = useState<LocalSetting[]>([])
  const [branchFilter, setBranchFilter] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings.map((s) => ({ ...s, dirty: false })))
    }
  }, [settings])

  const branches = useMemo(
    () => Array.from(new Set(localSettings.map((s) => s.branch))).sort(),
    [localSettings],
  )

  const filtered = useMemo(() => {
    if (!branchFilter) return localSettings
    return localSettings.filter((s) => s.branch === branchFilter)
  }, [localSettings, branchFilter])

  const dirtyCount = localSettings.filter((s) => s.dirty).length
  const enabledCount = filtered.filter((s) => s.enabled).length

  const updateLocal = (
    mentorId: string,
    changes: Partial<Pick<LocalSetting, 'enabled' | 'threshold'>>,
  ) => {
    setLocalSettings((prev) =>
      prev.map((s) => (s.mentorId === mentorId ? { ...s, ...changes, dirty: true } : s)),
    )
  }

  const handleEnableAll = (branch?: string) => {
    setLocalSettings((prev) =>
      prev.map((s) => (!branch || s.branch === branch ? { ...s, enabled: true, dirty: true } : s)),
    )
  }

  const handleDisableAll = (branch?: string) => {
    setLocalSettings((prev) =>
      prev.map((s) => (!branch || s.branch === branch ? { ...s, enabled: false, dirty: true } : s)),
    )
  }

  const handleSaveAll = async () => {
    const dirty = localSettings.filter((s) => s.dirty)
    if (dirty.length === 0) return
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
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Bildirishnomalar</h1>
          <p className="text-slate-500 text-sm mt-1">Mentor bildirishnoma sozlamalari</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {saveStatus === 'success' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              <CheckCircle size={14} />
              <span>Saqlandi</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={14} />
              <span>Xatolik</span>
            </div>
          )}
          <button
            onClick={handleSaveAll}
            disabled={dirtyCount === 0 || saveStatus === 'saving'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
          >
            {saveStatus === 'saving' ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Save size={14} />
            )}
            {saveStatus === 'saving'
              ? 'Saqlanmoqda...'
              : dirtyCount > 0
              ? `Saqlash (${dirtyCount})`
              : 'Saqlash'}
          </button>
        </div>
      </div>

      {/* Filters + bulk actions */}
      <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 flex-1 min-w-48">
            <SlidersHorizontal size={14} className="text-slate-600 flex-shrink-0" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="grow bg-transparent text-sm text-slate-300 focus:outline-none cursor-pointer appearance-none"
            >
              <option value="" className="bg-[#161b27]">Barcha filiallar</option>
              {branches.map((b) => (
                <option key={b} value={b} className="bg-[#161b27]">{b}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleEnableAll(branchFilter || undefined)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-sm font-medium transition-colors"
            >
              <CheckCircle size={13} />
              {branchFilter ? 'Filial yoqish' : 'Hammasini yoqish'}
            </button>
            <button
              onClick={() => handleDisableAll(branchFilter || undefined)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-colors"
            >
              <XCircle size={13} />
              {branchFilter ? "Filial o'chirish" : "Hammasini o'chirish"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {!isLoading && !isError && localSettings.length > 0 && (
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <span className="text-slate-500">
            Ko'rsatilmoqda:{' '}
            <span className="text-slate-300 font-semibold">{filtered.length}</span> ta mentor
          </span>
          <span className="text-slate-700">•</span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Yoqilgan:{' '}
            <span className="text-emerald-400 font-semibold ml-0.5">{enabledCount}</span>
          </span>
          <span className="text-slate-700">•</span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-600" />
            O'chirilgan:{' '}
            <span className="text-slate-400 font-semibold ml-0.5">{filtered.length - enabledCount}</span>
          </span>
          {dirtyCount > 0 && (
            <>
              <span className="text-slate-700">•</span>
              <span className="text-amber-400 font-medium">{dirtyCount} ta saqlanmagan o'zgarish</span>
            </>
          )}
        </div>
      )}

      {isLoading && <LoadingSpinner message="Sozlamalar yuklanmoqda..." />}
      {isError && <ErrorMessage message={(error as Error)?.message} onRetry={() => refetch()} />}

      {/* Table */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-3 px-5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Mentor</th>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Filial</th>
                  <th className="text-center py-3 px-5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Holat</th>
                  <th className="text-center py-3 px-5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Chegara</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((setting) => (
                  <DesktopRow
                    key={setting.mentorId}
                    setting={setting}
                    onToggle={(v) => updateLocal(setting.mentorId, { enabled: v })}
                    onThresholdChange={(v) => updateLocal(setting.mentorId, { threshold: v })}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-white/[0.04]">
            {filtered.map((setting) => (
              <MobileRow
                key={setting.mentorId}
                setting={setting}
                onToggle={(v) => updateLocal(setting.mentorId, { enabled: v })}
                onThresholdChange={(v) => updateLocal(setting.mentorId, { threshold: v })}
              />
            ))}
          </div>
        </div>
      )}

      {!isLoading && !isError && localSettings.length === 0 && (
        <div className="bg-[#161b27] border border-white/[0.06] rounded-2xl flex flex-col items-center py-20 gap-3">
          <Bell size={40} className="text-slate-700" />
          <p className="text-slate-500">Bildirishnoma sozlamalari mavjud emas</p>
        </div>
      )}
    </div>
  )
}

interface RowProps {
  setting: LocalSetting
  onToggle: (v: boolean) => void
  onThresholdChange: (v: number) => void
}

function DesktopRow({ setting, onToggle, onThresholdChange }: RowProps) {
  return (
    <tr className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${setting.dirty ? 'bg-amber-500/[0.03]' : ''}`}>
      <td className="py-3.5 px-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
            {setting.mentorName.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-slate-200 text-sm">{setting.mentorName}</p>
            {setting.dirty && <p className="text-amber-400 text-xs">O'zgartirildi</p>}
          </div>
        </div>
      </td>
      <td className="py-3.5 px-5 text-slate-500 text-sm">{setting.branch}</td>
      <td className="py-3.5 px-5">
        <div className="flex flex-col items-center gap-1">
          <input
            type="checkbox"
            className="toggle toggle-success toggle-sm"
            checked={setting.enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className={`text-xs ${setting.enabled ? 'text-emerald-400' : 'text-slate-600'}`}>
            {setting.enabled ? 'Yoqilgan' : "O'chirilgan"}
          </span>
        </div>
      </td>
      <td className="py-3.5 px-5">
        <div className="flex justify-center">
          <input
            type="number"
            min={1}
            max={100}
            value={setting.threshold}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              if (!isNaN(v) && v >= 1 && v <= 100) onThresholdChange(v)
            }}
            className="w-20 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-center text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>
      </td>
    </tr>
  )
}

function MobileRow({ setting, onToggle, onThresholdChange }: RowProps) {
  return (
    <div className={`p-4 ${setting.dirty ? 'bg-amber-500/[0.03]' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
            {setting.mentorName.charAt(0)}
          </div>
          <div>
            <p className="text-slate-200 font-medium text-sm">{setting.mentorName}</p>
            <p className="text-slate-600 text-xs">{setting.branch}</p>
            {setting.dirty && <p className="text-amber-400 text-xs">O'zgartirildi</p>}
          </div>
        </div>
        <input
          type="checkbox"
          className="toggle toggle-success toggle-sm"
          checked={setting.enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-slate-600 text-xs flex-1">Chegara (o'quvchilar):</span>
        <input
          type="number"
          min={1}
          max={100}
          value={setting.threshold}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (!isNaN(v) && v >= 1 && v <= 100) onThresholdChange(v)
          }}
          className="w-20 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-center text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
        />
        <span className={`text-xs ${setting.enabled ? 'text-emerald-400' : 'text-slate-600'}`}>
          {setting.enabled ? 'Yoqilgan' : "O'chirilgan"}
        </span>
      </div>
    </div>
  )
}
