// Onglet « Pilotage » (Joseph, 17/11/2026, propositions 286 à 292) : rapports, graphes et tableaux croisés sur tous les
// sujets suivis par l'app. Moteur pur : catalogue d'indicateurs par thème, axes de regroupement (dont les typologies),
// périodes (mois, cumul, 12 mois, quadrimestre, année) toujours comparées à l'an dernier, découpage par mois ou par
// quadrimestre. Aucun appel à la base ici : les écrans passent le réseau et les budgets déjà chargés.
//
// Visibilité : le franchisé ne voit que ses magasins (le réseau qu'il reçoit n'en contient pas d'autres), jamais la
// nine box ni les axes de l'équipe (Coach, RR, groupe budgétaire). Pas de médiane ni de comparaison à d'autres magasins.
import { decalerMois, estVisite, type ChiffreMois } from './chiffres'
import type { Magasin, Reseau } from './modele'
import { libellesLicence, libellesTypologie, libellesZone } from './exploitation'
import { caseDe, scoreAxe, tonDe, type Thematique } from './sante'
import { normaliserExterieur, synthese } from './marcheExterieur'
import { visiteFaite } from './modele'
import { peuEngage, silence, type Engagement } from './engagement'

// ── Données des budgets (schéma pilotage), chargées à part ──────────────
export interface FinanceMagasin {
  annee: number
  caReel: number[] // CA HT réel de chaque mois de l'année de suivi (0 : pas de réel)
  caBudget: number[] | null // CA HT budgété de chaque mois, null sans budget
  statut: string // « Validé », « En discussion », « Proposé » ou « Sans budget »
  groupe: string
  // À date (fin du dernier mois réalisé), comme le suivi des budgets
  moisRealises: number
  personnel: number | null
  heures: number | null
  ebe: number | null
  loyer: number | null
  caADate: number
  moisStock: number | null
}

