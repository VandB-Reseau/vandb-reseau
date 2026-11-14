// Objectifs chiffrés d'un magasin (refonte vague 3, Joseph 09/11/2026, 26A) : un indicateur de la caisse, une cible,
// une échéance ; des tâches rattachées. L'avancement se lit dans les chiffres du mois, sans saisie.
// Rangés dans suivi_magasins, rubrique « objectifs » (migration 0042), une liste par magasin. Jamais renvoyés au franchisé.
import { chiffresDuMagasin, decalerMois, formatPourcent, formatValeur, libelleMois, type ChampChiffre, type ChiffreMois } from './chiffres'
import type { Reseau } from './modele'

export type IndicateurObjectif = 'pmCave' | 'fluxCave' | 'caCave' | 'pmBar' | 'fluxBar' | 'caBar' | 'caExt' | 'marge'
// valeur : le chiffre du mois atteint la cible ; evolution : l'écart avec le même mois un an plus tôt (sans effet de saison)
export type ModeObjectif = 'valeur' | 'evolution'

export interface Objectif {
  id: string
  indicateur: IndicateurObjectif
  mode: ModeObjectif
  depart: number | null // valeur (ou évolution, en %) du mois de départ
  moisDepart: string // AAAA-MM, dernier mois connu quand l'objectif est fixé
  cible: number
  echeance: string // AAAA-MM
  taches: string[] // clés des tâches rattachées (cleAction ou cleLibre)
  par: string
  creeLe: string // AAAA-MM-JJ
  visite?: number | null // visite où il a été fixé
  clos?: string // AAAA-MM-JJ : retiré du suivi (atteint ou abandonné)
}

export const INDICATEURS: { id: IndicateurObjectif; libelle: string; court: string }[] = [
  { id: 'pmCave', libelle: 'Panier moyen HT Cave', court: 'Panier Cave' },
  { id: 'fluxCave', libelle: 'Tickets Cave', court: 'Tickets Cave' },
  { id: 'caCave', libelle: 'CA Cave', court: 'CA Cave' },
  { id: 'pmBar', libelle: 'Panier moyen HT Bar', court: 'Panier Bar' },
  { id: 'fluxBar', libelle: 'Tickets Bar', court: 'Tickets Bar' },
  { id: 'caBar', libelle: 'CA Bar', court: 'CA Bar' },
  { id: 'caExt', libelle: 'CA Extérieur', court: 'CA Extérieur' },
  { id: 'marge', libelle: 'Taux de marge', court: 'Marge' },
]
export const libelleIndicateur = (i: IndicateurObjectif) => INDICATEURS.find((x) => x.id === i)?.libelle ?? i

const nombre = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const texte = (v: unknown) => (typeof v === 'string' ? v : '')
const mois = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v) ? v : '')

export function normaliserObjectifs(v: unknown): Record<string, Objectif[]> {
  const r: Record<string, Objectif[]> = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return r
  for (const [m, liste] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(liste)) continue
    const l = liste.flatMap((o): Objectif[] => {
      if (!o || typeof o !== 'object') return []
      const x = o as Record<string, unknown>
      const indicateur = INDICATEURS.find((i) => i.id === x.indicateur)?.id
      const cible = nombre(x.cible)
      if (!indicateur || cible === null || !mois(x.echeance) || !texte(x.id)) return []
      return [{
        id: texte(x.id), indicateur, mode: x.mode === 'evolution' ? 'evolution' : 'valeur', depart: nombre(x.depart), moisDepart: mois(x.moisDepart),
        cible, echeance: mois(x.echeance), taches: Array.isArray(x.taches) ? x.taches.filter((t): t is string => typeof t === 'string') : [],
        par: texte(x.par), creeLe: texte(x.creeLe), visite: nombre(x.visite), ...(texte(x.clos) ? { clos: texte(x.clos) } : {}),
      }]
    })
    if (l.length) r[m] = l
  }
  return r
}

// Valeur d'un indicateur pour un mois : le chiffre lui-même, ou son évolution face au même mois un an plus tôt
export function valeurAu(liste: ChiffreMois[], i: IndicateurObjectif, mode: ModeObjectif, m: string): number | null {
  const du = (x: string) => liste.find((c) => c.mois === x)?.[i as ChampChiffre] ?? null
  const v = du(m)
  if (mode === 'valeur' || v === null) return v
  const avant = du(decalerMois(m, -12))
  return avant ? ((v - avant) / avant) * 100 : null
}
export const formatIndicateur = (i: IndicateurObjectif, mode: ModeObjectif, n: number | null) => (mode === 'evolution' ? formatPourcent(n) : formatValeur(i as ChampChiffre, n))

