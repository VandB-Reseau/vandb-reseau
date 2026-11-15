import { useCallback, useEffect, useState } from 'react'
import type { Magasin } from './modele'

// Concurrents autour du magasin (sprint 27, F3, migration 0038). Les cavistes et caves à moins de 2 km sont lus sur
// OpenStreetMap (service Overpass, gratuit, sans clé) et gardés 30 jours dans le navigateur ; l'équipe complète la liste
// à la main, retire un commerce qui n'est pas un concurrent et note une remarque (rubrique « concurrence »).
// Le serveur principal d'Overpass est souvent saturé (refus 429 ou 504) : on essaie ses miroirs publics l'un après l'autre,
// et, si aucun ne répond, on garde la dernière liste lue même si elle a plus de 30 jours (10/11/2026).
// 15/11/2026 (« ça ne marche toujours pas ») : la liste n'était gardée que dans le navigateur de chacun, donc chaque
// personne, sur chaque appareil, dépendait d'Overpass. Elle est maintenant aussi enregistrée avec le suivi du magasin
// (rubrique « concurrence », champ « lus ») dès qu'un membre de l'équipe l'a lue : tout le monde la retrouve ensuite, même
// quand Overpass est en panne. Le serveur principal, saturé, passe après le miroir sans limite ; 20 s par service car
// une requête mise en file d'attente dépassait les 12 s ; une liste vide n'est gardée qu'un jour (réponse parfois fausse).
// Un magasin posé au centre de son département n'est plus cherché : la liste serait celle d'une autre ville.
export const SERVICES = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]
const ATTENTE_SERVICE = 20000
const STOCKAGE = 'vandb-concurrents'
const RAYON = 2000
const GARDE_JOURS = 30
const GARDE_VIDE_JOURS = 1
const JOUR = 86400000

export interface ConcurrentAjoute { id: string; nom: string; detail: string; note: string; par: string; le: string }
export interface CommerceProche { id: string; nom: string; genre: string; adresse: string; distance: number } // distance en mètres
// Dernière liste lue sur la carte, partagée par toute l'équipe : date (AAAA-MM-JJ) et position du magasin à ce moment
export interface ListeLue { le: string; lat: number; lon: number; liste: CommerceProche[] }
export interface SuiviConcurrence { ajoutes: ConcurrentAjoute[]; masques: string[]; notes: Record<string, string>; lus?: ListeLue }

export const suiviVide = (): SuiviConcurrence => ({ ajoutes: [], masques: [], notes: {} })
export const suiviEstVide = (s: SuiviConcurrence) => !s.ajoutes.length && !s.masques.length && !Object.values(s.notes).some(Boolean) && !s.lus

const texte = (v: unknown) => (typeof v === 'string' ? v : '')
const nombre = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
function normaliserLue(v: unknown): ListeLue | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const o = v as Record<string, unknown>
  const lat = nombre(o.lat), lon = nombre(o.lon), le = texte(o.le)
  if (lat === null || lon === null || !/^\d{4}-\d{2}-\d{2}$/.test(le) || !Array.isArray(o.liste)) return undefined
  const liste = o.liste.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({ id: texte(x.id), nom: texte(x.nom), genre: texte(x.genre), adresse: texte(x.adresse), distance: nombre(x.distance) ?? 0 }))
    .filter((x) => x.id && x.nom)
  return { le, lat, lon, liste }
}
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
    const lus = normaliserLue(o.lus)
    const s: SuiviConcurrence = { ajoutes, masques, notes, ...(lus ? { lus } : {}) }
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

const garde = (liste: CommerceProche[]) => (liste.length ? GARDE_JOURS : GARDE_VIDE_JOURS) * JOUR
function lireCache(cle: string, perime = false): CommerceProche[] | null {
  try {
    const tout = JSON.parse(localStorage.getItem(STOCKAGE) ?? '{}') as Record<string, { le: number; liste: CommerceProche[] }>
    const x = tout[cle]
    return x && Array.isArray(x.liste) && (perime || Date.now() - x.le < garde(x.liste)) ? x.liste : null
  } catch { return null }
}
// La liste partagée vaut pour cette position si le magasin n'a pas bougé de plus de 100 m depuis
const memePosition = (l: ListeLue, lat: number, lon: number) => distance(l, { lat, lon }) < 100
const lueRecente = (l: ListeLue) => Date.now() - new Date(`${l.le}T12:00:00`).getTime() < garde(l.liste)
function ecrireCache(cle: string, liste: CommerceProche[]) {
  try {
    const tout = JSON.parse(localStorage.getItem(STOCKAGE) ?? '{}') as Record<string, unknown>
    tout[cle] = { le: Date.now(), liste }
    localStorage.setItem(STOCKAGE, JSON.stringify(tout))
  } catch { /* stockage indisponible : relu la prochaine fois */ }
}

