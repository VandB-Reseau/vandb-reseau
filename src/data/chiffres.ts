import type { Reseau, Visite } from './modele'

// Chiffres mensuels d'un magasin (table store_finance)
// Saisis : CA marché extérieur, panier moyen HT et flux de la cave et du bar, marge en %
// Calculés : CA cave et CA bar (panier × flux), flux cumulé (colonne freq), panier moyen global
// Le CA cumulé (cave + bar + marché extérieur) sert à l'alerte de décrochage
export interface ChiffreMois {
  magasin: string
  mois: string // AAAA-MM
  caExt: number | null
  pmCave: number | null
  fluxCave: number | null
  pmBar: number | null
  fluxBar: number | null
  caCave: number | null
  caBar: number | null
  tickets: number | null // flux cumulé
  panier: number | null
  marge: number | null // en %
}
export type ChampChiffre = Exclude<keyof ChiffreMois, 'magasin' | 'mois'>
export const colonnesChiffres: Record<ChampChiffre, string> = {
  caExt: 'ca_ext', pmCave: 'pm_cave', fluxCave: 'flux_cave', pmBar: 'pm_bar', fluxBar: 'flux_bar',
  caCave: 'ca_cave', caBar: 'ca_bar', tickets: 'freq', panier: 'panier', marge: 'marge',
}
export const libellesChiffres: Record<ChampChiffre, { libelle: string; unite: string }> = {
  caExt: { libelle: 'CA marché extérieur', unite: '€' },
  pmCave: { libelle: 'Panier moyen HT cave', unite: '€' },
  fluxCave: { libelle: 'Flux cave', unite: '' },
  pmBar: { libelle: 'Panier moyen HT bar', unite: '€' },
  fluxBar: { libelle: 'Flux bar', unite: '' },
  caCave: { libelle: 'CA cave', unite: '€' },
  caBar: { libelle: 'CA bar', unite: '€' },
  tickets: { libelle: 'Flux cumulé', unite: '' },
  panier: { libelle: 'Panier moyen', unite: '€' },
  marge: { libelle: 'Marge', unite: '%' },
}
// Champs saisis à la main ; les autres se calculent
export const champsSaisis: ChampChiffre[] = ['caExt', 'pmCave', 'fluxCave', 'pmBar', 'fluxBar', 'marge']

type LigneChiffre = Partial<ChiffreMois> & { magasin: string; mois: string }
// Ajoute à une ligne les chiffres calculés, à partir de ses valeurs et de celles déjà connues pour ce mois
export function completerChiffres(l: LigneChiffre, existant?: ChiffreMois): LigneChiffre {
  const v = <K extends ChampChiffre>(k: K) => (l[k] !== undefined ? l[k] : existant?.[k]) ?? null
  const r: LigneChiffre = { ...l }
  const touche = (a: ChampChiffre, b: ChampChiffre) => l[a] !== undefined || l[b] !== undefined
  if (touche('pmCave', 'fluxCave') && v('pmCave') !== null && v('fluxCave') !== null) r.caCave = Math.round(v('pmCave')! * v('fluxCave')! * 100) / 100
  if (touche('pmBar', 'fluxBar') && v('pmBar') !== null && v('fluxBar') !== null) r.caBar = Math.round(v('pmBar')! * v('fluxBar')! * 100) / 100
  if (touche('fluxCave', 'fluxBar') && (v('fluxCave') !== null || v('fluxBar') !== null)) r.tickets = (v('fluxCave') ?? 0) + (v('fluxBar') ?? 0)
  const caCave = r.caCave !== undefined ? r.caCave : v('caCave'), caBar = r.caBar !== undefined ? r.caBar : v('caBar')
  const ca = caCave === null && caBar === null ? null : (caCave ?? 0) + (caBar ?? 0)
  if (r.tickets && ca !== null) r.panier = Math.round((ca / r.tickets) * 100) / 100
  return r
}

