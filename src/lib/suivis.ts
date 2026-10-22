import { useSyncExternalStore } from 'react'
import { brancher, preferenceChangee } from './preferences'

// Magasins favoris et dernières fiches ouvertes, gardés sur l'appareil (L4, Joseph, 21/10/2026)
const CLE = 'vandb-magasins-suivis'
const NB_RECENTS = 5

export interface Suivis { favoris: string[]; recents: string[] }
const VIDE: Suivis = { favoris: [], recents: [] }

let actuel: Suivis | null = null
const abonnes = new Set<() => void>()

function lire(): Suivis {
  if (actuel) return actuel
  try {
    const v = JSON.parse(localStorage.getItem(CLE) ?? 'null') as Partial<Suivis> | null
    actuel = { favoris: Array.isArray(v?.favoris) ? v.favoris : [], recents: Array.isArray(v?.recents) ? v.recents : [] }
  } catch { actuel = VIDE }
  return actuel
}

function ecrireIci(s: Suivis) {
  actuel = s
  try { localStorage.setItem(CLE, JSON.stringify(s)) } catch { /* stockage indisponible : gardé pour la session */ }
  abonnes.forEach((f) => f())
}
function ecrire(s: Suivis) { ecrireIci(s); preferenceChangee() }
// Recopiés dans la base pour suivre le compte (preferences.ts)
const liste = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
brancher('suivis', { lire, appliquer: (v) => { const x = (v ?? {}) as Partial<Suivis>; ecrireIci({ favoris: liste(x.favoris), recents: liste(x.recents).slice(0, NB_RECENTS) }) },
  vide: () => !lire().favoris.length && !lire().recents.length })

function abonner(f: () => void) {
  abonnes.add(f)
  const autreOnglet = (e: StorageEvent) => { if (e.key === CLE) { actuel = null; f() } }
  window.addEventListener('storage', autreOnglet)
  return () => { abonnes.delete(f); window.removeEventListener('storage', autreOnglet) }
}

export function useSuivis(): Suivis {
  return useSyncExternalStore(abonner, lire, () => VIDE)
}

export function noterRecent(nom: string) {
  const s = lire()
  if (s.recents[0] === nom) return
  ecrire({ ...s, recents: [nom, ...s.recents.filter((n) => n !== nom)].slice(0, NB_RECENTS) })
}

export function basculerFavori(nom: string) {
  const s = lire()
  ecrire({ ...s, favoris: s.favoris.includes(nom) ? s.favoris.filter((n) => n !== nom) : [...s.favoris, nom] })
}

// Favoris par ordre alphabétique puis récents qui ne sont pas déjà favoris, limités aux magasins visibles
export function magasinsSuivis(s: Suivis, existants: Set<string>) {
  const favoris = s.favoris.filter((n) => existants.has(n)).sort((a, b) => a.localeCompare(b, 'fr'))
  const recents = s.recents.filter((n) => existants.has(n) && !favoris.includes(n))
  return { favoris, recents }
}
