// Horaires et note Google lus en direct (API Google Places).
// Les conditions Google interdisent de conserver ces données : seul l'identifiant du lieu est gardé.
import type { Magasin } from '../data/modele'

const cle = import.meta.env.VITE_GOOGLE_PLACES_KEY ?? ''
export const googleActif = cle !== ''

export interface InfosGoogle {
  note: number | null
  avis: number
  horaires: string[] // du lundi au dimanche, en français
  ouvert: boolean | null
  fermeture: 'temporaire' | 'definitive' | null
  lien: string
}

interface LieuGoogle {
  id: string
  displayName?: { text: string }
  rating?: number
  userRatingCount?: number
  regularOpeningHours?: { weekdayDescriptions?: string[] }
  currentOpeningHours?: { openNow?: boolean }
  businessStatus?: string
  googleMapsUri?: string
}

const champs = ['id', 'displayName', 'rating', 'userRatingCount', 'regularOpeningHours.weekdayDescriptions', 'currentOpeningHours.openNow', 'businessStatus', 'googleMapsUri']
const CLE_LIEUX = 'vandb_google_lieux'
const enMemoire = new Map<string, Promise<InfosGoogle | null>>()

function lieuxConnus(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CLE_LIEUX) ?? '{}') as Record<string, string> } catch { return {} }
}
function retenirLieu(magasin: string, id: string) {
  try { localStorage.setItem(CLE_LIEUX, JSON.stringify({ ...lieuxConnus(), [magasin]: id })) } catch { /* stockage indisponible */ }
}

function versInfos(l: LieuGoogle): InfosGoogle {
  return {
    note: l.rating ?? null,
    avis: l.userRatingCount ?? 0,
    horaires: l.regularOpeningHours?.weekdayDescriptions ?? [],
    ouvert: l.currentOpeningHours?.openNow ?? null,
    fermeture: l.businessStatus === 'CLOSED_TEMPORARILY' ? 'temporaire' : l.businessStatus === 'CLOSED_PERMANENTLY' ? 'definitive' : null,
    lien: l.googleMapsUri ?? '',
  }
}

const estVandB = (nom = '') => /v\s*(and|&|et|'n'?)\s*b/i.test(nom)

async function appeler<T>(url: string, masque: string, corps?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: corps ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': cle, 'X-Goog-FieldMask': masque },
    body: corps ? JSON.stringify(corps) : undefined,
  })
  if (!r.ok) throw new Error(`Google ${r.status}`)
  return (await r.json()) as T
}

async function chercher(m: Magasin): Promise<InfosGoogle | null> {
  const id = lieuxConnus()[m.nom]
  if (id) return versInfos(await appeler<LieuGoogle>(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=fr`, champs.join(',')))
  const adresse = [m.adresse, m.codePostal, m.ville].filter(Boolean).join(' ')
  const { places = [] } = await appeler<{ places?: LieuGoogle[] }>('https://places.googleapis.com/v1/places:searchText', champs.map((c) => `places.${c}`).join(','), {
    textQuery: `V and B ${m.nom} ${adresse}`.trim(),
    languageCode: 'fr',
    maxResultCount: 5,
    ...(m.lat !== null && m.lon !== null ? { locationBias: { circle: { center: { latitude: m.lat, longitude: m.lon }, radius: 5000 } } } : {}),
  })
  const lieu = places.find((p) => estVandB(p.displayName?.text))
  if (!lieu) return null
  retenirLieu(m.nom, lieu.id)
  return versInfos(lieu)
}

// Un seul appel par magasin et par ouverture de l'app
export function infosGoogle(m: Magasin): Promise<InfosGoogle | null> {
  const cleMemoire = `${m.nom}|${m.adresse}|${m.ville}`
  let p = enMemoire.get(cleMemoire)
  if (!p) {
    p = chercher(m)
    p.catch(() => enMemoire.delete(cleMemoire))
    enMemoire.set(cleMemoire, p)
  }
  return p
}
