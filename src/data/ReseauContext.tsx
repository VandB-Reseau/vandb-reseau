import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { chargerReseau } from './chargement'
import { corrigerDomicilesCoachs, corrigerPositions } from './geolocalisation'
import type { Reseau } from './modele'

interface EtatReseau {
  reseau: Reseau | null
  chargement: boolean
  erreur: boolean
  recharger: () => Promise<void>
}

const Ctx = createContext<EtatReseau | null>(null)

export function ReseauProvider({ children }: { children: ReactNode }) {
  const [reseau, setReseau] = useState<Reseau | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(false)

  // Le premier chargement affiche un squelette ; les suivants (après un enregistrement) se font en arrière-plan
  const recharger = useCallback(() => {
    setReseau((r) => { if (!r) setChargement(true); return r })
    setErreur(false)
    return chargerReseau()
      .then(setReseau)
      .catch(() => setErreur(true))
      .finally(() => setChargement(false))
  }, [])

  useEffect(() => { recharger() }, [recharger])

  // Magasins encore posés au centre de leur département : géolocalisation précise en arrière-plan
  const positionsCorrigees = useRef(false)
  useEffect(() => {
    if (!reseau || positionsCorrigees.current) return
    positionsCorrigees.current = true
    Promise.all([corrigerPositions(reseau.magasins), corrigerDomicilesCoachs(reseau)])
      .then(([a, b]) => { if (a + b) recharger() }).catch(() => { /* nouvel essai à la prochaine session */ })
  }, [reseau, recharger])

  return <Ctx.Provider value={{ reseau, chargement, erreur, recharger }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReseau(): EtatReseau {
  const c = useContext(Ctx)
  if (!c) throw new Error('useReseau hors ReseauProvider')
  return c
}
