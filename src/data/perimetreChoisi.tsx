// Périmètre choisi une fois pour toute l'app (refonte vague 3, Joseph 09/11/2026, 21A) : le Directeur regarde tout le
// réseau, une région ou les magasins d'un Coach ; le Responsable Régional sa région ou un de ses Coachs. C'est un filtre
// de lecture des listes (accueil, magasins, visites, tâches, santé, campagnes, agenda, performance), jamais un droit :
// la base ne renvoie toujours au Coach et au RR que leurs magasins. Gardé sur l'appareil et dans les préférences du compte.
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useReseauSiDispo } from './ReseauContext'
import { brancher, preferenceChangee } from '../lib/preferences'
import { cleVue, lireVue, libelleVue, magasinsDu, type Perimetre } from './perimetre'
import type { Reseau } from './modele'
import type { Profil } from '../auth/roles'

const CLE = 'vandb-perimetre'
const abonnes = new Set<() => void>()
let actuel: string | null | undefined

function lire(): string {
  if (actuel === undefined) {
    try { actuel = localStorage.getItem(CLE) } catch { actuel = null }
  }
  return actuel ?? 'reseau'
}
function ecrireIci(v: string) {
  actuel = v
  try { localStorage.setItem(CLE, v) } catch { /* stockage indisponible : gardé pour la session */ }
  abonnes.forEach((f) => f())
}
brancher('perimetre', { lire, appliquer: (v) => ecrireIci(typeof v === 'string' ? v : 'reseau'), vide: () => lire() === 'reseau' })

function abonner(f: () => void) {
  abonnes.add(f)
  return () => { abonnes.delete(f) }
}
export const useCleChoisie = () => useSyncExternalStore(abonner, lire, () => 'reseau')
export function choisirPerimetre(cle: string) {
  ecrireIci(cle)
  preferenceChangee()
}

export interface OptionPerimetre { cle: string; libelle: string; detail: string; niveau: 0 | 1 }

// Choix possibles selon le compte : rien pour un Coach (un seul périmètre) ni pour un franchisé
export function optionsPerimetre(reseau: Reseau, profil: Profil | null): OptionPerimetre[] {
  if (!profil || !['directeur', 'rr'].includes(profil.role)) return []
  const n = (p: Perimetre) => magasinsDu(reseau, p).filter((m) => m.statut !== 'avenir').length
  const coachs = (rr: string | null) => reseau.equipe.filter((c) => rr === null || c.rr?.id === rr)
    .map((c) => ({ cle: cleVue({ type: 'coach', nom: c.nom }), libelle: `Magasins de ${c.nom}`, detail: String(n({ type: 'coach', nom: c.nom })), niveau: 1 as const }))
  if (profil.role === 'rr') {
    const id = profil.perimetre.rr?.[0] ?? null
    return [{ cle: 'reseau', libelle: 'Ma région', detail: String(reseau.magasins.filter((m) => m.statut !== 'avenir').length), niveau: 0 }, ...coachs(id)]
  }
  return [
    { cle: 'reseau', libelle: 'Tout le réseau', detail: String(reseau.magasins.filter((m) => m.statut !== 'avenir').length), niveau: 0 },
    ...reseau.rrs.flatMap((r) => [
      { cle: cleVue({ type: 'rr', id: r.id }), libelle: `Région ${r.nom}`, detail: String(n({ type: 'rr', id: r.id })), niveau: 0 as const },
      ...coachs(r.id),
    ]),
    ...reseau.equipe.filter((c) => !c.rr).map((c) => ({ cle: cleVue({ type: 'coach', nom: c.nom }), libelle: `Magasins de ${c.nom}`, detail: String(n({ type: 'coach', nom: c.nom })), niveau: 0 as const })),
  ]
}

// Périmètre retenu : null quand c'est tout ce que le compte voit, ou quand le choix enregistré n'existe plus
export function perimetreRetenu(reseau: Reseau, profil: Profil | null, cle: string): Perimetre | null {
  if (cle === 'reseau') return null
  if (!optionsPerimetre(reseau, profil).some((o) => o.cle === cle)) return null
  return lireVue(cle)
}
export function libellePerimetre(reseau: Reseau, p: Perimetre): string {
  return p.type === 'rr' ? `Région ${libelleVue(reseau, p)}` : p.type === 'coach' ? `Magasins de ${p.nom}` : 'Tout le réseau'
}

// Écrans de liste qui suivent le périmètre choisi ; une fiche (magasin, personne) s'ouvre toujours en entier
export function suitLePerimetre(pathname: string): boolean {
  return pathname === '/' || pathname === '/magasins' || pathname === '/budgets' || /^\/(visites|taches|plus\/sante|plus\/agenda|performance|campagnes)(\/|$)/.test(pathname)
}

// Rappel du périmètre à côté du titre de la page (PageHeader)
export const EtiquettePerimetreCtx = createContext<{ libelle: string; nombre: number; revenir: () => void } | null>(null)
export const useEtiquettePerimetre = () => useContext(EtiquettePerimetreCtx)

// Écrans du pilotage (Budgets, Performance › Face au budget et Clôtures), qui chargent leurs propres données :
// les noms des magasins du périmètre choisi, ou null pour tout ce que le compte voit
export function useNomsPerimetre(): Set<string> | null {
  const { profil } = useAuth()
  const reseau = useReseauSiDispo()?.complet ?? null
  const cle = useCleChoisie()
  return useMemo(() => {
    const p = reseau ? perimetreRetenu(reseau, profil, cle) : null
    return reseau && p ? new Set(magasinsDu(reseau, p).map((m) => m.nom)) : null
  }, [reseau, profil, cle])
}
