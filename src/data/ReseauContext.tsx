import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { chargerReseau } from './chargement'
import type { Reseau } from './modele'

interface EtatReseau {
  reseau: Reseau | null
  chargement: boolean
  erreur: boolean
  recharger: () => void
}

const Ctx = createContext<EtatReseau | null>(null)

export function ReseauProvider({ children }: { children: ReactNode }) {
  const [reseau, setReseau] = useState<Reseau | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(false)

  const recharger = useCallback(() => {
    setChargement(true)
    setErreur(false)
    chargerReseau()
      .then(setReseau)
      .catch(() => setErreur(true))
      .finally(() => setChargement(false))
  }, [])

  useEffect(recharger, [recharger])

  return <Ctx.Provider value={{ reseau, chargement, erreur, recharger }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReseau(): EtatReseau {
  const c = useContext(Ctx)
  if (!c) throw new Error('useReseau hors ReseauProvider')
  return c
}
