import { supabase } from '../lib/supabase'
import { estFrance } from './personnes'
import type { Point } from './zones'
import type { Reseau } from './modele'
import { centreCommune } from './geocodage'
import { distanceKm } from './charge'
import { cleFiche } from './personnes'

// Géolocalisation gratuite et sans clé : Base Adresse Nationale (Géoplateforme IGN) pour la France,
// OpenStreetMap (Nominatim) pour l'étranger ou en repli.
const BAN = 'https://data.geopf.fr/geocodage/search'
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const ECHECS = 'vandb-geolocalisation-echecs'

export interface Adresse { adresse: string; codePostal: string; ville: string; pays: string }

// « Northampton (Royaume-Uni) » ou « Redon (35) » : la parenthèse finale n'est pas dans le nom de la ville
const nettoyer = (ville: string) => ville.replace(/\s*\([^)]*\)\s*$/, '').trim()
// Les services d'adresse lisent mal la ligature « Œ » (« Rue des Œillets »)
const sansLigature = (s: string) => s.replace(/Œ/g, 'Oe').replace(/œ/g, 'oe')

// Magasins importés avec la seule adresse « Rue X, 85340 Les Sables D Olonne » : code postal et ville en sont tirés
export function communeDepuisAdresse(adresse: string): { codePostal: string; ville: string } {
  const r = adresse.match(/\b(\d{5})\s+([^,\d][^,]*)\s*$/) ?? adresse.match(/\b(\d{5})\s+([^,\d][^,]*)/)
  return r ? { codePostal: r[1], ville: r[2].trim() } : { codePostal: '', ville: '' }
}

async function lireJson(url: string): Promise<unknown> {
  const ctrl = new AbortController()
  const minuterie = setTimeout(() => ctrl.abort(), 6000)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } finally { clearTimeout(minuterie) }
}

interface ResultatBan { features?: { geometry: { coordinates: [number, number] }; properties: { score: number; postcode?: string; city?: string } }[] }

async function ban(q: string, cp: string, type?: 'municipality'): Promise<Point | null> {
  const p = new URLSearchParams({ q, limit: '1' })
  if (type) p.set('type', type)
  const f = ((await lireJson(`${BAN}?${p}`)) as ResultatBan).features?.[0]
  if (!f || f.properties.score < 0.4) return null
  // Garde-fou : le résultat doit être dans le département du code postal saisi
  const dept = (c: string) => (c.startsWith('97') ? c.slice(0, 3) : c.slice(0, 2))
  if (cp && f.properties.postcode && dept(f.properties.postcode) !== dept(cp)) return null
  const [lon, lat] = f.geometry.coordinates
  return { lat, lon }
}

// Nominatim demande au plus une requête par seconde
let dernierAppel = 0
async function nominatim(q: string, pays: string): Promise<Point | null> {
  const attente = dernierAppel + 1100 - Date.now()
  if (attente > 0) await new Promise((r) => setTimeout(r, attente))
  dernierAppel = Date.now()
  const p = new URLSearchParams({ q: pays && !q.includes(pays) ? `${q}, ${pays}` : q, format: 'json', limit: '1' })
  if (estFrance(pays)) p.set('countrycodes', 'fr')
  const r = (await lireJson(`${NOMINATIM}?${p}`)) as { lat: string; lon: string }[]
  return r?.[0] ? { lat: Number(r[0].lat), lon: Number(r[0].lon) } : null
}

// Position la plus précise possible : adresse complète, sinon commune (code postal + ville)
export async function geolocaliser(a: Adresse): Promise<Point | null> {
  const tiree = communeDepuisAdresse(a.adresse)
  const ville = sansLigature(nettoyer(a.ville) || tiree.ville), cp = a.codePostal.trim() || tiree.codePostal
  // L'adresse stockée contient souvent déjà le code postal et la ville
  const rue = sansLigature(a.adresse.split(',')[0].trim())
  const commune = [cp, ville].filter(Boolean).join(' ')
  if (!commune && !rue) return null
  const essais: (() => Promise<Point | null>)[] = estFrance(a.pays)
    ? [
        ...(rue && commune ? [() => ban(`${rue} ${commune}`, cp)] : []),
        ...(commune ? [() => ban(commune, cp, 'municipality'), () => nominatim(commune, 'France')] : []),
      ]
    : [() => nominatim(commune || rue, a.pays), ...(cp && ville ? [() => nominatim(ville, a.pays)] : [])]
  for (const essai of essais) {
    try { const p = await essai(); if (p) return p } catch { /* service injoignable : essai suivant */ }
  }
  return null
}

