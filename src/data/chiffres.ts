import type { Reseau, Visite } from './modele'

// Chiffres mensuels d'un magasin (table store_finance, partagée avec l'ancienne app)
// tickets = fréquentation (colonne freq)
export interface ChiffreMois {
  magasin: string
  mois: string // AAAA-MM
  caCave: number | null
  caBar: number | null
  tickets: number | null
  panier: number | null
  ebitda: number | null
}
export type ChampChiffre = 'caCave' | 'caBar' | 'tickets' | 'panier' | 'ebitda'
export const champsChiffres: { id: ChampChiffre; libelle: string; colonne: string; unite: string }[] = [
  { id: 'caCave', libelle: 'CA cave', colonne: 'ca_cave', unite: '€' },
  { id: 'caBar', libelle: 'CA bar', colonne: 'ca_bar', unite: '€' },
  { id: 'tickets', libelle: 'Tickets', colonne: 'freq', unite: '' },
  { id: 'panier', libelle: 'Panier moyen', colonne: 'panier', unite: '€' },
  { id: 'ebitda', libelle: 'EBITDA', colonne: 'ebitda', unite: '€' },
]

// Seuils de l'alerte (démarche coach), réglables dans Paramètres
export interface SeuilsAlerte {
  seuilDecroche: number // baisse du CA sur 3 mois, en %, pour « Décroche »
  seuilSurveiller: number // baisse du CA sur 3 mois, en %, pour « À surveiller »
  seuilRupture: number // écart en points entre l'évolution sur 3 mois et sur 12 mois
  delaiAppel: number // jours pour appeler un magasin qui décroche
}
export const seuilsParDefaut: SeuilsAlerte = { seuilDecroche: 5, seuilSurveiller: 2, seuilRupture: 5, delaiAppel: 2 }

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

export const caDe = (c: ChiffreMois | undefined): number | null => (!c || (c.caCave === null && c.caBar === null) ? null : (c.caCave ?? 0) + (c.caBar ?? 0))

export function chiffresDuMagasin(reseau: Reseau, nom: string): ChiffreMois[] {
  return reseau.chiffres[nom] ?? []
}

// Évolution du CA sur n mois finissant à « fin », comparée aux mêmes mois un an plus tôt (en %)
export function evolution(liste: ChiffreMois[], fin: string, n: number): number | null {
  const parMois = new Map(liste.map((c) => [c.mois, c]))
  let actuel = 0, avant = 0
  for (let i = 0; i < n; i++) {
    const a = caDe(parMois.get(decalerMois(fin, -i))), b = caDe(parMois.get(decalerMois(fin, -i - 12)))
    if (a === null || b === null) return null
    actuel += a; avant += b
  }
  return avant > 0 ? ((actuel - avant) / avant) * 100 : null
}

export interface Analyse {
  mois: string // dernier mois connu
  evol3: number | null
  evol12: number | null
  rupture: number | null // evol3 - evol12, en points
  ebitda3: number | null
  fragilites: string[]
  raisons: string[]
  statut: StatutAlerte | null // null : pas assez de chiffres
}

function analyserAu(reseau: Reseau, nom: string, liste: ChiffreMois[], mois: string, s: SeuilsAlerte): Analyse {
  const evol3 = evolution(liste, mois, 3)
  const evol12 = evolution(liste, mois, 12)
  const rupture = evol3 !== null && evol12 !== null ? evol3 - evol12 : null
  const derniers = [0, 1, 2].map((i) => liste.find((c) => c.mois === decalerMois(mois, -i))?.ebitda ?? null)
  const ebitda3 = derniers.every((e) => e !== null) ? derniers.reduce((a, b) => a! + b!, 0) : null
  const fragilites: string[] = []
  if (reseau.evaluations[nom]?.notes.franchise === 1) fragilites.push('management faible')
  const raisons: string[] = []
  let statut: StatutAlerte | null = null
  if (ebitda3 !== null && ebitda3 < 0) raisons.push('EBITDA négatif sur 3 mois')
  if (evol3 !== null) {
    if (evol3 <= -s.seuilDecroche) raisons.push(`CA sur 3 mois sous −${s.seuilDecroche} %`)
    else if (evol3 <= -s.seuilSurveiller && fragilites.length) raisons.push(`CA sur 3 mois sous −${s.seuilSurveiller} % avec ${fragilites.join(', ')}`)
  }
  if (raisons.length) statut = 'decroche'
  else if (evol3 !== null) {
    if (evol3 <= -s.seuilSurveiller) raisons.push(`CA sur 3 mois sous −${s.seuilSurveiller} %`)
    if (rupture !== null && rupture <= -s.seuilRupture) raisons.push(`rupture de tendance de ${formatPoints(rupture)}`)
    statut = raisons.length ? 'surveiller' : 'ok'
  }
  return { mois, evol3, evol12, rupture, ebitda3, fragilites, raisons, statut }
}

export function analyser(reseau: Reseau, nom: string): Analyse | null {
  const liste = chiffresDuMagasin(reseau, nom)
  const mois = liste.filter((c) => caDe(c) !== null || c.ebitda !== null).at(-1)?.mois
  return mois ? analyserAu(reseau, nom, liste, mois, reseau.seuils) : null
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
  for (let m = decalerMois(a.mois, -1); analyserAu(reseau, nom, liste, m, reseau.seuils).statut === 'decroche'; m = decalerMois(m, -1)) depuis = m
  const alerte = dateAlerte(depuis)
  const limite = isoDe(jourNum(alerte) + reseau.seuils.delaiAppel)
  const contact = reseau.visites.filter((v) => v.magasin === nom && v.date >= alerte && v.date <= reseau.jour).sort((x, y) => x.date.localeCompare(y.date))[0] ?? null
  const delai = contact ? jourNum(contact.date) - jourNum(alerte) : null
  const retard = contact || reseau.jour <= limite ? 0 : jourNum(reseau.jour) - jourNum(limite)
  return { depuis, alerte, limite, contact, delai, retard }
}

export const formatPourcent = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`)
export const formatPoints = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} pts`)
export const formatEuros = (n: number | null) => (n === null ? '—' : `${Math.round(n).toLocaleString('fr-FR')} €`)
export const formatValeur = (id: ChampChiffre, n: number | null) => (n === null ? '—' : id === 'tickets' ? Math.round(n).toLocaleString('fr-FR') : id === 'panier' ? `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : formatEuros(n))

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
export interface ResultatAudit { date: string; type: string; conforme: boolean | null; score: number | null }
export type Audits = Record<string, ResultatAudit[]>
export const typesAudit = ['hygiene', 'excellence']

export function auditDe(reseau: Reseau, magasin: string, date: string, type: string): ResultatAudit | null {
  return reseau.audits[magasin]?.find((a) => a.date === date && a.type === type) ?? null
}
export function dernierAudit(reseau: Reseau, magasin: string, type: string): ResultatAudit | null {
  return (reseau.audits[magasin] ?? []).filter((a) => a.type === type && a.date <= reseau.jour && (a.conforme !== null || a.score !== null)).sort((x, y) => x.date.localeCompare(y.date)).at(-1) ?? null
}
export const libelleAudit = (a: ResultatAudit) => [a.conforme === null ? '' : a.conforme ? 'Conforme' : 'Non conforme', a.score === null ? '' : `${a.score.toLocaleString('fr-FR')} %`].filter(Boolean).join(' · ')
