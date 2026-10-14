import { distanceKm } from './charge'
import type { Point } from './zones'

// Tournée estimée d'un Coach : départ de son domicile, passage par chacun de ses magasins, retour chez lui.
// Sans service d'itinéraire, la distance routière est estimée à partir de la distance à vol d'oiseau.
export const FACTEUR_ROUTE = 1.3 // une route fait en moyenne 30 % de plus que la ligne droite
export const VITESSE_KMH = 70 // vitesse moyenne retenue, villes et routes confondues

export interface Tournee { km: number; minutes: number; etapes: number; complete: boolean }

const d = (a: Point, b: Point) => distanceKm(a, b) ?? 0

// Ordre de passage : le plus proche à chaque étape, puis amélioration en décroisant les trajets (2-opt)
function ordre(depart: Point, points: Point[]): Point[] {
  const restants = [...points]
  const chemin: Point[] = [depart]
  while (restants.length) {
    const ici = chemin[chemin.length - 1]
    let k = 0
    restants.forEach((p, i) => { if (d(ici, p) < d(ici, restants[k])) k = i })
    chemin.push(restants.splice(k, 1)[0])
  }
  chemin.push(depart)
  for (let amelioree = true, tour = 0; amelioree && tour < 20; tour++) {
    amelioree = false
    for (let i = 1; i < chemin.length - 2; i++)
      for (let j = i + 1; j < chemin.length - 1; j++)
        if (d(chemin[i - 1], chemin[j]) + d(chemin[i], chemin[j + 1]) < d(chemin[i - 1], chemin[i]) + d(chemin[j], chemin[j + 1]) - 0.01) {
          chemin.splice(i, j - i + 1, ...chemin.slice(i, j + 1).reverse())
          amelioree = true
        }
  }
  return chemin
}

export function tournee(domicile: Point | null, magasins: { lat: number | null; lon: number | null }[]): Tournee {
  const places = magasins.filter((m): m is Point => m.lat !== null && m.lon !== null)
  const complete = !!domicile && places.length === magasins.length
  if (!places.length) return { km: 0, minutes: 0, etapes: 0, complete }
  const depart = domicile ?? places[0]
  const chemin = ordre(depart, places)
  let km = 0
  for (let i = 1; i < chemin.length; i++) km += d(chemin[i - 1], chemin[i])
  km *= FACTEUR_ROUTE
  return { km, minutes: (km / VITESSE_KMH) * 60, etapes: places.length, complete }
}

export function duree(minutes: number): string {
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60)
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}
