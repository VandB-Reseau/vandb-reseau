import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { chargerReseau } from './chargement'
import { synchroniserAcces } from './espaceFranchise'
import { corrigerDomicilesCoachs, corrigerPositions } from './geolocalisation'
import type { Reseau } from './modele'

interface EtatReseau {
  reseau: Reseau | null
  chargement: boolean
  erreur: boolean
  recharger: () => Promise<void>
}

const Ctx = createContext<EtatReseau | null>(null)

// charger : autre source (espace d'un franchisé) ; lectureSeule : aucune écriture en arrière-plan ;
// accesFranchises : le Directeur de réseau tient les accès des franchisés à jour
export function ReseauProvider({ children, charger = chargerReseau, lectureSeule = false, accesFranchises = false }: { children: ReactNode; charger?: () => Promise<Reseau>; lectureSeule?: boolean; accesFranchises?: boolean }) {
  const [reseau, setReseau] = useState<Reseau | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(false)

  // Le premier chargement affiche un squelette ; les suivants (après un enregistrement) se font en arrière-plan
  const recharger = useCallback(() => {
    setReseau((r) => { if (!r) setChargement(true); return r })
    setErreur(false)
    return charger()
      .then(setReseau)
      .catch(() => setErreur(true))
      .finally(() => setChargement(false))
  }, [charger])

  useEffect(() => { recharger() }, [recharger])

  // Magasins encore posés au centre de leur département : géolocalisation précise en arrière-plan
  const positionsCorrigees = useRef(false)
  useEffect(() => {
    if (!reseau || lectureSeule || positionsCorrigees.current) return
    positionsCorrigees.current = true
    Promise.all([corrigerPositions(reseau.magasins), corrigerDomicilesCoachs(reseau)])
      .then(([a, b]) => { if (a + b) recharger() }).catch(() => { /* nouvel essai à la prochaine session */ })
  }, [reseau, recharger, lectureSeule])

  // Accès des franchisés : magasins suivis après chaque chargement (associés, renommages)
  useEffect(() => {
    if (reseau && accesFranchises) synchroniserAcces(reseau).catch(() => { /* nouvel essai au prochain chargement */ })
  }, [reseau, accesFranchises])

  return <Ctx.Provider value={{ reseau, chargement, erreur, recharger }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReseau(): EtatReseau {
  const c = useContext(Ctx)
  if (!c) throw new Error('useReseau hors ReseauProvider')
  return c
}
