import { useCallback, useEffect, useState } from 'react'
import type { Magasin } from './modele'

// Concurrents autour du magasin (sprint 27, F3, migration 0038). Les cavistes et caves à moins de 2 km sont lus sur
// OpenStreetMap (service Overpass, gratuit, sans clé) et gardés 30 jours dans le navigateur ; l'équipe complète la liste
// à la main, retire un commerce qui n'est pas un concurrent et note une remarque (rubrique « concurrence »).
const SERVICE = 'https://overpass-api.de/api/interpreter'
const STOCKAGE = 'vandb-concurrents'
const RAYON = 2000
const GARDE_JOURS = 30

export interface ConcurrentAjoute { id: string; nom: string; detail: string; note: string; par: string; le: string }
export interface SuiviConcurrence { ajoutes: ConcurrentAjoute[]; masques: string[]; notes: Record<string, string> }
export interface CommerceProche { id: string; nom: string; genre: string; adresse: string; distance: number } // distance en mètres

export const suiviVide = (): SuiviConcurrence => ({ ajoutes: [], masques: [], notes: {} })
export const suiviEstVide = (s: SuiviConcurrence) => !s.ajoutes.length && !s.masques.length && !Object.values(s.notes).some(Boolean)

const texte = (v: unknown) => (typeof v === 'string' ? v : '')
export function normaliserConcurrence(v: unknown): Record<string, SuiviConcurrence> {
  const r: Record<string, SuiviConcurrence> = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return r
  for (const [m, brut] of Object.entries(v as Record<string, unknown>)) {
    const o = (brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {}) as Record<string, unknown>
    const ajoutes = (Array.isArray(o.ajoutes) ? o.ajoutes : []).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map((x) => ({ id: texte(x.id), nom: texte(x.nom), detail: texte(x.detail), note: texte(x.note), par: texte(x.par), le: texte(x.le) }))
      .filter((x) => x.id && x.nom)
    const masques = (Array.isArray(o.masques) ? o.masques : []).filter((x): x is string => typeof x === 'string')
    const notes = Object.fromEntries(Object.entries(o.notes && typeof o.notes === 'object' ? o.notes as Record<string, unknown> : {}).filter(([, n]) => typeof n === 'string' && n.trim()).map(([k, n]) => [k, n as string]))
    const s = { ajoutes, masques, notes }
    if (!suiviEstVide(s)) r[m] = s
  }
  return r
}

const genres: Record<string, string> = { wine: 'Caviste', alcohol: 'Cave', beverages: 'Boissons' }
// Les magasins V and B eux-mêmes ne sont pas des concurrents
const estVandB = (nom: string) => /\bv\s*(and|&|et)\s*b\b/i.test(nom)

function distance(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = (x: number) => (x * Math.PI) / 180
  const dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

type Element = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }
export function lireReponse(j: { elements?: Element[] }, depuis: { lat: number; lon: number }): CommerceProche[] {
  const vus = new Set<string>()
  return (j.elements ?? []).flatMap((e) => {
    const t = e.tags ?? {}
    const p = e.center ?? (e.lat !== undefined && e.lon !== undefined ? { lat: e.lat, lon: e.lon } : null)
    const nom = t.name || t.brand || ''
    if (!p || !nom || estVandB(nom) || estVandB(t.brand ?? '')) return []
    const id = `${e.type}/${e.id}`
    if (vus.has(id)) return []
    vus.add(id)
    const adresse = [[t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '), t['addr:city']].filter(Boolean).join(', ')
    return [{ id, nom, genre: genres[t.shop ?? ''] ?? 'Cave', adresse, distance: Math.round(distance(depuis, p)) }]
  }).filter((c) => c.distance <= RAYON).sort((a, b) => a.distance - b.distance)
}

function lireCache(cle: string): CommerceProche[] | null {
  try {
    const tout = JSON.parse(localStorage.getItem(STOCKAGE) ?? '{}') as Record<string, { le: number; liste: CommerceProche[] }>
    const x = tout[cle]
    return x && Date.now() - x.le < GARDE_JOURS * 86400000 && Array.isArray(x.liste) ? x.liste : null
  } catch { return null }
}
function ecrireCache(cle: string, liste: CommerceProche[]) {
  try {
    const tout = JSON.parse(localStorage.getItem(STOCKAGE) ?? '{}') as Record<string, unknown>
    tout[cle] = { le: Date.now(), liste }
    localStorage.setItem(STOCKAGE, JSON.stringify(tout))
  } catch { /* stockage indisponible : relu la prochaine fois */ }
}

export async function chargerCommercesProches(lat: number, lon: number): Promise<CommerceProche[]> {
  const cle = `${lat.toFixed(4)},${lon.toFixed(4)}`
  const garde = lireCache(cle)
  if (garde) return garde
  const requete = `[out:json][timeout:20];nwr(around:${RAYON},${lat},${lon})[shop~"^(wine|alcohol|beverages)$"];out center tags 80;`
  const ctrl = new AbortController()
  const minuterie = setTimeout(() => ctrl.abort(), 20000)
  try {
    const r = await fetch(`${SERVICE}?data=${encodeURIComponent(requete)}`, { signal: ctrl.signal })
    if (!r.ok) throw new Error(String(r.status))
    const liste = lireReponse(await r.json(), { lat, lon })
    ecrireCache(cle, liste)
    return liste
  } finally { clearTimeout(minuterie) }
}

export type EtatCommerces = { etat: 'chargement' } | { etat: 'erreur' } | { etat: 'sansPosition' } | { etat: 'pret'; liste: CommerceProche[] }
export function useCommercesProches(m: Magasin): { commerces: EtatCommerces; relancer: () => void } {
  const [essai, setEssai] = useState(0)
  const [commerces, setCommerces] = useState<EtatCommerces>({ etat: 'chargement' })
  const { lat, lon } = m
  useEffect(() => {
    if (lat === null || lon === null) { setCommerces({ etat: 'sansPosition' }); return }
    let actif = true
    setCommerces({ etat: 'chargement' })
    chargerCommercesProches(lat, lon).then((liste) => { if (actif) setCommerces({ etat: 'pret', liste }) }, () => { if (actif) setCommerces({ etat: 'erreur' }) })
    return () => { actif = false }
  }, [lat, lon, essai])
  const relancer = useCallback(() => setEssai((n) => n + 1), [])
  return { commerces, relancer }
}

// Liste affichée : commerces lus (hors retirés) puis ajoutés à la main, avec la note de chacun
export interface LigneConcurrent { id: string; nom: string; detail: string; distance: number | null; note: string; ajoute: boolean; par: string }
export function lignesConcurrents(liste: CommerceProche[], suivi: SuiviConcurrence): LigneConcurrent[] {
  const masques = new Set(suivi.masques)
  return [
    ...liste.filter((c) => !masques.has(c.id)).map((c) => ({ id: c.id, nom: c.nom, detail: [c.genre, c.adresse].filter(Boolean).join(' · '), distance: c.distance, note: suivi.notes[c.id] ?? '', ajoute: false, par: '' })),
    ...suivi.ajoutes.map((a) => ({ id: a.id, nom: a.nom, detail: a.detail, distance: null, note: a.note, ajoute: true, par: a.par })),
  ]
}
export const libelleDistance = (d: number) => (d < 1000 ? `${Math.max(10, Math.round(d / 10) * 10)} m` : `${(d / 1000).toFixed(1).replace('.', ',')} km`)
