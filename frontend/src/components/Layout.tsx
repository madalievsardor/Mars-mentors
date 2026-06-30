import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, GraduationCap, Bell, BookUser, CalendarCheck, LogOut, ChevronDown, Activity } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface LayoutProps {
  onLogout: () => void
  userName: string | null
}

const LANGS = [
  { code: 'uz', label: 'UZ' },
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
]

function SidebarContent({
  onNavigate,
  onLogout,
  userName,
}: {
  onNavigate?: () => void
  onLogout: () => void
  userName: string | null
}) {
  const { t, i18n } = useTranslation()
  const [showLogout, setShowLogout] = useState(false)

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    { to: '/mentors', label: t('nav.mentors'), icon: Users },
    { to: '/interns', label: t('nav.interns'), icon: GraduationCap },
    { to: '/attendance', label: t('nav.attendance'), icon: CalendarCheck },
    { to: '/tutors', label: t('nav.tutors'), icon: BookUser },
    { to: '/notifications', label: t('nav.notifications'), icon: Bell },
    { to: '/logs', label: t('nav.logs'), icon: Activity },
  ]

  return (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <img
            src="/mars-logo.jpg"
            alt="Mars IT School"
            className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
          />
          <div>
            <div className="font-bold text-white text-sm leading-tight tracking-tight">Mars IT</div>
            <div className="text-slate-500 text-xs">Academy Dashboard</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        <p className="text-xs text-slate-600 uppercase tracking-widest mb-3 px-3 font-semibold">
          {t('nav.navigation')}
        </p>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              isActive
                ? 'sidebar-nav-active flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium'
                : 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] transition-all duration-150'
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} className={isActive ? 'text-indigo-300' : 'text-slate-600'} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Language switcher */}
      <div className="px-3 pb-2">
        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
          {LANGS.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => i18n.changeLanguage(code)}
              className={
                i18n.language === code
                  ? 'flex-1 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white transition-all'
                  : 'flex-1 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-all'
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* User */}
      <div className="p-3 border-t border-white/[0.06]">
        <button
          onClick={() => setShowLogout((v) => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all text-left group"
        >
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
            {(userName ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-200 text-sm font-medium truncate">{userName ?? 'Foydalanuvchi'}</p>
            <p className="text-slate-600 text-xs">{t('nav.account')}</p>
          </div>
          <ChevronDown
            size={14}
            className={`text-slate-600 transition-transform ${showLogout ? 'rotate-180' : ''}`}
          />
        </button>

        {showLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-400 text-sm font-medium transition-colors mt-1"
          >
            <LogOut size={15} />
            {t('nav.logout')}
          </button>
        )}
      </div>
    </>
  )
}

export default function Layout({ onLogout, userName }: LayoutProps) {
  return (
    <div className="drawer lg:drawer-open min-h-screen bg-mesh">
      <input id="main-drawer" type="checkbox" className="drawer-toggle" />

      <div className="drawer-content flex flex-col min-h-screen">
        {/* Mobile navbar */}
        <div className="navbar bg-[#0d1117]/90 border-b border-white/[0.06] lg:hidden sticky top-0 z-30 backdrop-blur-md">
          <div className="flex-none">
            <label htmlFor="main-drawer" aria-label="Menyu ochish" className="btn btn-square btn-ghost text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block h-5 w-5 stroke-current">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </label>
          </div>
          <div className="flex-1 flex items-center gap-2 ml-1">
            <img src="/mars-logo.jpg" alt="Mars IT" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-bold text-white text-sm">Mars IT Academy</span>
          </div>
        </div>

        <main className="flex-1 bg-[#0d1117]">
          <Outlet />
        </main>
      </div>

      <div className="drawer-side z-40">
        <label htmlFor="main-drawer" aria-label="Menyuni yopish" className="drawer-overlay" />
        <aside className="w-60 min-h-full bg-[#0d1117] border-r border-white/[0.06] flex flex-col">
          <SidebarContent onLogout={onLogout} userName={userName} />
        </aside>
      </div>
    </div>
  )
}
