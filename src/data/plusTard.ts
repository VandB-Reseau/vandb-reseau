// « Plus tard » dans À traiter (refonte vague 5, 54A) : une ligne mise de côté revient au bout de 7 jours.
// Gardé sur l'appareil et recopié dans les préférences du compte (preferences.ts), comme les épingles.
import { useSyncExternalStore } from 'react'
import { brancher, preferenceChangee } from '../lib/preferences'

const CLE = 'vandb-a-traiter-plus-tard'
export const DELAI_PLUS_TARD = 7
const VIDE: Record<string, string> = {}
const abonnes = new Set<() => void>()
let actuel: Record<string, string> | null = null

const propre = (v: unknown): Record<string, string> => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e[1])))
  : {})
function lire(): Record<string, string> {
  if (actuel) return actuel
  try { actuel = propre(JSON.parse(localStorage.getItem(CLE) ?? 'null')) } catch { actuel = VIDE }
  return actuel
}
function ecrireIci(l: Record<string, string>) {
  actuel = l
  try { localStorage.setItem(CLE, JSON.stringify(l)) } catch { /* stockage indisponible : gardé pour la session */ }
  abonnes.forEach((f) => f())
}
brancher('plusTard', { lire, appliquer: (v) => ecrireIci(propre(v)), vide: () => !Object.keys(lire()).length })

function abonner(f: () => void) {
  abonnes.add(f)
  const autreOnglet = (e: StorageEvent) => { if (e.key === CLE) { actuel = null; f() } }
  window.addEventListener('storage', autreOnglet)
  return () => { abonnes.delete(f); window.removeEventListener('storage', autreOnglet) }
}

export const usePlusTard = () => useSyncExternalStore(abonner, lire, () => VIDE)
const decaler = (jour: string, n: number) => new Date(Date.parse(`${jour}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

// Met de côté jusqu'à jour + 7 ; les dates échues sont oubliées au passage
export function mettrePlusTard(cle: string, jour: string) {
  const garde = Object.fromEntries(Object.entries(lire()).filter(([, j]) => j > jour))
  ecrireIci({ ...garde, [cle]: decaler(jour, DELAI_PLUS_TARD) })
  preferenceChangee()
}
export function reprendre(cle: string) {
  const l = { ...lire() }
  delete l[cle]
  ecrireIci(l)
  preferenceChangee()
}
export const misDeCote = (l: Record<string, string>, cle: string, jour: string) => !!l[cle] && l[cle] > jour
