// Centre de la commune d'une personne (service public geo.api.gouv.fr, France seulement).
// Résultats gardés dans le navigateur : une commune n'est demandée qu'une fois.
import type { Point } from './zones'

const SERVICE = 'https://geo.api.gouv.fr/communes'
// v2 : les anciens résultats (commune la plus peuplée à défaut du bon nom) sont oubliés
const CACHE = 'vandb-centres-communes-v2'

type Commune = { nom: string; centre?: { coordinates: [number, number] }; population?: number }

export const normaliserVille = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\bst\b/g, 'saint').replace(/[^a-z0-9]+/g, ' ').trim()

function lireCache(): Record<string, [number, number] | null> {
  try { return JSON.parse(localStorage.getItem(CACHE) ?? '{}') } catch { return {} }
}
function ecrireCache(cle: string, v: [number, number] | null) {
  try { localStorage.setItem(CACHE, JSON.stringify({ ...lireCache(), [cle]: v })) } catch { /* stockage indisponible : on redemandera */ }
}

export const cleCommune = (codePostal: string, ville: string) => `${codePostal.replace(/\s/g, '')}|${normaliserVille(ville)}`

// null : commune introuvable ; undefined : service injoignable (on réessaiera plus tard)
// departement : restreint la recherche par nom quand le code postal manque
export async function centreCommune(codePostal: string, ville: string, signal?: AbortSignal, departement = ''): Promise<Point | null | undefined> {
  const cp = codePostal.replace(/\s/g, '')
  const nom = normaliserVille(ville.replace(/\s*\([^)]*\)\s*$/, '')) // « Redon (35) » = « Redon »
  const dep = /^\d{5}$/.test(cp) ? '' : departement.trim().toUpperCase().replace(/^(\d)$/, '0$1')
  if (!/^\d{5}$/.test(cp) && !nom) return null
  const cle = `${cleCommune(cp, ville)}|${dep}`
  const cache = lireCache()
  if (cle in cache) { const c = cache[cle]; return c ? { lat: c[0], lon: c[1] } : null }
  const params = new URLSearchParams({ fields: 'nom,centre,population', format: 'json' })
  if (/^\d{5}$/.test(cp)) params.set('codePostal', cp)
  else {
    params.set('nom', ville.replace(/\s*\([^)]*\)\s*$/, '').trim()); params.set('boost', 'population'); params.set('limit', '10')
    if (/^(\d{2,3}|2A|2B)$/.test(dep)) params.set('codeDepartement', dep)
  }
  let communes: Commune[]
  try {
    const r = await fetch(`${SERVICE}?${params}`, { signal })
    if (!r.ok) return undefined
    communes = await r.json()
  } catch { return undefined }
  const avecCentre = communes.filter((c) => c.centre?.coordinates)
  // Le nom exact d'abord ; à défaut, la plus peuplée seulement parmi les communes du code postal :
  // sur une recherche par nom, une ville plus grande au nom proche serait à l'autre bout de la France
  const choisie = avecCentre.find((c) => normaliserVille(c.nom) === nom)
    ?? (/^\d{5}$/.test(cp) ? [...avecCentre].sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0] : undefined)
  const res: [number, number] | null = choisie ? [choisie.centre!.coordinates[1], choisie.centre!.coordinates[0]] : null
  ecrireCache(cle, res)
  return res ? { lat: res[0], lon: res[1] } : null
}
