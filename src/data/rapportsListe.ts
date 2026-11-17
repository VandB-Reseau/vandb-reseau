// Liste de rapports de chacun dans l'onglet Pilotage (Joseph, 17/11/2026) : favoris en tête, rapports masqués pour ne
// garder que ceux qui servent. Clé d'un rapport : « p-<id> » pour un rapport proposé, son numéro pour un rapport enregistré.
// Gardé sur l'appareil et recopié dans les préférences du compte (preferences.ts, équipe), comme les épingles.
import { useSyncExternalStore } from 'react'
import { brancher, preferenceChangee } from '../lib/preferences'

export interface ListeRapports { favoris: string[]; masques: string[] }
const CLE = 'vandb-pilotage-liste'
const VIDE: ListeRapports = { favoris: [], masques: [] }
const abonnes = new Set<() => void>()
let actuel: ListeRapports | null = null

const cles = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && /^(p-[\w-]+|\d+)$/.test(x)))].slice(0, 300) : [])
const propre = (v: unknown): ListeRapports => {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
  return { favoris: cles(o.favoris), masques: cles(o.masques) }
}
function lire(): ListeRapports {
  if (actuel) return actuel
  try { actuel = propre(JSON.parse(localStorage.getItem(CLE) ?? 'null')) } catch { actuel = VIDE }
  return actuel
}
function ecrireIci(l: ListeRapports) {
  actuel = l
  try { localStorage.setItem(CLE, JSON.stringify(l)) } catch { /* stockage indisponible : gardé pour la session */ }
  abonnes.forEach((f) => f())
}
brancher('rapports', { lire, appliquer: (v) => ecrireIci(propre(v)), vide: () => !lire().favoris.length && !lire().masques.length })

function abonner(f: () => void) {
  abonnes.add(f)
  const autreOnglet = (e: StorageEvent) => { if (e.key === CLE) { actuel = null; f() } }
  window.addEventListener('storage', autreOnglet)
  return () => { abonnes.delete(f); window.removeEventListener('storage', autreOnglet) }
}
export const useListeRapports = () => useSyncExternalStore(abonner, lire, () => VIDE)

function changer(l: ListeRapports) { ecrireIci(l); preferenceChangee() }
// Un favori n'est jamais masqué, un rapport masqué n'est plus favori
export function basculerFavori(cle: string) {
  const l = lire()
  changer(l.favoris.includes(cle) ? { ...l, favoris: l.favoris.filter((x) => x !== cle) } : { favoris: [...l.favoris, cle], masques: l.masques.filter((x) => x !== cle) })
}
export function basculerMasque(cle: string) {
  const l = lire()
  changer(l.masques.includes(cle) ? { ...l, masques: l.masques.filter((x) => x !== cle) } : { masques: [...l.masques, cle], favoris: l.favoris.filter((x) => x !== cle) })
}
