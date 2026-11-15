// Plan d'action d'un magasin (refonte vague 4, Joseph 10/11/2026, 31A) : 3 priorités au plus, chacune avec un objectif
// chiffré (26A) et ses tâches (champ « priorite » de la tâche). Revu à chaque visite. Rangé dans suivi_magasins, rubrique
// « plan » (migration 0043). Le franchisé voit les titres et les statuts (plans_franchise()), jamais l'objectif chiffré.
import type { ActionSuivie } from './actions'
import { libelleMois, type ChiffreMois } from './chiffres'
import type { Reseau } from './modele'

// Joseph (14/11/2026) : 3 priorités au plus par objectif (et 3 sans objectif)
export const PRIORITES_MAX = 3
export type StatutPriorite = 'active' | 'atteinte' | 'abandonnee'
export interface Priorite {
  id: string
  titre: string
  objectif: string // id d'un objectif chiffré du magasin, ou vide
  statut: StatutPriorite
  bilan: string // une ligne, à la clôture
  creeLe: string // AAAA-MM-JJ
  par: string
  closLe: string // AAAA-MM-JJ
  revueLe: string // AAAA-MM-JJ : dernière revue (en visite)
  mesure?: MesurePriorite // 184 : le gain attendu d'une simulation, comparé chaque mois à la caisse
}

// 184 · Du simulateur à la priorité (Joseph, 15/11/2026) : une priorité née d'un simulateur garde ce qu'on en attend
// sur un indicateur de la caisse, par mois. Le constaté est l'écart moyen face au même mois de l'an passé, sur les mois
// clos depuis le départ (le mois qui suit la création). Montré au franchisé comme à l'équipe (0047).
export type IndicateurMesure = 'ca' | 'caCave' | 'caBar' | 'caExt' | 'fluxCave' | 'fluxBar' | 'pmCave' | 'pmBar' | 'marge'
export interface MesurePriorite { indicateur: IndicateurMesure; attendu: number; depuis: string /* AAAA-MM */; source: string }
// libelle : dans une liste ; sur : dans une phrase (« … par mois sur le panier moyen HT de la Cave »)
export const indicateursMesure: Record<IndicateurMesure, { libelle: string; sur: string; unite: '€' | 'tickets' | 'pts' }> = {
  ca: { libelle: 'CA HT du magasin', sur: 'le CA HT du magasin', unite: '€' },
  caCave: { libelle: 'CA HT de la Cave', sur: 'le CA HT de la Cave', unite: '€' },
  caBar: { libelle: 'CA HT du Bar', sur: 'le CA HT du Bar', unite: '€' },
  caExt: { libelle: 'CA HT de l’Extérieur', sur: 'le CA HT de l’Extérieur', unite: '€' },
  fluxCave: { libelle: 'Tickets de la Cave', sur: 'les tickets de la Cave', unite: 'tickets' },
  fluxBar: { libelle: 'Tickets du Bar', sur: 'les tickets du Bar', unite: 'tickets' },
  pmCave: { libelle: 'Panier moyen HT de la Cave', sur: 'le panier moyen HT de la Cave', unite: '€' },
  pmBar: { libelle: 'Panier moyen HT du Bar', sur: 'le panier moyen HT du Bar', unite: '€' },
  marge: { libelle: 'Taux de marge', sur: 'le taux de marge', unite: 'pts' },
}
const estIndicateur = (v: unknown): v is IndicateurMesure => typeof v === 'string' && v in indicateursMesure

function normaliserMesure(v: unknown): MesurePriorite | undefined {
  if (!v || typeof v !== 'object') return undefined
  const x = v as Record<string, unknown>
  if (!estIndicateur(x.indicateur) || typeof x.attendu !== 'number' || !Number.isFinite(x.attendu) || x.attendu === 0) return undefined
  const depuis = typeof x.depuis === 'string' && /^\d{4}-\d{2}$/.test(x.depuis) ? x.depuis : ''
  if (!depuis) return undefined
  return { indicateur: x.indicateur, attendu: x.attendu, depuis, source: texte(x.source).slice(0, 300) }
}

