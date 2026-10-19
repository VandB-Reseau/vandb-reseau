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

interface Acces { role?: string; coach?: string | null; rr?: string | null; franchise?: string | null; magasins?: string[] | null }

// Rôle et périmètre du compte. Ils sont lus dans la base (fonction mon_acces) : le jeton de connexion
// peut dater d'une heure. Sans cette fonction (script pas encore passé), on lit app_metadata,
// et un compte sans rôle est Directeur, comme avant.
function profilDepuis(session: Session | null, acces: Acces | null): Profil | null {
  if (!session) return null
  const email = session.user.email ?? ''
  const meta = acces ?? ((session.user.app_metadata ?? {}) as Acces)
  const base = { id: session.user.id, email, nom: nomDepuisEmail(email) }
  if (meta.role === 'coach' && meta.coach) return { ...base, role: 'coach', perimetre: { coachs: [meta.coach] } }
  if (meta.role === 'rr' && meta.rr) return { ...base, role: 'rr', perimetre: { rr: [meta.rr] } }
  if (meta.role === 'franchise' && acces?.franchise) return { ...base, role: 'franchise', perimetre: { franchise: acces.franchise, magasins: acces.magasins ?? [] } }
  if (acces && acces.role !== 'directeur' && acces.role !== 'coach' && acces.role !== 'rr') return { ...base, role: 'aucun', perimetre: {} }
  return { ...base, role: 'directeur', perimetre: {} }
}

// null : fonction absente ou injoignable (on se rabat sur le jeton)
async function lireAcces(): Promise<Acces | null> {
  try {
    const { data, error } = await supabase.rpc('mon_acces')
    if (error || !data || typeof data !== 'object') return null
    return data as Acces
  } catch {
    return null
  }
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
  const [acces, setAcces] = useState<{ user: string; acces: Acces | null } | null>(null)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setChargement(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Le rôle se relit à chaque changement de compte
  const utilisateur = session?.user.id ?? null
  useEffect(() => {
    if (!utilisateur) { setAcces(null); return }
    let actif = true
    lireAcces().then((a) => { if (actif) { setAcces({ user: utilisateur, acces: a }); setChargement(false) } })
    return () => { actif = false }
  }, [utilisateur])

  const accesPret = !utilisateur || acces?.user === utilisateur
  const value: AuthState = {
    session,
    profil: accesPret ? profilDepuis(session, acces?.acces ?? null) : null,
    chargement: chargement || !accesPret,
    connexion: async (email, motDePasse) => {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
        return error ? messageErreur(error.message) : null
      } catch (e) {
        return messageErreur(String(e))
      }
    },
    deconnexion: async () => {
      try { sessionStorage.removeItem('apercu-franchise') } catch { /* rien à effacer */ }
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
