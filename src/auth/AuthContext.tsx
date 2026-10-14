import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profil } from './roles'

interface AuthState {
  session: Session | null
  profil: Profil | null
  chargement: boolean
  connexion: (email: string, motDePasse: string) => Promise<string | null>
  deconnexion: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// Tant que la table des profils n'existe pas, tout compte connecté est Directeur (Joseph seul a un compte).
function profilDepuisSession(session: Session | null): Profil | null {
  if (!session) return null
  const email = session.user.email ?? ''
  return { id: session.user.id, email, nom: nomDepuisEmail(email), role: 'directeur', perimetre: {} }
}

// « joseph.martin@… » → « Joseph » (en attendant la table des profils)
function nomDepuisEmail(email: string): string {
  const prenom = email.split('@')[0].split(/[._-]/)[0]
  return prenom.charAt(0).toUpperCase() + prenom.slice(1)
}

function messageErreur(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'Email ou mot de passe incorrect.'
  if (m.includes('email not confirmed')) return 'Ton email n’est pas encore confirmé. Ouvre le lien reçu par email.'
  if (m.includes('fetch') || m.includes('network')) return 'Pas de connexion internet. Réessaie dans un instant.'
  return 'Connexion impossible pour le moment. Réessaie dans un instant.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChargement(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const value: AuthState = {
    session,
    profil: profilDepuisSession(session),
    chargement,
    connexion: async (email, motDePasse) => {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
        return error ? messageErreur(error.message) : null
      } catch (e) {
        return messageErreur(String(e))
      }
    },
    deconnexion: async () => {
      await supabase.auth.signOut()
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth hors AuthProvider')
  return ctx
}