// Mois qui suit un jour AAAA-MM-JJ : le premier mois mesuré
export function moisSuivant(jour: string): string {
  const a = Number(jour.slice(0, 4)), m = Number(jour.slice(5, 7))
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`
}
const moisAvant = (mois: string) => `${Number(mois.slice(0, 4)) - 1}${mois.slice(4)}`

export function valeurIndicateur(c: ChiffreMois | undefined, i: IndicateurMesure): number | null {
  if (!c) return null
  if (i === 'ca') {
    const l = [c.caCave, c.caBar, c.caExt]
    return l.every((x) => x === null) ? null : l.reduce<number>((s, x) => s + (x ?? 0), 0)
  }
  return c[i]
}

export interface Constat { mois: number; dernier: string; ecart: number; atteint: boolean; part: number }
// Écart moyen face au même mois de l'an passé, sur les mois clos depuis le départ ; null tant qu'aucun mois n'est comparable
export function constater(chiffres: ChiffreMois[], m: MesurePriorite): Constat | null {
  const parMois = new Map(chiffres.map((c) => [c.mois, c]))
  const ecarts: { mois: string; ecart: number }[] = []
  for (const c of [...chiffres].sort((x, y) => x.mois.localeCompare(y.mois))) {
    if (c.mois < m.depuis) continue
    const v = valeurIndicateur(c, m.indicateur), avant = valeurIndicateur(parMois.get(moisAvant(c.mois)), m.indicateur)
    if (v === null || avant === null) continue
    ecarts.push({ mois: c.mois, ecart: v - avant })
  }
  if (!ecarts.length) return null
  const ecart = ecarts.reduce((s, x) => s + x.ecart, 0) / ecarts.length
  return { mois: ecarts.length, dernier: ecarts.at(-1)!.mois, ecart, atteint: m.attendu > 0 ? ecart >= m.attendu : ecart <= m.attendu, part: ecart / m.attendu }
}

export const libelleStatutPriorite: Record<StatutPriorite, string> = { active: 'En cours', atteinte: 'Atteinte', abandonnee: 'Abandonnée' }

const texte = (v: unknown) => (typeof v === 'string' ? v : '')
const jour = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '')

export function normaliserPriorites(liste: unknown): Priorite[] {
  if (!Array.isArray(liste)) return []
  return liste.flatMap((o): Priorite[] => {
    if (!o || typeof o !== 'object') return []
    const x = o as Record<string, unknown>
    const titre = texte(x.titre).trim()
    if (!titre || !texte(x.id)) return []
    const statut: StatutPriorite = x.statut === 'atteinte' || x.statut === 'abandonnee' ? x.statut : 'active'
    const mesure = normaliserMesure(x.mesure)
    return [{ id: texte(x.id), titre: titre.slice(0, 200), objectif: texte(x.objectif), statut, bilan: texte(x.bilan).slice(0, 300), creeLe: jour(x.creeLe), par: texte(x.par), closLe: jour(x.closLe), revueLe: jour(x.revueLe), ...(mesure ? { mesure } : {}) }]
  })
}

export function normaliserPlans(v: unknown): Record<string, Priorite[]> {
  const r: Record<string, Priorite[]> = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return r
  for (const [m, liste] of Object.entries(v as Record<string, unknown>)) {
    const l = normaliserPriorites(liste)
    if (l.length) r[m] = l
  }
  return r
}

export const prioritesDu = (reseau: Reseau, magasin: string) => reseau.plans?.[magasin] ?? []
export const prioritesActives = (reseau: Reseau, magasin: string) => prioritesDu(reseau, magasin).filter((p) => p.statut === 'active')
export const tachesDeLaPriorite = (actions: ActionSuivie[], p: Priorite) => actions.filter((x) => x.a.priorite === p.id)
export const nouvelIdPriorite = () => `p_${Math.random().toString(36).slice(2, 10)}`

// Plan à revoir : aucune revue depuis 60 jours alors qu'une priorité est en cours
export function planARevoir(reseau: Reseau, magasin: string): boolean {
  const actives = prioritesActives(reseau, magasin)
  if (!actives.length) return false
  const derniere = actives.map((p) => p.revueLe || p.creeLe).sort().at(-1) ?? ''
  if (!derniere) return true
  const ecart = (Date.parse(`${reseau.jour}T12:00:00Z`) - Date.parse(`${derniere}T12:00:00Z`)) / 86_400_000
  return ecart > 60
}

// « + 0,50 € », « − 12 tickets », « + 1 pt » : un écart sur l'indicateur, signé
export function ecartMesure(i: IndicateurMesure, v: number): string {
  const signe = v < 0 ? '− ' : '+ '
  const a = Math.abs(v)
  const u = indicateursMesure[i].unite
  const nb = (n: number, dec: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace(/[  ]/g, ' ')
  if (u === 'tickets') return `${signe}${nb(a, 0)} ticket${Math.round(a) > 1 ? 's' : ''}`
  if (u === 'pts') return `${signe}${a.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} pt${a >= 2 ? 's' : ''}`
  return `${signe}${nb(a, i === 'pmCave' || i === 'pmBar' ? 2 : 0)} €`
}

// Les deux lignes montrées sous la priorité : ce qu'on attend, ce que la caisse dit
export function phrasesMesure(m: MesurePriorite, c: Constat | null): { attendu: string; constate: string } {
  const mois = libelleMois(m.depuis)
  const attendu = `Attendu : ${ecartMesure(m.indicateur, m.attendu)} par mois sur ${indicateursMesure[m.indicateur].sur}, à partir ${/^[aeiouy]/i.test(mois) ? 'd’' : 'de '}${mois}`
  const constate = !c ? 'Constaté : premier mois clos attendu en caisse'
    : `Constaté : ${ecartMesure(m.indicateur, c.ecart)} par mois face à l’an passé (${c.mois > 1 ? `moyenne de ${c.mois} mois, jusqu’à ${libelleMois(c.dernier)}` : libelleMois(c.dernier)})`
  return { attendu, constate }
}

// Objectifs où une priorité peut encore s'ajouter (3 au plus par objectif, 3 sans objectif) ; '' = sans objectif
export function placesLibres(reseau: Reseau, magasin: string): string[] {
  const actives = prioritesDu(reseau, magasin).filter((p) => p.statut === 'active')
  const objectifs = (reseau.objectifs?.[magasin] ?? []).filter((o) => !o.clos) // objectifsDu, sans importer objectifs.ts (moteur testé seul)
  const nb = (id: string) => actives.filter((p) => (id ? p.objectif === id : !objectifs.some((o) => o.id === p.objectif))).length
  return ['', ...objectifs.map((o) => o.id)].filter((id) => nb(id) < PRIORITES_MAX)
}
