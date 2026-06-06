import { createContext, useContext, useState, useCallback } from 'react'
import axios from 'axios'

const TOKEN_KEY = 'mars_dashboard_token'
const NAME_KEY = 'mars_dashboard_name'

const apiBase = import.meta.env.VITE_API_URL ?? '/api'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

interface AuthContextValue {
  token: string | null
  name: string | null
  isAuthenticated: boolean
  login: (phone: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuthState(): AuthContextValue {
  const [token, setToken] = useState<string | null>(getStoredToken)
  const [name, setName] = useState<string | null>(() => localStorage.getItem(NAME_KEY))

  const login = useCallback(async (phone: string, password: string) => {
    const { data } = await axios.post<{ access_token: string; name: string }>(
      `${apiBase}/auth/login`,
      { phone, password },
    )
    localStorage.setItem(TOKEN_KEY, data.access_token)
    localStorage.setItem(NAME_KEY, data.name)
    setToken(data.access_token)
    setName(data.name)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(NAME_KEY)
    setToken(null)
    setName(null)
  }, [])

  return { token, name, isAuthenticated: Boolean(token), login, logout }
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
