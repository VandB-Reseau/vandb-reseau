import { useEffect, useState } from 'react'
import type { Point } from './zones'
import type { Reseau } from './modele'

// Trajets routiers réels (distance et durée en voiture) entre domiciles des Coachs et magasins,
// fournis gratuitement par le service d'itinéraire OSRM (données OpenStreetMap), gardés dans le navigateur.
const SERVICE = 'https://router.project-osrm.org/table/v1/driving/'
const STOCKAGE = 'vandb-trajets-routiers'
const PAR_APPEL = 50 // points par côté de la matrice, pour rester sous la limite du service

export interface Trajet { km: number; minutes: number }

const cle = (p: Point) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`
const cache = new Map<string, Trajet>(lire())

function lire(): [string, Trajet][] {
  try { return Object.entries(JSON.parse(localStorage.getItem(STOCKAGE) ?? '{}')) } catch { return [] }
}
function ecrire() {
  try { localStorage.setItem(STOCKAGE, JSON.stringify(Object.fromEntries(cache))) } catch { /* stockage indisponible */ }
}

export function trajetRoutier(a: Point, b: Point): Trajet | null {
  if (cle(a) === cle(b)) return { km: 0, minutes: 0 }
  return cache.get(`${cle(a)}|${cle(b)}`) ?? null
}

async function matrice(sources: Point[], destinations: Point[]): Promise<void> {
  const points = [...sources, ...destinations]
  const coords = points.map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';')
  const src = sources.map((_p, i) => i).join(';')
  const dst = destinations.map((_p, i) => i + sources.length).join(';')
  const ctrl = new AbortController()
  const minuterie = setTimeout(() => ctrl.abort(), 15000)
  try {
    const r = await fetch(`${SERVICE}${coords}?sources=${src}&destinations=${dst}&annotations=duration,distance`, { signal: ctrl.signal })
    const j = await r.json()
    if (j.code !== 'Ok') throw new Error(j.code)
    sources.forEach((a, i) => destinations.forEach((b, k) => {
      const s = j.durations[i][k], m = j.distances[i][k]
      if (s !== null && m !== null) cache.set(`${cle(a)}|${cle(b)}`, { km: m / 1000, minutes: s / 60 })
    }))
  } finally { clearTimeout(minuterie) }
}

// Récupère les trajets manquants entre tous les points ; renvoie vrai si tout est connu
export async function chargerTrajets(points: Point[]): Promise<boolean> {
  const uniques = [...new Map(points.map((p) => [cle(p), p])).values()]
  const paquets: Point[][] = []
  for (let i = 0; i < uniques.length; i += PAR_APPEL) paquets.push(uniques.slice(i, i + PAR_APPEL))
  let complet = true
  for (const a of paquets) for (const b of paquets) {
    if (a.every((p) => b.every((q) => trajetRoutier(p, q)))) continue
    try { await matrice(a, b) } catch { complet = false }
  }
  ecrire()
  return complet
}

export function pointsDuReseau(reseau: Reseau): Point[] {
  return [...reseau.equipe, ...reseau.magasins]
    .filter((x) => x.lat !== null && x.lon !== null)
    .map((x) => ({ lat: x.lat as number, lon: x.lon as number }))
}

// Charge les trajets routiers du réseau ; « version » change quand de nouveaux trajets arrivent
export function useTrajetsRoutiers(reseau: Reseau): { version: number; etat: 'chargement' | 'routier' | 'estime' } {
  const [etat, setEtat] = useState<{ version: number; etat: 'chargement' | 'routier' | 'estime' }>({ version: 0, etat: 'chargement' })
  useEffect(() => {
    let actif = true
    chargerTrajets(pointsDuReseau(reseau)).then((ok) => { if (actif) setEtat((e) => ({ version: e.version + 1, etat: ok ? 'routier' : 'estime' })) })
    return () => { actif = false }
  }, [reseau])
  return etat
}
