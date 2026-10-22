// Conversations épinglées en tête de Messages (Joseph, 22/10/2026). Gardées sur l'appareil et, pour l'équipe,
// recopiées dans les préférences du compte (preferences.ts) pour suivre du PC au téléphone.
import { useSyncExternalStore } from 'react'
import { brancher, preferenceChangee } from '../lib/preferences'

const CLE = 'vandb-conversations-epinglees'
const VIDE: string[] = []
const abonnes = new Set<() => void>()
let actuel: string[] | null = null

const propre = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : [])
function lire(): string[] {
  if (actuel) return actuel
  try { actuel = propre(JSON.parse(localStorage.getItem(CLE) ?? 'null')) } catch { actuel = VIDE }
  return actuel
}
function ecrireIci(l: string[]) {
  actuel = l
  try { localStorage.setItem(CLE, JSON.stringify(l)) } catch { /* stockage indisponible : gardé pour la session */ }
  abonnes.forEach((f) => f())
}
brancher('epingles', { lire, appliquer: (v) => ecrireIci(propre(v)), vide: () => !lire().length })

function abonner(f: () => void) {
  abonnes.add(f)
  const autreOnglet = (e: StorageEvent) => { if (e.key === CLE) { actuel = null; f() } }
  window.addEventListener('storage', autreOnglet)
  return () => { abonnes.delete(f); window.removeEventListener('storage', autreOnglet) }
}

export const useEpingles = () => useSyncExternalStore(abonner, lire, () => VIDE)

export function basculerEpingle(cle: string) {
  const l = lire()
  ecrireIci(l.includes(cle) ? l.filter((x) => x !== cle) : [...l, cle])
  preferenceChangee()
}