// Règle de décrochage, réglable dans Paramètres : écart du CA cumulé du dernier mois connu
// avec le même mois un an plus tôt (référence 12) ou avec le mois précédent (référence 1)
export interface SeuilsAlerte {
  seuilDecroche: number // baisse du CA, en %, pour « Décroche »
  seuilSurveiller: number // baisse du CA, en %, pour « À surveiller »
  moisReference: number // 12 : même mois l'an dernier ; 1 : mois précédent
  delaiAppel: number // jours pour appeler un magasin qui décroche
}
export const seuilsParDefaut: SeuilsAlerte = { seuilDecroche: 10, seuilSurveiller: 5, moisReference: 12, delaiAppel: 2 }
export const referencesPossibles = [
  { valeur: 12, libelle: 'Même mois l’an dernier' },
  { valeur: 1, libelle: 'Mois précédent' },
]

export type StatutAlerte = 'decroche' | 'surveiller' | 'ok'
export const libelleAlerte: Record<StatutAlerte, string> = { decroche: 'Décroche', surveiller: 'À surveiller', ok: 'OK' }
export const couleurAlerte: Record<StatutAlerte, 'error' | 'warning' | 'success'> = { decroche: 'error', surveiller: 'warning', ok: 'success' }

const moisNoms = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const moisCourts = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
export const libelleMois = (m: string) => `${moisNoms[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
export const libelleMoisCourt = (m: string) => `${moisCourts[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`

export function decalerMois(m: string, n: number): string {
  const total = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1 + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}
// Mois précédent une date : celui dont on saisit les chiffres en début de mois
export const moisPrecedent = (iso: string) => decalerMois(iso.slice(0, 7), -1)

export const caDe = (c: ChiffreMois | undefined): number | null => (!c || (c.caCave === null && c.caBar === null && c.caExt === null) ? null : (c.caCave ?? 0) + (c.caBar ?? 0) + (c.caExt ?? 0))

export function chiffresDuMagasin(reseau: Reseau, nom: string): ChiffreMois[] {
  return reseau.chiffres[nom] ?? []
}

export interface Analyse {
  mois: string // dernier mois connu
  chiffre: ChiffreMois // chiffres de ce mois, ceux de la fiche magasin
  ca: number | null // CA cumulé du mois
  reference: string // mois de comparaison
  caReference: number | null
  ecart: number | null // en %
  raisons: string[]
  statut: StatutAlerte | null // null : pas de CA pour le mois de comparaison
}

function analyserAu(liste: ChiffreMois[], mois: string, s: SeuilsAlerte): Analyse {
  const parMois = new Map(liste.map((c) => [c.mois, c]))
  const chiffre = parMois.get(mois) ?? { magasin: '', mois, caExt: null, pmCave: null, fluxCave: null, pmBar: null, fluxBar: null, caCave: null, caBar: null, tickets: null, panier: null, marge: null }
  const reference = decalerMois(mois, -(s.moisReference || 12))
  const ca = caDe(chiffre), caReference = caDe(parMois.get(reference))
  const ecart = ca !== null && caReference ? ((ca - caReference) / caReference) * 100 : null
  const raisons: string[] = []
  let statut: StatutAlerte | null = null
  if (ecart !== null) {
    const vs = `vs ${libelleMois(reference)}`
    if (ecart <= -s.seuilDecroche) { statut = 'decroche'; raisons.push(`CA ${formatPourcent(ecart)} ${vs}`) }
    else if (ecart <= -s.seuilSurveiller) { statut = 'surveiller'; raisons.push(`CA ${formatPourcent(ecart)} ${vs}`) }
    else statut = 'ok'
  }
  return { mois, chiffre, ca, reference, caReference, ecart, raisons, statut }
}

export function analyser(reseau: Reseau, nom: string, seuils = reseau.seuils): Analyse | null {
  const liste = chiffresDuMagasin(reseau, nom)
  const mois = liste.filter((c) => caDe(c) !== null).at(-1)?.mois
  return mois ? analyserAu(liste, mois, seuils) : null
}

// Contacts qui ne sont pas des visites : ils ne comptent pas dans le rythme de visite
export const typesContact = ['appel', 'point']
// La feuille de route (revue budgétaire) a son compte rendu mais ne compte pas non plus dans le rythme
export const estVisite = (v: Visite) => !typesContact.includes(v.type) && v.type !== 'feuille'

export interface SuiviAlerte {
  depuis: string // premier mois de la série « Décroche »
  alerte: string // date de l'alerte (AAAA-MM-JJ)
  limite: string // date avant laquelle appeler
  contact: Visite | null // premier appel, point ou visite après l'alerte
  delai: number | null // jours entre l'alerte et le premier contact
  retard: number // jours de retard si personne n'a appelé
}

const jourNum = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86400000
const isoDe = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10)

// Les chiffres d'un mois arrivent en début de mois suivant : l'alerte part le 5 (démarche coach)
export const dateAlerte = (mois: string) => `${decalerMois(mois, 1)}-05`

export function suiviAlerte(reseau: Reseau, nom: string, a: Analyse | null): SuiviAlerte | null {
  if (a?.statut !== 'decroche') return null
  const liste = chiffresDuMagasin(reseau, nom)
  let depuis = a.mois
  for (let m = decalerMois(a.mois, -1); analyserAu(liste, m, reseau.seuils).statut === 'decroche'; m = decalerMois(m, -1)) depuis = m
  const alerte = dateAlerte(depuis)
  const limite = isoDe(jourNum(alerte) + reseau.seuils.delaiAppel)
  const contact = reseau.visites.filter((v) => v.magasin === nom && v.date >= alerte && v.date <= reseau.jour).sort((x, y) => x.date.localeCompare(y.date))[0] ?? null
  const delai = contact ? jourNum(contact.date) - jourNum(alerte) : null
  const retard = contact || reseau.jour <= limite ? 0 : jourNum(reseau.jour) - jourNum(limite)
  return { depuis, alerte, limite, contact, delai, retard }
}

export const formatPourcent = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`)
export const formatEuros = (n: number | null) => (n === null ? '—' : `${Math.round(n).toLocaleString('fr-FR')} €`)
export const formatValeur = (id: ChampChiffre, n: number | null) => (n === null ? '—' : ['tickets', 'fluxCave', 'fluxBar'].includes(id) ? Math.round(n).toLocaleString('fr-FR') : id === 'marge' ? `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %` : ['panier', 'pmCave', 'pmBar'].includes(id) ? `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : formatEuros(n))

// Nombre saisi ou importé : « 12 345,67 € » → 12345.67
export function lireNombre(v: unknown): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null
  let t = String(v ?? '').replace(/[\s  €%]/g, '')
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '') // 12.345,67
  t = t.replace(',', '.')
  if (!t || !/^-?\d*\.?\d+$/.test(t)) return null
  return Number(t)
}

// ── Audits obligatoires : résultat consolidé (app_config, clé audits) ──
// reponses : grille remplie pendant la visite (sinon résultat saisi directement ou importé)
export interface ResultatAudit { date: string; type: string; conforme: boolean | null; score: number | null; reponses?: import('./grilles').Reponses }
export type Audits = Record<string, ResultatAudit[]>
export const typesAudit = ['hygiene', 'excellence']

export function auditDe(reseau: Reseau, magasin: string, date: string, type: string): ResultatAudit | null {
  return reseau.audits[magasin]?.find((a) => a.date === date && a.type === type) ?? null
}
export function dernierAudit(reseau: Reseau, magasin: string, type: string): ResultatAudit | null {
  return (reseau.audits[magasin] ?? []).filter((a) => a.type === type && a.date <= reseau.jour && (a.conforme !== null || a.score !== null)).sort((x, y) => x.date.localeCompare(y.date)).at(-1) ?? null
}
export const libelleAudit = (a: ResultatAudit) => [a.conforme === null ? '' : a.conforme ? 'Conforme' : 'Non conforme', a.score === null ? '' : `${a.score.toLocaleString('fr-FR')} %`].filter(Boolean).join(' · ')
// Montant arrondi au millier, pour les lignes compactes : « 70 k€ », « 93,5 k€ », « 1,2 M€ »
export const formatKEuros = (n: number | null) => {
  if (n === null) return '—'
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M€`
  if (a >= 1000) return `${(n / 1000).toLocaleString('fr-FR', { maximumFractionDigits: a >= 100_000 ? 0 : 1 })} k€`
  return formatEuros(n)
}
