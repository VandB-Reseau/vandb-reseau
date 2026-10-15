import { distanceKm } from './charge'
import { trajetRoutier } from './routes'
import type { Point } from './zones'

// Tournée estimée d'un Coach : départ de son domicile, passage par chacun de ses magasins, retour chez lui.
// Trajets routiers réels quand ils sont connus (voir routes.ts), sinon estimés à partir de la distance à vol d'oiseau.
export const FACTEUR_ROUTE = 1.3 // une route fait en moyenne 30 % de plus que la ligne droite
export const VITESSE_KMH = 70 // vitesse moyenne retenue, villes et routes confondues

export interface Tournee { km: number; minutes: number; etapes: number; complete: boolean }

const estime = (a: Point, b: Point) => { const km = (distanceKm(a, b) ?? 0) * FACTEUR_ROUTE; return { km, minutes: (km / VITESSE_KMH) * 60 } }
const trajet = (a: Point, b: Point) => trajetRoutier(a, b) ?? estime(a, b)
// L'ordre de passage cherche le moins de temps de route
const d = (a: Point, b: Point) => trajet(a, b).minutes

// Ordre de passage : le plus proche à chaque étape, puis amélioration en décroisant les trajets (2-opt).
// Travaille sur des indices : 0 = départ, 1..n = étapes ; dist(i, j) donne les minutes entre deux points.
export function ordre(n: number, dist: (i: number, j: number) => number): number[] {
  const restants = Array.from({ length: n }, (_v, i) => i + 1)
  const chemin = [0]
  while (restants.length) {
    const ici = chemin[chemin.length - 1]
    let k = 0
    restants.forEach((p, i) => { if (dist(ici, p) < dist(ici, restants[k])) k = i })
    chemin.push(restants.splice(k, 1)[0])
  }
  chemin.push(0)
  for (let amelioree = true, tour = 0; amelioree && tour < 20; tour++) {
    amelioree = false
    for (let i = 1; i < chemin.length - 2; i++)
      for (let j = i + 1; j < chemin.length - 1; j++)
        if (dist(chemin[i - 1], chemin[j]) + dist(chemin[i], chemin[j + 1]) < dist(chemin[i - 1], chemin[i]) + dist(chemin[j], chemin[j + 1]) - 0.01) {
          chemin.splice(i, j - i + 1, ...chemin.slice(i, j + 1).reverse())
          amelioree = true
        }
  }
  return chemin
}

// Matrice des durées entre des points, calculée une seule fois
export function matriceMinutes(points: Point[]): (i: number, j: number) => number {
  const n = points.length
  const m = new Float64Array(n * n).fill(-1)
  return (i, j) => {
    const k = i * n + j
    if (m[k] < 0) m[k] = d(points[i], points[j])
    return m[k]
  }
}

export function tournee(domicile: Point | null, magasins: { lat: number | null; lon: number | null }[]): Tournee {
  const places = magasins.filter((m): m is Point => m.lat !== null && m.lon !== null)
  const complete = !!domicile && places.length === magasins.length
  if (!places.length) return { km: 0, minutes: 0, etapes: 0, complete }
  const points = [domicile ?? places[0], ...places]
  const chemin = ordre(places.length, matriceMinutes(points))
  let km = 0, minutes = 0
  for (let i = 1; i < chemin.length; i++) { const t = trajet(points[chemin[i - 1]], points[chemin[i]]); km += t.km; minutes += t.minutes }
  return { km, minutes, etapes: places.length, complete }
}

export function duree(minutes: number): string {
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60)
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}