function echecs(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(ECHECS) ?? '[]')) } catch { return new Set() }
}

// Enregistre la position dans store_overrides (prioritaire sur la liste de base)
export async function enregistrerPosition(nom: string, p: Point): Promise<boolean> {
  const ex = await supabase.from('store_overrides').select('store_name').eq('store_name', nom)
  if (ex.error) return false
  const ligne = { lat: p.lat, lon: p.lon, updated_at: new Date().toISOString() }
  const r = ex.data?.length
    ? await supabase.from('store_overrides').update(ligne).eq('store_name', nom)
    : await supabase.from('store_overrides').insert({ store_name: nom, ...ligne })
  return !r.error
}

// Position à plus de 20 km de la commune de son code postal : géolocalisation fausse de l'ancienne app
// (homonyme, ou adresse sans code postal posée sur le chef-lieu du département)
const ECART_MAX_KM = 20
async function horsDeSaCommune(m: Reseau['magasins'][number]): Promise<boolean> {
  if (m.lat === null || m.lon === null || !estFrance(m.pays)) return false
  const tiree = communeDepuisAdresse(m.adresse)
  const cp = m.codePostal.trim() || tiree.codePostal
  if (!/^\d{5}$/.test(cp)) return false
  const c = await centreCommune(cp, m.ville || tiree.ville)
  return !!c && (distanceKm({ lat: m.lat, lon: m.lon }, c) ?? 0) > ECART_MAX_KM
}

// Magasins posés au centre de leur département ou loin de leur commune : on cherche leur vraie position, une fois par session
export async function corrigerPositions(magasins: Reseau['magasins']): Promise<number> {
  const deja = echecs()
  const candidats = magasins.filter((m) => (m.ville || m.codePostal || m.adresse) && !deja.has(m.nom))
  let corriges = 0
  for (const m of candidats) {
    if (!m.positionApprochee && !(await horsDeSaCommune(m))) continue
    const p = await geolocaliser(m)
    // Nouvelle position retenue seulement si elle est bien différente de l'ancienne
    const differente = !p || m.lat === null || m.lon === null || (distanceKm({ lat: m.lat, lon: m.lon }, p) ?? 0) > 0.5
    if (p && differente && await enregistrerPosition(m.nom, p)) corriges++
    else deja.add(m.nom)
  }
  try { sessionStorage.setItem(ECHECS, JSON.stringify([...deja])) } catch { /* stockage indisponible */ }
  return corriges
}

// Domicile des Coachs : l'ancienne app le cherchait avec le seul nom de la ville (sans code postal),
// d'où des homonymes à l'autre bout de la France. On le recale sur la commune de la fiche (code postal, ville).
export async function corrigerDomicilesCoachs(reseau: Reseau): Promise<number> {
  let corriges = 0
  for (const c of reseau.equipe) {
    if (c.fictif) continue
    const f = reseau.personnes[cleFiche({ type: 'coach', cle: c.nom })] ?? {}
    const texte = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '').trim()
    const ville = texte(f.ville) || c.ville, cp = texte(f.codePostal)
    if ((!ville && !cp) || !estFrance(texte(f.pays))) continue
    const p = await centreCommune(cp, ville, undefined, texte(f.departement))
    // Domicile déjà dans sa commune (ou commune introuvable) : on n'y touche pas
    if (!p || (distanceKm(c, p) ?? Infinity) < 10) continue
    const ligne = { lat: p.lat, lon: p.lon, ville }
    const ex = await supabase.from('cs_overrides').select('cs_name').eq('cs_name', c.nom)
    if (ex.error) continue
    const r = ex.data?.length
      ? await supabase.from('cs_overrides').update(ligne).eq('cs_name', c.nom)
      : await supabase.from('cs_overrides').insert({ cs_name: c.nom, ...ligne })
    if (!r.error) corriges++
  }
  return corriges
}
