import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { chargerReseau } from './chargement'
import { synchroniserAcces } from './espaceFranchise'
import { corrigerDomicilesCoachs, corrigerPositions } from './geolocalisation'
import type { Reseau } from './modele'
import { magasinsDu, synchroniserPerimetre, type Perimetre } from './perimetre'
import { ecrireCache, lireCache } from '../lib/cacheLocal'

interface EtatReseau {
  reseau: Reseau | null
  complet: Reseau | null // tout le réseau, même pour un Coach ou un RR (carte)
  chargement: boolean
  erreur: boolean
  recharger: () => Promise<void>
}

const Ctx = createContext<EtatReseau | null>(null)

// charger : autre source (espace d'un franchisé) ; lectureSeule : aucune écriture en arrière-plan ;
// accesFranchises : le Directeur de réseau tient à jour les accès des franchisés et le périmètre de l'équipe ;
// perimetre : un Coach ou un Responsable Régional ne voit que ses magasins et leurs visites ;
// cache : clé des dernières données gardées sur l'appareil, affichées aussitôt à l'ouverture
export function ReseauProvider({ children, charger = chargerReseau, lectureSeule = false, accesFranchises = false, perimetre = null, cache }: { children: ReactNode; charger?: () => Promise<Reseau>; lectureSeule?: boolean; accesFranchises?: boolean; perimetre?: Perimetre | null; cache?: string }) {
  const [reseau, setReseau] = useState<Reseau | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(false)
  const frais = useRef(false)

  // Le premier chargement affiche un squelette ; les suivants (après un enregistrement) se font en arrière-plan
  const recharger = useCallback(() => {
    setReseau((r) => { if (!r) setChargement(true); return r })
    setErreur(false)
    return charger()
      .then((r) => { frais.current = true; setReseau(r); if (cache) void ecrireCache(cache, r) })
      .catch(() => setErreur(true))
      .finally(() => setChargement(false))
  }, [charger, cache])

  useEffect(() => { recharger() }, [recharger])

  // Dernières données de l'appareil en attendant la base (jamais par-dessus des données fraîches)
  useEffect(() => {
    if (!cache) return
    let actif = true
    lireCache<Reseau>(cache).then((r) => {
      if (!actif || !r || frais.current) return
      setReseau((avant) => avant ?? r)
      setChargement(false)
    })
    return () => { actif = false }
  }, [cache])

  // Magasins encore posés au centre de leur département : géolocalisation précise en arrière-plan
  const positionsCorrigees = useRef(false)
  useEffect(() => {
    if (!reseau || !frais.current || lectureSeule || positionsCorrigees.current) return
    positionsCorrigees.current = true
    Promise.all([corrigerPositions(reseau.magasins), corrigerDomicilesCoachs(reseau)])
      .then(([a, b]) => { if (a + b) recharger() }).catch(() => { /* nouvel essai à la prochaine session */ })
  }, [reseau, recharger, lectureSeule])

  // Accès des franchisés et périmètre des Coachs et RR : suivis après chaque chargement (associés, renommages, affectations)
  useEffect(() => {
    if (!reseau || !frais.current || !accesFranchises) return
    synchroniserAcces(reseau).catch(() => { /* nouvel essai au prochain chargement */ })
    synchroniserPerimetre(reseau).catch(() => { /* nouvel essai au prochain chargement */ })
  }, [reseau, accesFranchises])

  const vue = useMemo(() => (reseau && perimetre ? restreindre(reseau, perimetre) : reseau), [reseau, perimetre])

  return <Ctx.Provider value={{ reseau: vue, complet: reseau, chargement, erreur, recharger }}>{children}</Ctx.Provider>
}

// Magasins du périmètre et leurs visites. Les bonnes pratiques restent celles de tout le réseau ;
// les données rangées par magasin (notes, chiffres…) restent entières pour ne rien perdre à l'enregistrement.
function restreindre(reseau: Reseau, p: Perimetre): Reseau {
  const magasins = magasinsDu(reseau, p)
  const noms = new Set(magasins.map((m) => m.nom))
  return { ...reseau, magasins, visites: reseau.visites.filter((v) => noms.has(v.magasin)) }
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReseau(): EtatReseau {
  const c = useContext(Ctx)
  if (!c) throw new Error('useReseau hors ReseauProvider')
  return c
}
