import { distanceKm } from './charge'

// Couleurs attribuées aux Coachs sans couleur enregistrée : même calcul que l'ancienne app,
// un Coach garde donc la même couleur dans les deux applications
const COULEURS_AUTO = ['#0891b2', '#7c3aed', '#b45309', '#15803d', '#be123c', '#1d4ed8', '#c2410c', '#0e7490', '#6d28d9', '#047857']

export function couleurAuto(nom: string): string {
  if (!nom) return '#6b6b73'
  let h = 0
  for (let i = 0; i < nom.length; i++) h = nom.charCodeAt(i) + ((h << 5) - h)
  return COULEURS_AUTO[Math.abs(h) % COULEURS_AUTO.length]
}

export interface Point { lat: number; lon: number }

// Un groupe trop étendu (outre-mer, étranger) donne une zone par grappe : deux magasins à plus
// de ECART_MAX_KM de tout autre magasin du groupe forment une zone séparée, de la même couleur
const ECART_MAX_KM = 350

export function grappes<T extends Point>(points: T[]): T[][] {
  const parent = points.map((_p, i) => i)
  const racine = (i: number): number => (parent[i] === i ? i : (parent[i] = racine(parent[i])))
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++)
      if ((distanceKm(points[i], points[j]) ?? Infinity) <= ECART_MAX_KM) parent[racine(i)] = racine(j)
  const groupes = new Map<number, T[]>()
  points.forEach((p, i) => groupes.set(racine(i), [...(groupes.get(racine(i)) ?? []), p]))
  return [...groupes.values()]
}

// Enveloppe convexe (chaîne monotone d'Andrew) sur des coordonnées planes [x, y]
function enveloppe(pts: [number, number][]): [number, number][] {
  if (pts.length < 3) return pts
  const tries = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const croix = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const bas: [number, number][] = [], haut: [number, number][] = []
  for (const p of tries) { while (bas.length >= 2 && croix(bas[bas.length - 2], bas[bas.length - 1], p) <= 0) bas.pop(); bas.push(p) }
  for (const p of [...tries].reverse()) { while (haut.length >= 2 && croix(haut[haut.length - 2], haut[haut.length - 1], p) <= 0) haut.pop(); haut.push(p) }
  return bas.slice(0, -1).concat(haut.slice(0, -1))
}

// Zone arrondie autour de magasins : enveloppe de petits cercles de rayon marge (km) autour de chacun.
// Renvoie un polygone [lat, lon] prêt pour Leaflet.
export function contourZone(points: Point[], margeKm: number): [number, number][] {
  if (!points.length) return []
  const lat0 = points.reduce((t, p) => t + p.lat, 0) / points.length
  const kmParDegLat = 111.32
  const kmParDegLon = 111.32 * Math.cos((lat0 * Math.PI) / 180)
  const cotes = 16
  const nuage: [number, number][] = []
  for (const p of points)
    for (let k = 0; k < cotes; k++) {
      const a = (2 * Math.PI * k) / cotes
      nuage.push([p.lon * kmParDegLon + margeKm * Math.cos(a), p.lat * kmParDegLat + margeKm * Math.sin(a)])
    }
  return enveloppe(nuage).map(([x, y]) => [y / kmParDegLat, x / kmParDegLon])
}

// Centre d'un ensemble de points (moyenne), utilisé comme position d'une zone
export function centre(points: { lat: number | null; lon: number | null }[]): Point | null {
  const ok = points.filter((p): p is Point => p.lat !== null && p.lon !== null)
  if (!ok.length) return null
  return { lat: ok.reduce((t, p) => t + p.lat, 0) / ok.length, lon: ok.reduce((t, p) => t + p.lon, 0) / ok.length }
}
