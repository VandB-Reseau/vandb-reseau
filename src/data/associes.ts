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

// Contrat du magasin (Joseph, 26/10/2026) : franchise comme intégré, signé pour 5 ans puis renouvelé par périodes de
// 5 ans (6 ans d'ancienneté = 2e contrat, 11 ans = 3e). Départ : la dernière reprise (entrée des franchisés ou associés
// en place, passage en intégré ou en franchisé), sinon l'ouverture. Un mandat saisi sur un franchisé l'emporte.
export const DUREE_CONTRAT = 5
export type OrigineContrat = 'ouverture' | 'reprise' | 'integration' | 'franchise'
export interface Contrat { depart: string; origine: OrigineContrat; debut: string; fin: string; numero: number }
export const libellesOrigineContrat: Record<OrigineContrat, string> = { ouverture: 'l’ouverture', reprise: 'la reprise', integration: 'le passage en intégré', franchise: 'le passage en franchisé' }

const plusAns = (iso: string, n: number) => {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(Date.UTC(a + n, m - 1, j)).toISOString().slice(0, 10)
}

export function contratCalcule(reseau: Reseau, m: Magasin): Contrat | null {
  const jour = reseau.jour
  if (!m.ouvertureConnue || m.ouverture > jour || (m.fermeture && m.fermeture.date <= jour)) return null
  let depart: { date: string; origine: OrigineContrat } = { date: m.ouverture, origine: 'ouverture' }
  const plusTard = (date: string, origine: OrigineContrat) => { if (date && date <= jour && date > depart.date) depart = { date, origine } }
  for (const s of m.situations) if (s.type === 'integre' || s.type === 'franchise') plusTard(s.date, s.type === 'integre' ? 'integration' : 'franchise')
  for (const a of associesEnPlace(reseau, m)) plusTard(a.entree, 'reprise')
  let n = 1
  while (plusAns(depart.date, DUREE_CONTRAT * n) <= jour) n++
  return { depart: depart.date, origine: depart.origine, debut: plusAns(depart.date, DUREE_CONTRAT * (n - 1)), fin: plusAns(depart.date, DUREE_CONTRAT * n), numero: n }
}

// Mandat saisi en cours sur un franchisé en place (avec sa fin), sinon null
const mandatsSaisis = (reseau: Reseau, m: Magasin) => (m.franchise ? associesEnPlace(reseau, m) : [])
  .map((a) => ({ a, mandat: mandatActuel(a, reseau.jour) })).filter((x): x is { a: Associe; mandat: Mandat } => !!x.mandat?.fin)

// Fin de contrat retenue pour le magasin : mandat saisi le plus proche, sinon le contrat calculé
export function finDeContrat(reseau: Reseau, m: Magasin): { fin: string; contrat: Contrat | null; etat: EtatMandat | null } | null {
  const saisis = mandatsSaisis(reseau, m).sort((x, y) => x.mandat.fin.localeCompare(y.mandat.fin))
  if (saisis.length) return { fin: saisis[0].mandat.fin, contrat: null, etat: etatMandat(saisis[0].mandat, reseau.jour) }
  const c = contratCalcule(reseau, m)
  return c ? { fin: c.fin, contrat: c, etat: etatMandat({ debut: c.debut, fin: c.fin }, reseau.jour) } : null
}

// Mandats échus ou qui finissent dans l'année, des associés encore en place ; sans mandat saisi, le contrat calculé
// du magasin (a vide) ; la fin la plus proche d'abord
export function mandatsARenouveler(reseau: Reseau, magasins: Magasin[]): { m: Magasin; a: Associe | null; mandat: Mandat; etat: EtatMandat }[] {
  const l: { m: Magasin; a: Associe | null; mandat: Mandat; etat: EtatMandat }[] = []
  for (const m of magasins) {
    const saisis = mandatsSaisis(reseau, m)
    for (const { a, mandat } of saisis) {
      const etat = etatMandat(mandat, reseau.jour)
      if (etat === 'echu' || etat === 'aRenouveler') l.push({ m, a, mandat, etat })
    }
    if (saisis.length) continue
    const c = contratCalcule(reseau, m)
    const mandat = c && { debut: c.debut, fin: c.fin }
    const etat = etatMandat(mandat, reseau.jour)
    if (mandat && etat === 'aRenouveler') l.push({ m, a: null, mandat, etat })
  }
  return l.sort((x, y) => x.mandat.fin.localeCompare(y.mandat.fin))
}