// ── Périodes ────────────────────────────────────────────────────────────
export type TypePeriode = 'mois' | 'cumul' | 'douze' | 'quadrimestre' | 'annee'
export interface Periode { type: TypePeriode; mois?: string } // mois : mois de référence AAAA-MM ; absent = dernier mois clos
export const TYPES_PERIODE: { cle: TypePeriode; libelle: string }[] = [
  { cle: 'mois', libelle: 'Le mois' },
  { cle: 'cumul', libelle: 'Depuis janvier' },
  { cle: 'douze', libelle: '12 derniers mois' },
  { cle: 'quadrimestre', libelle: 'Le quadrimestre' },
  { cle: 'annee', libelle: 'L’année entière' },
]
export type Decoupage = 'aucun' | 'mois' | 'quadrimestre'
export const DECOUPAGES: { cle: Decoupage; libelle: string }[] = [
  { cle: 'aucun', libelle: 'Indicateurs' },
  { cle: 'mois', libelle: 'Mois' },
  { cle: 'quadrimestre', libelle: 'Quadrimestres' },
]

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
export const libelleMoisLong = (m: string) => `${NOMS_MOIS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
export const libelleMoisCourt = (m: string) => `${COURTS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`
const quadriDe = (m: string) => Math.floor((Number(m.slice(5, 7)) - 1) / 4) + 1
const QUADRIS = ['janvier à avril', 'mai à août', 'septembre à décembre']

// Dernier mois clos : le mois précédent celui du jour (la clôture se fait au début du mois suivant)
export const dernierMoisClos = (jour: string) => decalerMois(jour.slice(0, 7), -1)

export function moisDeLaPeriode(p: Periode, jour: string): string[] {
  const ref = p.mois && /^\d{4}-\d{2}$/.test(p.mois) ? p.mois : dernierMoisClos(jour)
  const annee = ref.slice(0, 4)
  const de = (debut: string, n: number) => Array.from({ length: n }, (_, i) => decalerMois(debut, i))
  switch (p.type) {
    case 'mois': return [ref]
    case 'cumul': return de(`${annee}-01`, Number(ref.slice(5, 7)))
    case 'douze': return de(decalerMois(ref, -11), 12)
    case 'quadrimestre': { const q = quadriDe(ref); return de(`${annee}-${String((q - 1) * 4 + 1).padStart(2, '0')}`, 4) }
    case 'annee': return de(`${annee}-01`, 12)
  }
}

export function libellePeriode(p: Periode, jour: string): string {
  const mois = moisDeLaPeriode(p, jour)
  const ref = p.mois && /^\d{4}-\d{2}$/.test(p.mois) ? p.mois : dernierMoisClos(jour)
  switch (p.type) {
    case 'mois': return libelleMoisLong(ref)
    case 'cumul': return `De janvier à ${libelleMoisLong(ref)}`
    case 'douze': return `De ${libelleMoisLong(mois[0])} à ${libelleMoisLong(ref)}`
    case 'quadrimestre': return `Quadrimestre ${quadriDe(ref)} ${ref.slice(0, 4)} (${QUADRIS[quadriDe(ref) - 1]})`
    case 'annee': return `Année ${ref.slice(0, 4)}`
  }
}

// Colonnes d'un découpage : chaque colonne garde ses mois
export function colonnesTemps(mois: string[], d: Decoupage): { cle: string; libelle: string; mois: string[] }[] {
  if (d === 'mois') return mois.map((m) => ({ cle: m, libelle: libelleMoisCourt(m), mois: [m] }))
  if (d === 'quadrimestre') {
    const groupes = new Map<string, string[]>()
    for (const m of mois) { const k = `${m.slice(0, 4)}-Q${quadriDe(m)}`; groupes.set(k, [...(groupes.get(k) ?? []), m]) }
    return [...groupes].map(([k, l]) => ({ cle: k, libelle: `Q${k.slice(-1)} ${k.slice(2, 4)}`, mois: l }))
  }
  return [{ cle: 'tout', libelle: '', mois }]
}

// ── Contexte de calcul ──────────────────────────────────────────────────
export interface Contexte {
  reseau: Reseau
  finances: Map<string, FinanceMagasin> | null // null : budgets pas (encore) chargés
  jour: string
  equipe: boolean // false pour un franchisé
  // Engagement du franchisé de chaque magasin (90 jours, équipe seule) ; absent : indicateurs vides
  engagement?: ((m: Magasin) => Engagement | null) | null
}
const cacheIndex = new WeakMap<Reseau, Map<string, Map<string, ChiffreMois>>>()
function chiffre(r: Reseau, magasin: string, mois: string): ChiffreMois | undefined {
  let idx = cacheIndex.get(r)
  if (!idx) { idx = new Map(); cacheIndex.set(r, idx) }
  let m = idx.get(magasin)
  if (!m) { m = new Map((r.chiffres[magasin] ?? []).map((c) => [c.mois, c])); idx.set(magasin, m) }
  return m.get(mois)
}
const caDe = (c: ChiffreMois | undefined) => (!c || (c.caCave === null && c.caBar === null && c.caExt === null) ? null : (c.caCave ?? 0) + (c.caBar ?? 0) + (c.caExt ?? 0))

// ── Indicateurs ─────────────────────────────────────────────────────────
// Mesure d'un magasin : n seul (agrégé en somme ou en moyenne) ou n / d (ratio : sommes des n sur sommes des d),
// ou un texte (le plus fréquent du groupe). moins1 : le ratio se lit en évolution (n / d − 1).
export type Mesure = { n: number; d?: number } | { texte: string }
export type Format = 'euros' | 'euros2' | 'pct' | 'ecart' | 'nombre' | 'texte' | 'jours' | 'note' | 'mois'
export type Theme = 'ventes' | 'budget' | 'exterieur' | 'ninebox' | 'deploiements' | 'animation' | 'engagement'
export const THEMES: { cle: Theme; libelle: string; equipeSeule?: boolean }[] = [
  { cle: 'ventes', libelle: 'Ventes (caisse)' },
  { cle: 'budget', libelle: 'Budget et résultat' },
  { cle: 'exterieur', libelle: 'Marché extérieur' },
  { cle: 'ninebox', libelle: 'Nine box et santé', equipeSeule: true },
  { cle: 'deploiements', libelle: 'Déploiements', equipeSeule: true },
  { cle: 'animation', libelle: 'Animation du réseau' },
  { cle: 'engagement', libelle: 'Engagement du franchisé', equipeSeule: true },
]
export interface Indicateur {
  id: string
  libelle: string
  theme: Theme
  format: Format
  agregat: 'somme' | 'moyenne' | 'ratio' | 'texte'
  moins1?: boolean
  temporel: boolean // suit la période et se découpe par mois ; sinon : situation à date
  inverse?: boolean // plus bas = mieux (tâches en retard, jours sans visite…)
  equipeSeule?: boolean
  aide?: string
  mesure: (c: Contexte, m: Magasin, mois: string[]) => Mesure | null
}

const sommeMois = (c: Contexte, m: Magasin, mois: string[], f: (x: ChiffreMois) => number | null) => {
  let s = 0, vu = false
  for (const x of mois) { const ch = chiffre(c.reseau, m.nom, x); const v = ch ? f(ch) : null; if (v !== null && v !== undefined) { s += v; vu = true } }
  return vu ? s : null
}
const n1 = (mois: string[]) => mois.map((x) => decalerMois(x, -12))
const val = (n: number | null): Mesure | null => (n === null ? null : { n })
const ratio = (n: number | null, d: number | null): Mesure | null => (n === null || d === null || d === 0 ? null : { n, d })

// Mois de l'année de suivi des budgets compris dans la période, avec un réel saisi
function moisBudget(f: FinanceMagasin, mois: string[]): number[] {
  return mois.filter((x) => Number(x.slice(0, 4)) === f.annee).map((x) => Number(x.slice(5, 7)) - 1).filter((i) => (f.caReel[i] ?? 0) > 0)
}
const fin = (c: Contexte, m: Magasin) => c.finances?.get(m.nom) ?? null

const visitesFaites = (c: Contexte, m: Magasin) => c.reseau.visites.filter((v) => v.magasin === m.nom && estVisite(v) && visiteFaite(v, c.jour))
const eng = (c: Contexte, m: Magasin) => (c.equipe && c.engagement ? c.engagement(m) : null)
const tachesOuvertes = (c: Contexte, m: Magasin) => (c.reseau.actionsLibres[m.nom] ?? []).filter((t) => !t.faite)
const planExterieur = (c: Contexte, m: Magasin) => {
  const p = normaliserExterieur(c.reseau.exterieur ?? {})[m.nom]
  return p ? synthese(p, c.reseau.actionsLibres[m.nom]) : null
}

export const INDICATEURS: Indicateur[] = [
  // Ventes (caisse) : Cave et Bar jamais additionnés pour les tickets et le panier
  { id: 'ca', libelle: 'CA HT', theme: 'ventes', format: 'euros', agregat: 'somme', temporel: true, mesure: (c, m, mois) => val(sommeMois(c, m, mois, caDe)) },
  { id: 'caN1', libelle: 'CA HT de l’an dernier', theme: 'ventes', format: 'euros', agregat: 'somme', temporel: true, mesure: (c, m, mois) => val(sommeMois(c, m, n1(mois), caDe)) },
  {
    id: 'evolution', libelle: 'Évolution du CA sur l’an dernier', theme: 'ventes', format: 'ecart', agregat: 'ratio', moins1: true, temporel: true,
    // Mêmes mois des deux côtés : un mois sans chiffre une des deux années sort du calcul
    mesure: (c, m, mois) => {
      const l = mois.filter((x) => caDe(chiffre(c.reseau, m.nom, x)) !== null && caDe(chiffre(c.reseau, m.nom, decalerMois(x, -12))) !== null)
      return l.length ? ratio(sommeMois(c, m, l, caDe), sommeMois(c, m, n1(l), caDe)) : null
    },
  },
  { id: 'caCave', libelle: 'CA HT Cave', theme: 'ventes', format: 'euros', agregat: 'somme', temporel: true, mesure: (c, m, mois) => val(sommeMois(c, m, mois, (x) => x.caCave)) },
  { id: 'caBar', libelle: 'CA HT Bar', theme: 'ventes', format: 'euros', agregat: 'somme', temporel: true, mesure: (c, m, mois) => val(sommeMois(c, m, mois, (x) => x.caBar)) },
  { id: 'caExt', libelle: 'CA HT Extérieur', theme: 'ventes', format: 'euros', agregat: 'somme', temporel: true, mesure: (c, m, mois) => val(sommeMois(c, m, mois, (x) => x.caExt)) },
  { id: 'ticketsCave', libelle: 'Tickets Cave', theme: 'ventes', format: 'nombre', agregat: 'somme', temporel: true, mesure: (c, m, mois) => val(sommeMois(c, m, mois, (x) => x.fluxCave)) },
  { id: 'ticketsBar', libelle: 'Tickets Bar', theme: 'ventes', format: 'nombre', agregat: 'somme', temporel: true, mesure: (c, m, mois) => val(sommeMois(c, m, mois, (x) => x.fluxBar)) },
  {
    id: 'evolTicketsCave', libelle: 'Tickets Cave sur l’an dernier', theme: 'ventes', format: 'ecart', agregat: 'ratio', moins1: true, temporel: true,
    mesure: (c, m, mois) => { const l = mois.filter((x) => (chiffre(c.reseau, m.nom, x)?.fluxCave ?? null) !== null && (chiffre(c.reseau, m.nom, decalerMois(x, -12))?.fluxCave ?? null) !== null); return l.length ? ratio(sommeMois(c, m, l, (x) => x.fluxCave), sommeMois(c, m, n1(l), (x) => x.fluxCave)) : null },
  },
  {
    id: 'evolTicketsBar', libelle: 'Tickets Bar sur l’an dernier', theme: 'ventes', format: 'ecart', agregat: 'ratio', moins1: true, temporel: true,
    mesure: (c, m, mois) => { const l = mois.filter((x) => (chiffre(c.reseau, m.nom, x)?.fluxBar ?? null) !== null && (chiffre(c.reseau, m.nom, decalerMois(x, -12))?.fluxBar ?? null) !== null); return l.length ? ratio(sommeMois(c, m, l, (x) => x.fluxBar), sommeMois(c, m, n1(l), (x) => x.fluxBar)) : null },
  },
  { id: 'panierCave', libelle: 'Panier moyen HT Cave', theme: 'ventes', format: 'euros2', agregat: 'ratio', temporel: true, mesure: (c, m, mois) => ratio(sommeMois(c, m, mois, (x) => (x.fluxCave ? x.caCave : null)), sommeMois(c, m, mois, (x) => (x.caCave !== null ? x.fluxCave : null))) },
  { id: 'panierBar', libelle: 'Panier moyen HT Bar', theme: 'ventes', format: 'euros2', agregat: 'ratio', temporel: true, mesure: (c, m, mois) => ratio(sommeMois(c, m, mois, (x) => (x.fluxBar ? x.caBar : null)), sommeMois(c, m, mois, (x) => (x.caBar !== null ? x.fluxBar : null))) },
  {
    id: 'marge', libelle: 'Taux de marge', theme: 'ventes', format: 'pct', agregat: 'ratio', temporel: true,
    // Marge en % de chaque mois pondérée par son CA
    mesure: (c, m, mois) => ratio(sommeMois(c, m, mois, (x) => (x.marge === null || caDe(x) === null ? null : x.marge / 100 * caDe(x)!)), sommeMois(c, m, mois, (x) => (x.marge === null ? null : caDe(x)))),
  },
  // Budget et résultat (schéma pilotage)
  {
    id: 'caBudget', libelle: 'CA HT budgété', theme: 'budget', format: 'euros', agregat: 'somme', temporel: true,
    mesure: (c, m, mois) => { const f = fin(c, m); if (!f?.caBudget) return null; const l = mois.filter((x) => Number(x.slice(0, 4)) === f.annee).map((x) => Number(x.slice(5, 7)) - 1); return l.length ? { n: l.reduce((s, i) => s + (f.caBudget![i] ?? 0), 0) } : null },
  },
  {
    id: 'ecartBudget', libelle: 'Écart du CA au budget', theme: 'budget', format: 'ecart', agregat: 'ratio', moins1: true, temporel: true,
    aide: 'Mois réalisés de la période seulement, comparés au budget des mêmes mois.',
    mesure: (c, m, mois) => { const f = fin(c, m); if (!f?.caBudget) return null; const l = moisBudget(f, mois); return ratio(l.length ? l.reduce((s, i) => s + f.caReel[i], 0) : null, l.reduce((s, i) => s + (f.caBudget![i] ?? 0), 0)) },
  },
  { id: 'statutBudget', libelle: 'Statut du budget', theme: 'budget', format: 'texte', agregat: 'texte', temporel: false, mesure: (c, m) => { const f = fin(c, m); return f ? { texte: f.statut } : null } },
  { id: 'pctFP', libelle: '% frais de personnel (à date)', theme: 'budget', format: 'pct', agregat: 'ratio', temporel: false, inverse: true, mesure: (c, m) => { const f = fin(c, m); return f ? ratio(f.personnel, f.caADate) : null } },
  { id: 'caHeure', libelle: 'CA HT par heure travaillée (à date)', theme: 'budget', format: 'euros2', agregat: 'ratio', temporel: false, mesure: (c, m) => { const f = fin(c, m); return f ? ratio(f.caADate || null, f.heures) : null } },
  { id: 'ebe', libelle: 'EBE (à date)', theme: 'budget', format: 'euros', agregat: 'somme', temporel: false, aide: 'Quadrimestres saisis, puis budget pour les mois sans comptes.', mesure: (c, m) => val(fin(c, m)?.ebe ?? null) },
  { id: 'ebeCA', libelle: 'EBE sur CA (à date)', theme: 'budget', format: 'pct', agregat: 'ratio', temporel: false, mesure: (c, m) => { const f = fin(c, m); return f ? ratio(f.ebe, f.caADate) : null } },
  { id: 'loyerCA', libelle: 'Loyer sur CA (à date)', theme: 'budget', format: 'pct', agregat: 'ratio', temporel: false, inverse: true, mesure: (c, m) => { const f = fin(c, m); return f ? ratio(f.loyer, f.caADate) : null } },
  { id: 'stock', libelle: 'Stock en mois d’achats', theme: 'budget', format: 'mois', agregat: 'moyenne', temporel: false, mesure: (c, m) => val(fin(c, m)?.moisStock ?? null) },
  // Marché extérieur
  { id: 'extCibles', libelle: 'Cibles repérées', theme: 'exterieur', format: 'nombre', agregat: 'somme', temporel: false, mesure: (c, m) => { const s = planExterieur(c, m); return s ? { n: s.cibles } : null } },
  { id: 'extPriorites', libelle: 'Cibles prioritaires', theme: 'exterieur', format: 'nombre', agregat: 'somme', temporel: false, mesure: (c, m) => { const s = planExterieur(c, m); return s ? { n: s.parQuadrant.priorite } : null } },
  { id: 'extContrats', libelle: 'Contrats en cours', theme: 'exterieur', format: 'nombre', agregat: 'somme', temporel: false, mesure: (c, m) => { const s = planExterieur(c, m); return s ? { n: s.sousContrat } : null } },
  { id: 'extCAContrats', libelle: 'CA annuel des contrats', theme: 'exterieur', format: 'euros', agregat: 'somme', temporel: false, mesure: (c, m) => { const s = planExterieur(c, m); return s ? { n: s.caContrat } : null } },
  { id: 'extCAVise', libelle: 'CA visé sur les cibles', theme: 'exterieur', format: 'euros', agregat: 'somme', temporel: false, mesure: (c, m) => { const s = planExterieur(c, m); return s ? { n: s.caVise } : null } },
  { id: 'extActions', libelle: 'Actions du plan faites', theme: 'exterieur', format: 'pct', agregat: 'ratio', temporel: false, mesure: (c, m) => { const s = planExterieur(c, m); return s ? ratio(s.faites, s.actions) : null } },
  // Nine box et santé : jamais pour le franchisé
  { id: 'caseNineBox', libelle: 'Case de la nine box', theme: 'ninebox', format: 'texte', agregat: 'texte', temporel: false, equipeSeule: true, mesure: (c, m) => { const k = caseDe(c.reseau.evaluations[m.nom], c.reseau.grilleNineBox); return k ? { texte: k.libelle } : null } },
  { id: 'noteResultats', libelle: 'Note Résultats (sur 3)', theme: 'ninebox', format: 'note', agregat: 'moyenne', temporel: false, equipeSeule: true, mesure: (c, m) => val(scoreAxe(c.reseau.evaluations[m.nom], 'resultats', c.reseau.grilleNineBox)) },
  { id: 'noteFranchise', libelle: 'Note Franchisé (sur 3)', theme: 'ninebox', format: 'note', agregat: 'moyenne', temporel: false, equipeSeule: true, mesure: (c, m) => val(scoreAxe(c.reseau.evaluations[m.nom], 'franchise', c.reseau.grilleNineBox)) },
  {
    id: 'deploiements', libelle: 'Déploiements réussis (toutes thématiques)', theme: 'deploiements', format: 'pct', agregat: 'ratio', temporel: false, equipeSeule: true,
    mesure: (c, m) => { const t = c.reseau.deploiements.thematiques; if (!t.length || m.statut === 'avenir') return null; return { n: t.filter((x) => tonDe(x, c.reseau.deploiements.valeurs[m.nom]?.[x.id]) === 'positif').length, d: t.length } },
  },
  // Animation du réseau
  { id: 'visites', libelle: 'Visites faites', theme: 'animation', format: 'nombre', agregat: 'somme', temporel: true, mesure: (c, m, mois) => ({ n: visitesFaites(c, m).filter((v) => mois.includes(v.date.slice(0, 7))).length }) },
  {
    id: 'joursSansVisite', libelle: 'Jours depuis la dernière visite', theme: 'animation', format: 'jours', agregat: 'moyenne', temporel: false, inverse: true,
    mesure: (c, m) => { const d = visitesFaites(c, m).map((v) => v.date).sort().at(-1); return d ? { n: Math.max(0, Math.round((Date.parse(c.jour) - Date.parse(d)) / 864e5)) } : null },
  },
  { id: 'tachesOuvertes', libelle: 'Tâches ouvertes', theme: 'animation', format: 'nombre', agregat: 'somme', temporel: false, mesure: (c, m) => ({ n: tachesOuvertes(c, m).length }) },
  { id: 'tachesRetard', libelle: 'Tâches en retard', theme: 'animation', format: 'nombre', agregat: 'somme', temporel: false, inverse: true, mesure: (c, m) => ({ n: tachesOuvertes(c, m).filter((t) => t.echeance && t.echeance < c.jour).length }) },
  { id: 'tachesFaites', libelle: 'Tâches faites', theme: 'animation', format: 'nombre', agregat: 'somme', temporel: true, mesure: (c, m, mois) => ({ n: (c.reseau.actionsLibres[m.nom] ?? []).filter((t) => t.faite && mois.includes(t.faite.slice(0, 7))).length }) },
  { id: 'tachesBloquees', libelle: 'Tâches bloquées', theme: 'animation', format: 'nombre', agregat: 'somme', temporel: false, inverse: true, mesure: (c, m) => ({ n: tachesOuvertes(c, m).filter((t) => t.statut === 'bloquee').length }) },
  { id: 'tachesProches', libelle: 'Tâches à échéance sous 15 jours', theme: 'animation', format: 'nombre', agregat: 'somme', temporel: false, mesure: (c, m) => { const fin = new Date(Date.parse(c.jour) + 15 * 864e5).toISOString().slice(0, 10); return { n: tachesOuvertes(c, m).filter((t) => t.echeance && t.echeance >= c.jour && t.echeance <= fin).length } } },
  { id: 'tachesTenues', libelle: 'Tâches faites à l’heure', theme: 'animation', format: 'pct', agregat: 'ratio', temporel: true, aide: 'Tâches faites dans la période, à leur échéance ou avant.', mesure: (c, m, mois) => { const l = (c.reseau.actionsLibres[m.nom] ?? []).filter((t) => t.faite && t.echeance && mois.includes(t.faite.slice(0, 7))); return ratio(l.filter((t) => t.faite!.slice(0, 10) <= t.echeance).length, l.length) } },
  { id: 'prioritesActives', libelle: 'Priorités de l’année en cours', theme: 'animation', format: 'nombre', agregat: 'somme', temporel: false, mesure: (c, m) => ({ n: (c.reseau.plans?.[m.nom] ?? []).filter((p) => p.statut === 'active').length }) },
  { id: 'prioritesAtteintes', libelle: 'Priorités atteintes', theme: 'animation', format: 'nombre', agregat: 'somme', temporel: true, mesure: (c, m, mois) => ({ n: (c.reseau.plans?.[m.nom] ?? []).filter((p) => p.statut === 'atteinte' && p.closLe && mois.includes(p.closLe.slice(0, 7))).length }) },
  // Engagement du franchisé : mêmes repères que sa fiche (90 jours glissants), jamais montrés au franchisé
  { id: 'engCommunications', libelle: 'Communications lues (90 jours)', theme: 'engagement', format: 'pct', agregat: 'ratio', temporel: false, equipeSeule: true, aide: 'Communications du siège des 90 derniers jours lues par le franchisé. Visible du Directeur et des Responsables Régionaux.', mesure: (c, m) => { const r = eng(c, m)?.communications; return r ? ratio(r.fait, r.total) : null } },
  { id: 'engTaches', libelle: 'Tâches tenues dans les délais (90 jours)', theme: 'engagement', format: 'pct', agregat: 'ratio', temporel: false, equipeSeule: true, aide: 'Tâches portées par le franchisé arrivées à échéance dans les 90 derniers jours et faites à temps.', mesure: (c, m) => { const r = eng(c, m)?.taches; return r ? ratio(r.fait, r.total) : null } },
  { id: 'engReunions', libelle: 'Réunions et formations suivies (90 jours)', theme: 'engagement', format: 'pct', agregat: 'ratio', temporel: false, equipeSeule: true, mesure: (c, m) => { const r = eng(c, m)?.reunions; return r ? ratio(r.fait, r.total) : null } },
  { id: 'engSilence', libelle: 'Jours depuis son dernier message', theme: 'engagement', format: 'jours', agregat: 'moyenne', temporel: false, inverse: true, equipeSeule: true, mesure: (c, m) => { const e = eng(c, m); return e ? val(silence(e, c.jour)) : null } },
  { id: 'engFaible', libelle: 'Magasins au franchisé peu engagé', theme: 'engagement', format: 'nombre', agregat: 'somme', temporel: false, inverse: true, equipeSeule: true, aide: 'Au moins deux repères en retrait : communications lues ou tâches tenues sous 50 %, réunions suivies sous 50 %, aucun message depuis 60 jours.', mesure: (c, m) => { const e = eng(c, m); return e ? { n: peuEngage(e, c.jour) ? 1 : 0 } : null } },
]
// Déploiements (Joseph, 17/11/2026) : les thématiques sont réglées par le Directeur, donc indicateurs et axe se créent
// pour chacune (identifiants dep:<thématique>…). La page les fait connaître avant tout calcul.
let thematiques: Thematique[] = []
let cacheDeploiements: { indicateurs: Indicateur[]; axes: Axe[] } = { indicateurs: [], axes: [] }
export function connaitreThematiques(t: Thematique[]) {
  if (t === thematiques) return
  thematiques = t
  const etat = (c: Contexte, m: Magasin, th: Thematique) => (m.statut === 'avenir' ? null : c.reseau.deploiements.valeurs[m.nom]?.[th.id] || null)
  const ton = (c: Contexte, m: Magasin, th: Thematique) => { const e = etat(c, m, th); return e ? tonDe(th, e) : null }
  const compte = (t2: 'partiel' | 'negatif') => (th: Thematique): Indicateur['mesure'] => (c, m) => { const x = ton(c, m, th); return x ? { n: x === t2 ? 1 : 0 } : null }
  cacheDeploiements = {
    indicateurs: t.flatMap((th): Indicateur[] => [
      { id: `dep:${th.id}:pct`, libelle: `${th.libelle} : part déployée`, theme: 'deploiements', format: 'pct', agregat: 'ratio', temporel: false, equipeSeule: true, aide: 'Magasins où la thématique est au vert, sur les magasins renseignés.', mesure: (c, m) => { const x = ton(c, m, th); return x ? { n: x === 'positif' ? 1 : 0, d: 1 } : null } },
      { id: `dep:${th.id}:etat`, libelle: `${th.libelle} : état`, theme: 'deploiements', format: 'texte', agregat: 'texte', temporel: false, equipeSeule: true, mesure: (c, m) => { const e = etat(c, m, th); return e ? { texte: e } : null } },
      { id: `dep:${th.id}:encours`, libelle: `${th.libelle} : magasins en cours`, theme: 'deploiements', format: 'nombre', agregat: 'somme', temporel: false, equipeSeule: true, mesure: compte('partiel')(th) },
      { id: `dep:${th.id}:non`, libelle: `${th.libelle} : magasins pas démarrés`, theme: 'deploiements', format: 'nombre', agregat: 'somme', temporel: false, inverse: true, equipeSeule: true, mesure: compte('negatif')(th) },
    ]),
    axes: t.map((th): Axe => ({ id: `dep:${th.id}`, libelle: `Déploiement : ${th.libelle}`, equipeSeule: true, valeur: (c, m) => etat(c, m, th) ?? NON })),
  }
}
const tousIndicateurs = () => [...INDICATEURS, ...cacheDeploiements.indicateurs]
export const indicateur = (id: string) => tousIndicateurs().find((i) => i.id === id)
export const indicateursVisibles = (equipe: boolean) => tousIndicateurs().filter((i) => equipe || !i.equipeSeule)

// ── Axes de regroupement et de filtre ───────────────────────────────────
export type AxeId = `dep:${string}` | 'magasin' | 'rr' | 'coach' | 'groupe' | 'typologie' | 'zone' | 'licence' | 'contrat' | 'anciennete' | 'departement' | 'statut' | 'caseNineBox' | 'engagement' | 'reseau'
export interface Axe { id: AxeId; libelle: string; equipeSeule?: boolean; valeur: (c: Contexte, m: Magasin) => string }
const NON = 'Non renseigné'
function anciennete(m: Magasin, jour: string): string {
  if (m.statut === 'avenir' || m.statut === 'preouverture' || !m.ouverture) return 'Pas encore ouvert'
  const ans = (Date.parse(jour) - Date.parse(m.ouverture)) / (365.25 * 864e5)
  return ans < 1 ? 'Moins d’un an' : ans < 3 ? 'De 1 à 3 ans' : ans < 5 ? 'De 3 à 5 ans' : 'Plus de 5 ans'
}
export const AXES: Axe[] = [
  { id: 'magasin', libelle: 'Magasin', valeur: (_c, m) => m.nom },
  { id: 'reseau', libelle: 'Toute la sélection', valeur: () => 'Ensemble' },
  { id: 'rr', libelle: 'Responsable Régional', equipeSeule: true, valeur: (_c, m) => m.rr?.nom || 'Sans Responsable Régional' },
  { id: 'coach', libelle: 'Coach', equipeSeule: true, valeur: (_c, m) => m.coach || 'Sans Coach' },
  { id: 'groupe', libelle: 'Groupe budgétaire', equipeSeule: true, valeur: (c, m) => c.finances?.get(m.nom)?.groupe || 'Sans groupe' },
  { id: 'typologie', libelle: 'Typologie', valeur: (_c, m) => (m.exploitation?.typologie ? libellesTypologie[m.exploitation.typologie] : NON) },
  { id: 'zone', libelle: 'Zone de chalandise', valeur: (_c, m) => (m.exploitation?.zoneChalandise ? libellesZone[m.exploitation.zoneChalandise] : NON) },
  { id: 'licence', libelle: 'Licence', valeur: (_c, m) => (m.exploitation?.licence ? libellesLicence[m.exploitation.licence] : NON) },
  { id: 'contrat', libelle: 'Franchisé ou intégré', valeur: (_c, m) => (m.franchise ? 'Franchisé' : 'Intégré') },
  { id: 'anciennete', libelle: 'Ancienneté', valeur: (c, m) => anciennete(m, c.jour) },
  { id: 'departement', libelle: 'Département', valeur: (_c, m) => m.departement || NON },
  { id: 'statut', libelle: 'Statut du budget', equipeSeule: true, valeur: (c, m) => c.finances?.get(m.nom)?.statut || 'Sans budget' },
  { id: 'caseNineBox', libelle: 'Case de la nine box', equipeSeule: true, valeur: (c, m) => caseDe(c.reseau.evaluations[m.nom], c.reseau.grilleNineBox)?.libelle ?? 'Non classé' },
  { id: 'engagement', libelle: 'Engagement du franchisé', equipeSeule: true, valeur: (c, m) => { const e = eng(c, m); return !e ? 'Non mesuré' : peuEngage(e, c.jour) ? 'Peu engagé' : 'Engagé' } },
]
const tousAxes = () => [...AXES, ...cacheDeploiements.axes]
export const axe = (id: string) => tousAxes().find((a) => a.id === id)
export const axesVisibles = (equipe: boolean) => tousAxes().filter((a) => equipe || !a.equipeSeule)

// ── Définition d'un rapport (enregistrée telle quelle) ──────────────────
export type Affichage = 'tableau' | 'graphes' | 'deux'
// Type de graphe choisi dans le rendu (Joseph, 18/11/2026) ; « auto » = colonnes dans le temps, barres sinon
// 382 / 383 (Joseph, 24/11/2026) : le type se choisit graphe par graphe ; « topflop » = les 5 meilleurs et les 5 moins bons
export type TypeGraphe = 'auto' | 'barres' | 'colonnes' | 'courbe' | 'camembert' | 'topflop'
export const TYPES_GRAPHE: { cle: TypeGraphe; libelle: string }[] = [
  { cle: 'auto', libelle: 'Automatique' },
  { cle: 'barres', libelle: 'Barres' },
  { cle: 'colonnes', libelle: 'Bâtons' },
  { cle: 'courbe', libelle: 'Courbe' },
  { cle: 'camembert', libelle: 'Camembert' },
  { cle: 'topflop', libelle: 'Top / Flop' },
]
// 381 (Joseph, 24/11/2026) : comparer chaque chiffre à l'an dernier ou au budget, en un bouton
export type Comparaison = 'aucune' | 'n1' | 'budget'
export const COMPARAISONS: { cle: Comparaison; libelle: string; court: string }[] = [
  { cle: 'aucune', libelle: 'Rien', court: '' },
  { cle: 'n1', libelle: 'An dernier', court: 'l’an dernier' },
  { cle: 'budget', libelle: 'Budget', court: 'le budget' },
]
export interface Definition {
  lignes: AxeId
  indicateurs: string[]
  filtres: Partial<Record<AxeId, string[]>>
  periode: Periode
  colonnes: Decoupage
  affichage: Affichage
  graphe?: TypeGraphe
  graphes?: Record<string, TypeGraphe> // type choisi pour un indicateur (382), sinon graphe
  comparer?: Comparaison
  tri?: { cle: string; sens: 'asc' | 'desc' } | null
}
export const definitionVide = (): Definition => ({ lignes: 'magasin', indicateurs: ['ca', 'evolution'], filtres: {}, periode: { type: 'cumul' }, colonnes: 'aucun', affichage: 'deux', graphe: 'auto', tri: null })

// Lecture tolérante d'une définition venue de la base (ou d'une adresse) ; retire ce que le compte ne voit pas
export function normaliserDefinition(v: unknown, equipe: boolean): Definition {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
  const base = definitionVide()
  const axes = axesVisibles(equipe).map((a) => a.id)
  const lignes = axes.includes(o.lignes as AxeId) ? o.lignes as AxeId : base.lignes
  const ids = new Set(indicateursVisibles(equipe).map((i) => i.id))
  const indicateurs = Array.isArray(o.indicateurs) ? [...new Set(o.indicateurs.filter((x): x is string => typeof x === 'string' && ids.has(x)))].slice(0, 12) : base.indicateurs
  const f = o.filtres && typeof o.filtres === 'object' && !Array.isArray(o.filtres) ? o.filtres as Record<string, unknown> : {}
  const filtres: Definition['filtres'] = {}
  for (const [k, l] of Object.entries(f)) if (axes.includes(k as AxeId) && k !== 'reseau' && Array.isArray(l)) { const x = l.filter((s): s is string => typeof s === 'string').slice(0, 300); if (x.length) filtres[k as AxeId] = x }
  const p = o.periode && typeof o.periode === 'object' ? o.periode as Record<string, unknown> : {}
  const periode: Periode = { type: TYPES_PERIODE.some((t) => t.cle === p.type) ? p.type as TypePeriode : base.periode.type, ...(typeof p.mois === 'string' && /^\d{4}-\d{2}$/.test(p.mois) ? { mois: p.mois } : {}) }
  const colonnes = DECOUPAGES.some((d) => d.cle === o.colonnes) ? o.colonnes as Decoupage : 'aucun'
  const affichage = (['tableau', 'graphes', 'deux'] as const).includes(o.affichage as Affichage) ? o.affichage as Affichage : 'deux'
  const graphe = TYPES_GRAPHE.some((g) => g.cle === o.graphe) ? o.graphe as TypeGraphe : 'auto'
  const t = o.tri && typeof o.tri === 'object' ? o.tri as Record<string, unknown> : null
  const tri = t && typeof t.cle === 'string' && (t.sens === 'asc' || t.sens === 'desc') ? { cle: t.cle, sens: t.sens } as const : null
  const g = o.graphes && typeof o.graphes === 'object' && !Array.isArray(o.graphes) ? o.graphes as Record<string, unknown> : {}
  const graphes: Record<string, TypeGraphe> = {}
  for (const [k, x] of Object.entries(g)) if (ids.has(k) && TYPES_GRAPHE.some((y) => y.cle === x)) graphes[k] = x as TypeGraphe
  const comparer = COMPARAISONS.some((x) => x.cle === o.comparer) ? o.comparer as Comparaison : undefined
  return { lignes, indicateurs: indicateurs.length ? indicateurs : base.indicateurs, filtres, periode, colonnes, affichage, graphe, tri,
    ...(Object.keys(graphes).length ? { graphes } : {}), ...(comparer && comparer !== 'aucune' ? { comparer } : {}) }
}

// ── Calcul ──────────────────────────────────────────────────────────────
export interface Cellule { valeur: number | null; texte: string | null }
export interface LigneRapport {
  cle: string; libelle: string; magasins: string[]; cellules: Record<string, Cellule> // clé de cellule : `${indicateur}|${colonne}`
  refs?: Record<string, Cellule> // 381 : même clé, chiffre de référence (an dernier ou budget) quand il a un sens
}
export interface Resultat {
  mois: string[]
  colonnes: { cle: string; libelle: string; mois: string[] }[]
  indicateurs: Indicateur[]
  lignes: LigneRapport[]
  total: LigneRapport
  magasins: number
}

function agreger(ind: Indicateur, mesures: (Mesure | null)[]): Cellule {
  const l = mesures.filter((x): x is Mesure => x !== null)
  if (!l.length) return { valeur: null, texte: null }
  if (ind.agregat === 'texte') {
    const comptes = new Map<string, number>()
    for (const x of l) if ('texte' in x) comptes.set(x.texte, (comptes.get(x.texte) ?? 0) + 1)
    const tri = [...comptes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
    if (!tri.length) return { valeur: null, texte: null }
    return { valeur: null, texte: l.length === 1 || tri.length === 1 ? tri[0][0] : `${tri[0][0]} (${tri[0][1]} sur ${l.length})` }
  }
  const nums = l.filter((x): x is { n: number; d?: number } => 'n' in x)
  if (!nums.length) return { valeur: null, texte: null }
  if (ind.agregat === 'ratio') {
    const n = nums.reduce((s, x) => s + x.n, 0), d = nums.reduce((s, x) => s + (x.d ?? 0), 0)
    if (!d) return { valeur: null, texte: null }
    return { valeur: ind.moins1 ? n / d - 1 : n / d, texte: null }
  }
  const s = nums.reduce((a, x) => a + x.n, 0)
  return { valeur: ind.agregat === 'moyenne' ? s / nums.length : s, texte: null }
}

// Magasins retenus : ouverts ou en pré-ouverture (les projets « à venir » n'ont pas de chiffres), puis les filtres
export function magasinsRetenus(c: Contexte, d: Definition): Magasin[] {
  const filtres = Object.entries(d.filtres).filter(([, l]) => l && l.length) as [AxeId, string[]][]
  return c.reseau.magasins.filter((m) => m.statut !== 'avenir').filter((m) => filtres.every(([a, l]) => { const x = axe(a); return !x || (x.equipeSeule && !c.equipe) || l.includes(x.valeur(c, m)) }))
}

export function calculer(c: Contexte, d: Definition): Resultat {
  const mois = moisDeLaPeriode(d.periode, c.jour)
  const indicateurs = d.indicateurs.map(indicateur).filter((i): i is Indicateur => !!i && (c.equipe || !i.equipeSeule))
  const colonnes = colonnesTemps(mois, d.colonnes)
  const magasins = magasinsRetenus(c, d)
  const a = axe(d.lignes) && (c.equipe || !axe(d.lignes)!.equipeSeule) ? axe(d.lignes)! : AXES[0]
  // Mesures par magasin, calculées une fois
  const mesures = new Map<string, Map<string, Mesure | null>>()
  for (const m of magasins) {
    const parCle = new Map<string, Mesure | null>()
    for (const i of indicateurs) for (const col of colonnes) parCle.set(`${i.id}|${col.cle}`, i.temporel || col.cle === colonnes[0].cle || d.colonnes === 'aucun' ? i.mesure(c, m, i.temporel ? col.mois : mois) : null)
    mesures.set(m.nom, parCle)
  }
  // Références (381) : mêmes mois l'an dernier, ou budget des mois réalisés
  const comp = d.comparer && d.comparer !== 'aucune' ? d.comparer : null
  const refs = new Map<string, Map<string, Mesure | null>>()
  if (comp) for (const m of magasins) {
    const parCle = new Map<string, Mesure | null>()
    for (const i of indicateurs) if (comparable(i, comp)) for (const col of colonnes) parCle.set(`${i.id}|${col.cle}`, mesureReference(c, m, i, comp, i.temporel ? col.mois : mois))
    refs.set(m.nom, parCle)
  }
  const ligne = (cle: string, libelle: string, liste: Magasin[]): LigneRapport => {
    const cellules: Record<string, Cellule> = {}
    const r: Record<string, Cellule> = {}
    for (const i of indicateurs) for (const col of colonnes) {
      const k = `${i.id}|${col.cle}`
      cellules[k] = !i.temporel && d.colonnes !== 'aucun' && col.cle !== colonnes[0].cle ? { valeur: null, texte: null } : agreger(i, liste.map((m) => mesures.get(m.nom)!.get(k) ?? null))
      if (comp && comparable(i, comp)) r[k] = agreger(i, liste.map((m) => refs.get(m.nom)!.get(k) ?? null))
    }
    return { cle, libelle, magasins: liste.map((m) => m.nom), cellules, ...(comp ? { refs: r } : {}) }
  }
  const groupes = new Map<string, Magasin[]>()
  for (const m of magasins) { const v = a.valeur(c, m); groupes.set(v, [...(groupes.get(v) ?? []), m]) }
  let lignes = [...groupes].map(([v, l]) => ligne(v, v, l))
  // Tri : colonne demandée, sinon le premier indicateur chiffré (du plus haut au plus bas), sinon le libellé
  const premier = indicateurs.find((i) => i.agregat !== 'texte')
  const tri = d.tri ?? (premier ? { cle: `${premier.id}|${colonnes.at(-1)!.cle}`, sens: 'desc' as const } : { cle: 'libelle', sens: 'asc' as const })
  const cleTri = tri.cle === 'libelle' || lignes.some((l) => tri.cle in l.cellules) ? tri.cle : 'libelle'
  lignes = lignes.sort((x, y) => {
    if (cleTri === 'libelle') return (tri.sens === 'asc' ? 1 : -1) * x.libelle.localeCompare(y.libelle, 'fr', { numeric: true })
    const vx = x.cellules[cleTri]?.valeur ?? x.cellules[cleTri]?.texte ?? null, vy = y.cellules[cleTri]?.valeur ?? y.cellules[cleTri]?.texte ?? null
    if (vx === null && vy === null) return x.libelle.localeCompare(y.libelle, 'fr')
    if (vx === null) return 1
    if (vy === null) return -1
    const r = typeof vx === 'number' && typeof vy === 'number' ? vx - vy : String(vx).localeCompare(String(vy), 'fr')
    return (tri.sens === 'asc' ? r : -r) || x.libelle.localeCompare(y.libelle, 'fr')
  })
  return { mois, colonnes, indicateurs, lignes, total: ligne('total', 'Ensemble de la sélection', magasins), magasins: magasins.length }
}

// ── Comparaison (381) ───────────────────────────────────────────────────
// An dernier : tout indicateur chiffré qui suit la période et n'est pas déjà une évolution ni un chiffre du budget.
// Budget : le CA HT seul (le budget n'a pas d'autre chiffre mensuel), sur les mois où le magasin a un CA en caisse.
export function comparable(i: Indicateur, comp: Comparaison): boolean {
  if (comp === 'budget') return i.id === 'ca'
  if (comp === 'n1') return i.temporel && i.agregat !== 'texte' && i.format !== 'ecart' && i.theme !== 'budget' && i.id !== 'caN1'
  return false
}
function mesureReference(c: Contexte, m: Magasin, i: Indicateur, comp: Comparaison, mois: string[]): Mesure | null {
  if (comp === 'n1') return i.mesure(c, m, n1(mois))
  const f = fin(c, m)
  if (!f?.caBudget) return null
  const l = mois.filter((x) => Number(x.slice(0, 4)) === f.annee && caDe(chiffre(c.reseau, m.nom, x)) !== null).map((x) => Number(x.slice(5, 7)) - 1)
  return l.length ? { n: l.reduce((s, k) => s + (f.caBudget![k] ?? 0), 0) } : null
}
// Écart à la référence : en points pour un pourcentage, en % sinon ; null sans référence utilisable
export function ecartReference(i: Indicateur, v: Cellule, ref: Cellule | undefined): number | null {
  if (!ref || v.valeur === null || ref.valeur === null) return null
  if (i.format === 'pct') return v.valeur - ref.valeur
  return ref.valeur === 0 ? null : v.valeur / ref.valeur - 1
}
export function formaterEcart(i: Indicateur, e: number): string {
  const s = e > 0 ? '+' : e < 0 ? '−' : ''
  return i.format === 'pct' ? `${s}${un.format(Math.abs(e) * 100)} pt` : `${s}${un.format(Math.abs(e) * 100)} %`
}
export const ecartFavorable = (i: Indicateur, e: number) => e !== 0 && (e > 0) !== !!i.inverse

// ── Tendance (378) : total de la sélection mois par mois, sur les 12 mois qui finissent au mois de la période ─
export function tendance(c: Contexte, d: Definition, i: Indicateur, magasins = magasinsRetenus(c, d), n = 12): (number | null)[] {
  if (!i.temporel || i.agregat === 'texte') return []
  const fin_ = moisDeLaPeriode(d.periode, c.jour).at(-1)!
  return Array.from({ length: n }, (_, k) => agreger(i, magasins.map((m) => i.mesure(c, m, [decalerMois(fin_, k - n + 1)]))).valeur)
}

// Aperçu d'un rapport (377) : son premier indicateur chiffré, total de la sélection sur sa période, et sa tendance
export function apercuRapport(c: Contexte, d: Definition): { libelle: string; valeur: string; serie: (number | null)[]; ton: 'bon' | 'mauvais' | null } | null {
  const i = d.indicateurs.map(indicateur).find((x): x is Indicateur => !!x && x.agregat !== 'texte' && (c.equipe || !x.equipeSeule))
  if (!i) return null
  const magasins = magasinsRetenus(c, d)
  if (!magasins.length) return null
  const mois = moisDeLaPeriode(d.periode, c.jour)
  const v = agreger(i, magasins.map((m) => i.mesure(c, m, mois)))
  return { libelle: i.libelle, valeur: formater(i.format, v), serie: tendance(c, d, i, magasins), ton: tonCellule(i, v) }
}

// Valeurs proposées pour filtrer un axe, dans l'ordre alphabétique
export function valeursAxe(c: Contexte, a: AxeId): string[] {
  const x = axe(a)
  if (!x) return []
  return [...new Set(c.reseau.magasins.filter((m) => m.statut !== 'avenir').map((m) => x.valeur(c, m)))].sort((p, q) => p.localeCompare(q, 'fr', { numeric: true }))
}

// ── Mise en forme ───────────────────────────────────────────────────────
const nf = (min: number, max: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: max })
const entier = nf(0, 0), un = nf(1, 1), deux = nf(2, 2)
const signe = (n: number, s: string) => (n < 0 ? `−${s}` : s)
export function formater(f: Format, c: Cellule): string {
  if (c.texte !== null) return c.texte
  const v = c.valeur
  if (v === null || !Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  switch (f) {
    case 'euros': return signe(v, `${entier.format(a)} €`)
    case 'euros2': return signe(v, `${deux.format(a)} €`)
    case 'pct': return signe(v, `${un.format(a * 100)} %`)
    case 'ecart': return `${v > 0 ? '+' : v < 0 ? '−' : ''}${un.format(a * 100)} %`
    case 'nombre': return signe(v, entier.format(a))
    case 'jours': return `${entier.format(a)} j`
    case 'note': return un.format(v)
    case 'mois': return `${un.format(v)} mois`
    case 'texte': return '—'
  }
}
// Ton d'une cellule : écart (négatif = défavorable, sauf indicateur inversé), sinon neutre
export function tonCellule(i: Indicateur, c: Cellule): 'bon' | 'mauvais' | null {
  if (c.valeur === null || i.format !== 'ecart' || c.valeur === 0) return null
  return (c.valeur > 0) !== !!i.inverse ? 'bon' : 'mauvais'
}

// Rapports proposés par le siège, toujours présents (le Directeur peut en publier d'autres)
// pour : rapports de départ d'un public (Joseph, 17/11/2026) ; sans pour, rapport général proposé à tous
export type Public = 'rr' | 'coach' | 'franchise'
export interface RapportPropose { id: string; titre: string; definition: Definition; equipeSeule?: boolean; pour?: Public[] }
export const PUBLICS: { cle: Public; libelle: string }[] = [
  { cle: 'rr', libelle: 'Pour les Responsables Régionaux' }, { cle: 'coach', libelle: 'Pour les Coachs' }, { cle: 'franchise', libelle: 'Pour les franchisés' },
]
// Rapports proposés au compte : le Directeur voit tout, les autres les rapports généraux et ceux de leur public
export const rapportsProposes = (role: string | undefined) => RAPPORTS_PROPOSES.filter((r) => {
  if (role === 'directeur') return true
  if (role === 'franchise') return !r.equipeSeule && (!r.pour || r.pour.includes('franchise'))
  return !r.pour || r.pour.includes(role as Public)
})
export const RAPPORTS_PROPOSES: RapportPropose[] = [
  { id: 'budget', titre: 'Budget contre réel par magasin', definition: { ...definitionVide(), indicateurs: ['ca', 'caBudget', 'ecartBudget', 'statutBudget'], periode: { type: 'cumul' } } },
  { id: 'n1', titre: 'Ventes sur l’an dernier', definition: { ...definitionVide(), indicateurs: ['ca', 'evolution', 'evolTicketsCave', 'evolTicketsBar'], periode: { type: 'cumul' } } },
  { id: 'paniers', titre: 'Paniers et tickets Cave et Bar', definition: { ...definitionVide(), indicateurs: ['panierCave', 'ticketsCave', 'panierBar', 'ticketsBar'], periode: { type: 'mois' } } },
  { id: 'mois', titre: 'Le CA mois par mois', definition: { ...definitionVide(), lignes: 'magasin', indicateurs: ['ca'], periode: { type: 'douze' }, colonnes: 'mois', affichage: 'tableau' } },
  { id: 'resultat', titre: 'Résultat et frais de personnel', definition: { ...definitionVide(), indicateurs: ['ebe', 'ebeCA', 'pctFP', 'caHeure'], periode: { type: 'cumul' } } },
  { id: 'typologie', titre: 'Les typologies face à l’an dernier', definition: { ...definitionVide(), lignes: 'typologie', indicateurs: ['ca', 'evolution', 'panierCave', 'panierBar', 'marge'], periode: { type: 'cumul' } } },
  { id: 'exterieur', titre: 'Marché extérieur', definition: { ...definitionVide(), indicateurs: ['caExt', 'extCibles', 'extPriorites', 'extContrats', 'extCAContrats'], periode: { type: 'cumul' } } },
  // Pour démarrer, par public (modifiables : « Enregistrer comme un nouveau rapport » en garde une copie à soi)
  { id: 'rr-region', titre: 'Ma région : ventes, budget et an dernier', equipeSeule: true, pour: ['rr'], definition: { ...definitionVide(), indicateurs: ['ca', 'evolution', 'ecartBudget', 'statutBudget', 'tachesRetard'], periode: { type: 'cumul' }, tri: { cle: 'ecartBudget', sens: 'asc' } } },
  { id: 'rr-coachs', titre: 'Mes Coachs : visites et tâches du mois', equipeSeule: true, pour: ['rr'], definition: { ...definitionVide(), lignes: 'coach', indicateurs: ['visites', 'joursSansVisite', 'tachesRetard', 'tachesTenues'], periode: { type: 'mois' } } },
  { id: 'coach-priorites', titre: 'Mes magasins : qui voir en priorité', equipeSeule: true, pour: ['coach'], definition: { ...definitionVide(), indicateurs: ['joursSansVisite', 'tachesRetard', 'tachesProches', 'evolution', 'ecartBudget'], periode: { type: 'cumul' }, affichage: 'tableau', tri: { cle: 'joursSansVisite', sens: 'desc' } } },
  { id: 'coach-clients', titre: 'Paniers et tickets de mes magasins', equipeSeule: true, pour: ['coach'], definition: { ...definitionVide(), indicateurs: ['panierCave', 'evolTicketsCave', 'panierBar', 'evolTicketsBar'], periode: { type: 'mois' } } },
  { id: 'coach-taches', titre: 'Tâches et priorités de mes magasins', equipeSeule: true, pour: ['coach'], definition: { ...definitionVide(), indicateurs: ['tachesOuvertes', 'tachesRetard', 'tachesBloquees', 'tachesTenues', 'prioritesActives', 'prioritesAtteintes'], periode: { type: 'cumul' } } },
  { id: 'franchises-engagement', titre: 'Franchisés à remobiliser', equipeSeule: true, pour: ['rr', 'coach'], definition: { ...definitionVide(), indicateurs: ['engTaches', 'engReunions', 'engCommunications', 'engSilence', 'tachesRetard'], periode: { type: 'cumul' }, affichage: 'tableau', tri: { cle: 'engTaches', sens: 'asc' } } },
  { id: 'fr-mois', titre: 'Mon CA mois par mois face à l’an dernier', pour: ['franchise'], definition: { ...definitionVide(), indicateurs: ['ca', 'caN1', 'evolution'], periode: { type: 'douze' }, colonnes: 'mois' } },
  { id: 'fr-budget', titre: 'Mon budget : où j’en suis', pour: ['franchise'], definition: { ...definitionVide(), indicateurs: ['ca', 'caBudget', 'ecartBudget', 'ebe', 'pctFP'], periode: { type: 'cumul' } } },
  { id: 'fr-clients', titre: 'Mes clients Cave et Bar', pour: ['franchise'], definition: { ...definitionVide(), indicateurs: ['ticketsCave', 'evolTicketsCave', 'panierCave', 'ticketsBar', 'evolTicketsBar', 'panierBar'], periode: { type: 'mois' } } },
  { id: 'fr-taches', titre: 'Mes tâches et priorités', pour: ['franchise'], definition: { ...definitionVide(), indicateurs: ['tachesOuvertes', 'tachesRetard', 'tachesProches', 'prioritesActives', 'prioritesAtteintes'], periode: { type: 'cumul' } } },
  { id: 'animation', titre: 'Animation du mois', equipeSeule: true, definition: { ...definitionVide(), lignes: 'coach', indicateurs: ['visites', 'joursSansVisite', 'tachesRetard'], periode: { type: 'mois' } } },
  { id: 'deploiements', titre: 'Déploiements par Responsable Régional', equipeSeule: true, definition: { ...definitionVide(), lignes: 'rr', indicateurs: ['deploiements', 'ca', 'evolution'], periode: { type: 'cumul' } } },
  { id: 'ninebox', titre: 'Nine box et résultats', equipeSeule: true, definition: { ...definitionVide(), lignes: 'caseNineBox', indicateurs: ['ca', 'evolution', 'ecartBudget', 'deploiements'], periode: { type: 'cumul' } } },
]
