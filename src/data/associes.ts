// Associés d'un magasin. Franchisé : un ou plusieurs franchisés associés, chacun avec ses mandats successifs
// (date de début, date de fin), gardés pour décider des reconduites. Intégré : V and B associé à des particuliers.
// Stockés dans app_config (clé associes), par magasin. Le premier associé en place reste inscrit dans
// le champ resp du magasin (colonne lue partout comme « le franchisé »).
import type { Magasin, Reseau } from './modele'

export interface Mandat { debut: string; fin: string } // AAAA-MM-JJ, fin vide = non connue
export interface Associe { id: string; nom: string; entree: string; sortie: string; mandats: Mandat[] }
export type Associes = Record<string, Associe[]>

const iso = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '')

export function normaliserAssocies(brut: unknown): Associes {
  const res: Associes = {}
  if (!brut || typeof brut !== 'object') return res
  for (const [magasin, liste] of Object.entries(brut as Record<string, unknown>)) {
    if (!Array.isArray(liste)) continue
    const l = liste.filter((a) => a && typeof a === 'object' && typeof a.nom === 'string' && a.nom.trim()).map((a, i): Associe => ({
      id: typeof a.id === 'string' && a.id ? a.id : `as_${i}`, nom: a.nom.trim(), entree: iso(a.entree), sortie: iso(a.sortie),
      mandats: (Array.isArray(a.mandats) ? a.mandats : []).map((m: Partial<Mandat>) => ({ debut: iso(m?.debut), fin: iso(m?.fin) }))
        .filter((m: Mandat) => m.debut || m.fin).sort((x: Mandat, y: Mandat) => (x.debut || x.fin).localeCompare(y.debut || y.fin)),
    }))
    if (l.length) res[magasin] = l
  }
  return res
}

export const libelleAssocies = (m: { franchise: boolean }) => (m.franchise ? 'Franchisés associés' : 'Associés')

// Associés enregistrés ; pour un franchisé, celui inscrit sur le magasin y figure toujours
export function associesDu(reseau: Reseau, m: Magasin): Associe[] {
  const l = reseau.associes[m.nom] ?? []
  if (!m.franchise || !m.responsable || l.some((a) => a.nom === m.responsable!.nom)) return l
  return [{ id: 'resp', nom: m.responsable.nom, entree: '', sortie: '', mandats: [] }, ...l]
}

export const enPlace = (a: Associe, jour: string) => !a.sortie || a.sortie > jour
export const associesEnPlace = (reseau: Reseau, m: Magasin) => associesDu(reseau, m).filter((a) => enPlace(a, reseau.jour))

// Mandat en vigueur : le plus récent déjà commencé, sinon le prochain
export function mandatActuel(a: Associe, jour: string): Mandat | null {
  const commences = a.mandats.filter((m) => !m.debut || m.debut <= jour)
  return commences.at(-1) ?? a.mandats[0] ?? null
}

export type EtatMandat = 'enCours' | 'aRenouveler' | 'echu'
export const libellesEtatMandat: Record<EtatMandat, string> = { enCours: 'En cours', aRenouveler: 'Fin dans moins d’un an', echu: 'Mandat échu' }
export const MOIS_ALERTE = 12

export function etatMandat(m: Mandat | null, jour: string): EtatMandat | null {
  if (!m?.fin) return m ? 'enCours' : null
  if (m.fin < jour) return 'echu'
  const d = new Date(`${jour}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + MOIS_ALERTE)
  return m.fin <= d.toISOString().slice(0, 10) ? 'aRenouveler' : 'enCours'
}

// Mandats échus ou qui finissent dans l'année, des associés encore en place ; la fin la plus proche d'abord
export function mandatsARenouveler(reseau: Reseau, magasins: Magasin[]): { m: Magasin; a: Associe; mandat: Mandat; etat: EtatMandat }[] {
  const l: { m: Magasin; a: Associe; mandat: Mandat; etat: EtatMandat }[] = []
  for (const m of magasins) {
    if (!m.franchise) continue
    for (const a of associesEnPlace(reseau, m)) {
      const mandat = mandatActuel(a, reseau.jour)
      const etat = etatMandat(mandat, reseau.jour)
      if (mandat && (etat === 'echu' || etat === 'aRenouveler')) l.push({ m, a, mandat, etat })
    }
  }
  return l.sort((x, y) => x.mandat.fin.localeCompare(y.mandat.fin))
}
