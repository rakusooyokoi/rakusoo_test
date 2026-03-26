'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import { Session } from '@supabase/supabase-js'

type AuthContextType = {
  session: Session | null
  role: string
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({ session: null, role: '', loading: true, logout: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadRole(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadRole(session.user.id)
      else { setRole(''); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadRole(userId: string) {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
    setRole(data?.role || 'user')
    setLoading(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    setSession(null)
    setRole('')
  }

  return <AuthContext.Provider value={{ session, role, loading, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }
