import { useSyncExternalStore } from 'react'

// Vues enregistrées de Magasins (L5, 21/10/2026) : filtres et tri sous un nom, gardés sur l'appareil
const CLE = 'vandb-vues-magasins'
// Paramètres d'adresse qui font une vue (l'affichage liste ou carte n'en fait pas partie)
export const PARAMETRES_VUE = ['q', 'statut', 'type', 'coach', 'rr', 'alerte', 'levier', 'tri']

export interface VueEnregistree { nom: string; adresse: string }
const VIDE: VueEnregistree[] = []

let actuel: VueEnregistree[] | null = null
const abonnes = new Set<() => void>()

function lire(): VueEnregistree[] {
  if (actuel) return actuel
  try {
    const v = JSON.parse(localStorage.getItem(CLE) ?? 'null') as unknown
    actuel = Array.isArray(v) ? v.filter((x): x is VueEnregistree => typeof x?.nom === 'string' && typeof x?.adresse === 'string') : []
  } catch { actuel = VIDE }
  return actuel
}

function ecrire(v: VueEnregistree[]) {
  actuel = v
  try { localStorage.setItem(CLE, JSON.stringify(v)) } catch { /* stockage indisponible : gardé pour la session */ }
  abonnes.forEach((f) => f())
}

function abonner(f: () => void) {
  abonnes.add(f)
  const autreOnglet = (e: StorageEvent) => { if (e.key === CLE) { actuel = null; f() } }
  window.addEventListener('storage', autreOnglet)
  return () => { abonnes.delete(f); window.removeEventListener('storage', autreOnglet) }
}

export function useVues(): VueEnregistree[] {
  return useSyncExternalStore(abonner, lire, () => VIDE)
}

// Les seuls paramètres de vue, dans un ordre fixe : deux adresses aux mêmes filtres se comparent
export function adresseDeVue(p: URLSearchParams): string {
  const v = new URLSearchParams()
  for (const k of PARAMETRES_VUE) { const x = p.get(k); if (x) v.set(k, x) }
  return v.toString()
}

export function enregistrerVue(nom: string, adresse: string) {
  ecrire([...lire().filter((v) => v.nom !== nom && v.adresse !== adresse), { nom, adresse }])
}

export function retirerVue(adresse: string) {
  ecrire(lire().filter((v) => v.adresse !== adresse))
}