export type StatutObjectif = 'atteint' | 'voie' | 'retard' | 'manque' | 'attente'
export const libelleStatut: Record<StatutObjectif, string> = { atteint: 'Atteint', voie: 'Sur la bonne voie', retard: 'En retard', manque: 'Manqué', attente: 'En attente des chiffres' }

export interface Avancement { actuel: number | null; mois: string | null; progression: number | null; statut: StatutObjectif }

const ecartMois = (a: string, b: string) => (Number(b.slice(0, 4)) * 12 + Number(b.slice(5, 7))) - (Number(a.slice(0, 4)) * 12 + Number(a.slice(5, 7)))

// Avancement : part du chemin faite entre le départ et la cible, comparée à la part du temps écoulé.
// En retard quand le chemin fait a plus de 20 points de retard sur le temps écoulé.
export function avancement(reseau: Reseau, magasin: string, o: Objectif): Avancement {
  const liste = chiffresDuMagasin(reseau, magasin)
  const connus = liste.filter((c) => c.mois > o.moisDepart && c.mois <= o.echeance && valeurAu(liste, o.indicateur, o.mode, c.mois) !== null).map((c) => c.mois).sort()
  const dernier = connus.at(-1) ?? null
  const actuel = dernier ? valeurAu(liste, o.indicateur, o.mode, dernier) : null
  const echu = reseau.jour.slice(0, 7) > o.echeance
  if (actuel === null || o.depart === null) return { actuel, mois: dernier, progression: null, statut: echu && actuel === null ? 'manque' : 'attente' }
  const chemin = o.cible - o.depart
  const progression = chemin === 0 ? (actuel >= o.cible ? 1 : 0) : (actuel - o.depart) / chemin
  if (progression >= 1) return { actuel, mois: dernier, progression, statut: 'atteint' }
  if (echu) return { actuel, mois: dernier, progression, statut: 'manque' }
  const total = Math.max(1, ecartMois(o.moisDepart, o.echeance))
  const ecoule = Math.min(1, ecartMois(o.moisDepart, dernier!) / total)
  return { actuel, mois: dernier, progression, statut: progression >= ecoule - 0.2 ? 'voie' : 'retard' }
}

export const objectifsDu = (reseau: Reseau, magasin: string) => (reseau.objectifs?.[magasin] ?? []).filter((o) => !o.clos)

// Phrase d'un objectif : « Panier moyen HT Cave : 23,53 € → 26,00 € d'ici janvier 2027 »
export function phraseObjectif(o: Objectif): string {
  const lib = libelleIndicateur(o.indicateur)
  return o.mode === 'evolution'
    ? `${lib} : ${formatPourcent(o.cible)} vs N-1 d’ici ${libelleMois(o.echeance)}`
    : `${lib} : ${formatIndicateur(o.indicateur, o.mode, o.depart)} → ${formatIndicateur(o.indicateur, o.mode, o.cible)} d’ici ${libelleMois(o.echeance)}`
}

// Joseph (14/11/2026) : un objectif est un objectif de l'année (ou d'un semestre) ; sa période se lit dans son échéance
export const anneeObjectif = (o: Objectif) => Number(o.echeance.slice(0, 4))
export function periodeObjectif(o: Objectif): string {
  const [a, m] = o.echeance.split('-')
  if (m === '12') return `Année ${a}`
  if (m === '06') return `1er semestre ${a}`
  return `D’ici ${libelleMois(o.echeance)}`
}
// Valeur et cible sans l'échéance, pour le titre d'un objectif dont la période est déjà dite
export function cibleObjectif(o: Objectif): string {
  const lib = libelleIndicateur(o.indicateur)
  return o.mode === 'evolution'
    ? `${lib} : ${formatPourcent(o.cible)} vs N-1`
    : `${lib} : ${formatIndicateur(o.indicateur, o.mode, o.depart)} → ${formatIndicateur(o.indicateur, o.mode, o.cible)}`
}

// Compte des objectifs en cours d'un ensemble de magasins (Performance, rapport du mois)
export function resumeObjectifs(reseau: Reseau, noms: string[]): { total: number; parStatut: Record<StatutObjectif, number> } {
  const parStatut: Record<StatutObjectif, number> = { atteint: 0, voie: 0, retard: 0, manque: 0, attente: 0 }
  let total = 0
  for (const n of noms) for (const o of objectifsDu(reseau, n)) { total++; parStatut[avancement(reseau, n, o).statut]++ }
  return { total, parStatut }
}
