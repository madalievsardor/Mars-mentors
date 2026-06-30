import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './i18n'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import MentorsPage from './pages/MentorsPage'
import InternsPage from './pages/InternsPage'
import AttendancePage from './pages/AttendancePage'
import GroupAttendancePage from './pages/GroupAttendancePage'
import TutorsPage from './pages/TutorsPage'
import TutorDetailPage from './pages/TutorDetailPage'
import NotificationsPage from './pages/NotificationsPage'
import MentorDetailPage from './pages/MentorDetailPage'
import LoginPage from './pages/LoginPage'
import { AuthContext, useAuth, useAuthState } from './hooks/useAuth'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
})

function AppRoutes() {
  const { isAuthenticated, logout, name } = useAuth()

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage onSuccess={() => {}} />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout onLogout={logout} userName={name} />}>
        <Route index element={<DashboardPage />} />
        <Route path="mentors" element={<MentorsPage />} />
        <Route path="mentors/:id" element={<MentorDetailPage />} />
        <Route path="interns" element={<InternsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="attendance/group/:groupId" element={<GroupAttendancePage />} />
        <Route path="tutors" element={<TutorsPage />} />
        <Route path="tutors/:id" element={<TutorDetailPage />} />
        {/* Backwards-compat: old /schedule path now points at Tutors. */}
        <Route path="schedule" element={<Navigate to="/tutors" replace />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function Root() {
  const authState = useAuthState()
  return (
    <AuthContext.Provider value={authState}>
      <AppRoutes />
    </AuthContext.Provider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
