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
export const libellesEtatMandat: Record<EtatMandat, string> = { enCours: 'En cours', aRenouveler: 'Fin dans moins de 6 mois', echu: 'Mandat échu' }
export const MOIS_ALERTE = 6

export function etatMandat(m: Mandat | null, jour: string): EtatMandat | null {
  if (!m?.fin) return m ? 'enCours' : null
  if (m.fin < jour) return 'echu'
  const d = new Date(`${jour}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + MOIS_ALERTE)
  return m.fin <= d.toISOString().slice(0, 10) ? 'aRenouveler' : 'enCours'
}

// Mandat de chaque associé (Joseph, 26/10/2026) : franchise comme intégré, 5 ans renouvelés par périodes de 5 ans
// (6 ans d'ancienneté = 2e mandat, 11 ans = 3e). Départ : l'entrée de l'associé, ou plus tard le passage du magasin en
// intégré ou en franchisé, sinon l'ouverture. Les mandats saisis sur l'associé l'emportent sur ce calcul.
export const DUREE_MANDAT = 5
export interface MandatEffectif { mandat: Mandat; numero: number; calcule: boolean; etat: EtatMandat | null }

const plusAns = (iso: string, n: number) => {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(Date.UTC(a + n, m - 1, j)).toISOString().slice(0, 10)
}

export function mandatEffectif(reseau: Reseau, m: Magasin, a: Associe): MandatEffectif | null {
  const jour = reseau.jour
  if (a.mandats.length) {
    const mandat = mandatActuel(a, jour)!
    return { mandat, numero: a.mandats.indexOf(mandat) + 1, calcule: false, etat: etatMandat(mandat, jour) }
  }
  if (!enPlace(a, jour) || (m.fermeture && m.fermeture.date <= jour)) return null
  let depart = m.ouvertureConnue && m.ouverture <= jour ? m.ouverture : ''
  const plusTard = (date: string) => { if (date && date <= jour && date > depart) depart = date }
  for (const s of m.situations) if (s.type === 'integre' || s.type === 'franchise') plusTard(s.date)
  plusTard(a.entree)
  if (!depart) return null
  let n = 1
  while (plusAns(depart, DUREE_MANDAT * n) <= jour) n++
  const mandat = { debut: plusAns(depart, DUREE_MANDAT * (n - 1)), fin: plusAns(depart, DUREE_MANDAT * n) }
  return { mandat, numero: n, calcule: true, etat: etatMandat(mandat, jour) }
}

// Mandats échus ou qui finissent dans les 6 mois, des associés encore en place ; la fin la plus proche d'abord
export function mandatsARenouveler(reseau: Reseau, magasins: Magasin[]): { m: Magasin; a: Associe; mandat: Mandat; etat: EtatMandat; numero: number }[] {
  const l: { m: Magasin; a: Associe; mandat: Mandat; etat: EtatMandat; numero: number }[] = []
  for (const m of magasins) {
    for (const a of associesEnPlace(reseau, m)) {
      const x = mandatEffectif(reseau, m, a)
      if (x && (x.etat === 'echu' || x.etat === 'aRenouveler')) l.push({ m, a, mandat: x.mandat, etat: x.etat, numero: x.numero })
    }
  }
  return l.sort((x, y) => x.mandat.fin.localeCompare(y.mandat.fin) || x.m.nom.localeCompare(y.m.nom, 'fr'))
}

// Fin de mandat la plus proche parmi les associés en place (colonne « Fin de contrat » de l'export des magasins)
export function finDeContrat(reseau: Reseau, m: Magasin): { fin: string; etat: EtatMandat | null } | null {
  const l = associesEnPlace(reseau, m).map((a) => mandatEffectif(reseau, m, a)).filter((x): x is MandatEffectif => !!x?.mandat.fin)
    .sort((x, y) => x.mandat.fin.localeCompare(y.mandat.fin))
  return l.length ? { fin: l[0].mandat.fin, etat: l[0].etat } : null
}
