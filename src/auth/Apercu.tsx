import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Apercu } from '../data/espaceFranchise'

// Aperçu de l'espace d'un franchisé par le Directeur de réseau (gardé le temps de l'onglet)
interface EtatApercu { apercu: Apercu | null; ouvrir: (a: Apercu) => void; quitter: () => void }
const Ctx = createContext<EtatApercu | null>(null)
const CLE = 'apercu-franchise'

function lire(): Apercu | null {
  try {
    const a = JSON.parse(sessionStorage.getItem(CLE) ?? 'null') as Apercu | null
    return a && typeof a.franchise === 'string' && Array.isArray(a.magasins) ? a : null
  } catch {
    return null
  }
}

export function ApercuProvider({ children }: { children: ReactNode }) {
  const [apercu, setApercu] = useState<Apercu | null>(lire)
  const changer = (a: Apercu | null) => {
    try { if (a) sessionStorage.setItem(CLE, JSON.stringify(a)); else sessionStorage.removeItem(CLE) } catch { /* aperçu limité à l'écran */ }
    setApercu(a)
  }
  return <Ctx.Provider value={{ apercu, ouvrir: changer, quitter: () => changer(null) }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApercu(): EtatApercu {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApercu hors ApercuProvider')
  return c
}
