import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Apercu } from '../data/espaceFranchise'
import type { RoleEquipe } from '../data/accesEquipe'

// Aperçu par le Directeur de réseau de l'espace d'un franchisé, ou de l'app telle que la voit un Coach
// ou un Responsable Régional (cle : nom du Coach ou identifiant du RR). Gardé le temps de l'onglet.
export interface ApercuEquipe { role: RoleEquipe; cle: string; nom: string }
interface EtatApercu {
  apercu: Apercu | null; ouvrir: (a: Apercu) => void
  equipe: ApercuEquipe | null; ouvrirEquipe: (a: ApercuEquipe) => void
  quitter: () => void
}
const Ctx = createContext<EtatApercu | null>(null)
const CLES_APERCU = { franchise: 'apercu-franchise', equipe: 'apercu-equipe' }

function lire<T>(cle: string, valide: (a: T) => boolean): T | null {
  try {
    const a = JSON.parse(sessionStorage.getItem(cle) ?? 'null') as T | null
    return a && valide(a) ? a : null
  } catch {
    return null
  }
}
function garder(cle: string, a: unknown) {
  try { if (a) sessionStorage.setItem(cle, JSON.stringify(a)); else sessionStorage.removeItem(cle) } catch { /* aperçu limité à l'écran */ }
}

export function ApercuProvider({ children }: { children: ReactNode }) {
  const [apercu, setApercu] = useState<Apercu | null>(() => lire<Apercu>(CLES_APERCU.franchise, (a) => typeof a.franchise === 'string' && Array.isArray(a.magasins)))
  const [equipe, setEquipe] = useState<ApercuEquipe | null>(() => lire<ApercuEquipe>(CLES_APERCU.equipe, (a) => (a.role === 'coach' || a.role === 'rr') && typeof a.cle === 'string' && typeof a.nom === 'string'))
  const changer = (a: Apercu | null, e: ApercuEquipe | null) => {
    garder(CLES_APERCU.franchise, a); garder(CLES_APERCU.equipe, e)
    setApercu(a); setEquipe(e)
  }
  return <Ctx.Provider value={{ apercu, ouvrir: (a) => changer(a, null), equipe, ouvrirEquipe: (e) => changer(null, e), quitter: () => changer(null, null) }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApercu(): EtatApercu {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApercu hors ApercuProvider')
  return c
}