async function interroger(service: string, requete: string): Promise<{ elements?: Element[] }> {
  const ctrl = new AbortController()
  const minuterie = setTimeout(() => ctrl.abort(), ATTENTE_SERVICE)
  try {
    const r = await fetch(`${service}?data=${encodeURIComponent(requete)}`, { signal: ctrl.signal })
    if (!r.ok) throw new Error(String(r.status))
    const j = await r.json() as { elements?: Element[]; remark?: string }
    // Overpass répond parfois 200 avec une remarque « runtime error » et une liste vide : c'est un échec, pas « aucun commerce »
    if (!Array.isArray(j.elements) || (!j.elements.length && /error|timed out/i.test(j.remark ?? ''))) throw new Error('réponse illisible')
    return j
  } finally { clearTimeout(minuterie) }
}

// Une seule recherche à la fois par position, même si la fiche et la préparation de visite la demandent ensemble
// « nouvelle » : liste fraîchement lue sur la carte, à partager avec l'équipe
export interface Lecture { liste: CommerceProche[]; nouvelle: ListeLue | null }
const enCours = new Map<string, Promise<Lecture>>()
export function chargerCommercesProches(lat: number, lon: number, partagee?: ListeLue): Promise<Lecture> {
  const base = partagee && memePosition(partagee, lat, lon) ? partagee : undefined
  if (base && lueRecente(base)) return Promise.resolve({ liste: base.liste, nouvelle: null })
  const cle = `${lat.toFixed(4)},${lon.toFixed(4)}`
  const locale = lireCache(cle)
  if (locale) return Promise.resolve({ liste: locale, nouvelle: null })
  const deja = enCours.get(cle)
  if (deja) return deja
  const requete = `[out:json][timeout:18];nwr(around:${RAYON},${lat},${lon})[shop~"^(wine|alcohol|beverages)$"];out center tags 80;`
  const p = (async (): Promise<Lecture> => {
    for (const service of SERVICES) {
      try {
        const liste = lireReponse(await interroger(service, requete), { lat, lon })
        ecrireCache(cle, liste)
        return { liste, nouvelle: { le: new Date().toLocaleDateString('sv-SE'), lat, lon, liste } }
      } catch { /* serveur saturé ou injoignable : miroir suivant */ }
    }
    // Carte injoignable : la dernière liste connue, celle de l'équipe d'abord, même ancienne
    const ancienne = base?.liste ?? lireCache(cle, true)
    if (ancienne) return { liste: ancienne, nouvelle: null }
    throw new Error('carte des commerces injoignable')
  })().finally(() => enCours.delete(cle))
  enCours.set(cle, p)
  return p
}

export type EtatCommerces = { etat: 'chargement' } | { etat: 'erreur' } | { etat: 'sansPosition' } | { etat: 'positionApprochee' }
  | { etat: 'pret'; liste: CommerceProche[]; nouvelle: ListeLue | null }
export function useCommercesProches(m: Magasin, partagee?: ListeLue): { commerces: EtatCommerces; relancer: () => void } {
  const [essai, setEssai] = useState(0)
  const [commerces, setCommerces] = useState<EtatCommerces>({ etat: 'chargement' })
  const { lat, lon, positionApprochee } = m
  // La liste partagée ne relance la recherche que si sa date change (pas à chaque rechargement du réseau)
  const clePartagee = partagee ? `${partagee.le}|${partagee.lat}|${partagee.lon}` : ''
  useEffect(() => {
    if (lat === null || lon === null) { setCommerces({ etat: 'sansPosition' }); return }
    if (positionApprochee) { setCommerces({ etat: 'positionApprochee' }); return }
    let actif = true
    setCommerces({ etat: 'chargement' })
    chargerCommercesProches(lat, lon, partagee).then((l) => { if (actif) setCommerces({ etat: 'pret', ...l }) }, () => { if (actif) setCommerces({ etat: 'erreur' }) })
    return () => { actif = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, positionApprochee, essai, clePartagee])
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
