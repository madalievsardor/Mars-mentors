import { useState, useRef, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff, AlertCircle, ChevronDown, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const SAVED_CREDS_KEY = 'mars_saved_credentials'

interface SavedCredential {
  phone: string
  password: string
}

function getSavedCredentials(): SavedCredential[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_CREDS_KEY) ?? '[]') as SavedCredential[]
  } catch {
    return []
  }
}

function saveCredential(phone: string, password: string) {
  const existing = getSavedCredentials().filter((c) => c.phone !== phone)
  existing.unshift({ phone, password })
  localStorage.setItem(SAVED_CREDS_KEY, JSON.stringify(existing.slice(0, 10)))
}

function removeCredential(phone: string) {
  const updated = getSavedCredentials().filter((c) => c.phone !== phone)
  localStorage.setItem(SAVED_CREDS_KEY, JSON.stringify(updated))
}

interface LoginPageProps {
  onSuccess: () => void
}

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const { login } = useAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [savedCreds, setSavedCreds] = useState<SavedCredential[]>(getSavedCredentials)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectCredential = (cred: SavedCredential) => {
    setPhone(cred.phone)
    setPassword(cred.password)
    setShowDropdown(false)
  }

  const handleRemove = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation()
    removeCredential(phone)
    const updated = getSavedCredentials()
    setSavedCreds(updated)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!phone.trim() || !password.trim()) return
    setLoading(true)
    setError('')
    try {
      await login(phone.trim(), password)
      saveCredential(phone.trim(), password)
      setSavedCreds(getSavedCredentials())
      onSuccess()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Telefon raqam yoki parol xato'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4 bg-mesh">
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <img
              src="/mars-logo.jpg"
              alt="Mars IT School"
              className="w-16 h-16 rounded-2xl object-cover shadow-2xl"
            />
            <div className="absolute -inset-1 rounded-2xl opacity-20 blur-md -z-10 bg-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Mars IT Academy</h1>
          <p className="text-slate-500 text-sm mt-1">Dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-[#161b27] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
          <h2 className="text-base font-semibold text-slate-200 mb-5">Kirish</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Telefon raqam
              </label>
              <div className="relative" ref={dropdownRef}>
                <input
                  ref={inputRef}
                  type="tel"
                  placeholder="+998901234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onFocus={() => savedCreds.length > 0 && setShowDropdown(true)}
                  autoComplete="off"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 pr-10 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all"
                />
                {savedCreds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowDropdown((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                    tabIndex={-1}
                  >
                    <ChevronDown size={15} className={showDropdown ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  </button>
                )}

                {/* Dropdown */}
                {showDropdown && savedCreds.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1e2433] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden">
                    {savedCreds.map((cred) => (
                      <div
                        key={cred.phone}
                        onClick={() => selectCredential(cred)}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.05] cursor-pointer group transition-colors"
                      >
                        <div>
                          <p className="text-sm text-slate-200">{cred.phone}</p>
                          <p className="text-xs text-slate-600">{'•'.repeat(Math.min(cred.password.length, 10))}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleRemove(e, cred.phone)}
                          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Parol
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 pr-10 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle size={14} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !phone.trim() || !password.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 mt-2"
            >
              {loading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : null}
              {loading ? 'Kirilmoqda...' : 'Kirish'}
            </button>
          </form>

          <p className="text-center text-slate-600 text-xs mt-5">
            Mars IT telefon raqamingiz + dashboard paroli bilan kiring
          </p>
        </div>
      </div>
    </div>
  )
}
