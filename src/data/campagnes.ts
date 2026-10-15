// Campagnes commerciales (Noël, Beaujolais…) : des points à constater en magasin pendant une période.
// Stockées dans app_config (clé campagnes) : la liste des campagnes et les constats par magasin.
import type { Magasin, Reseau } from './modele'
import { coachA } from './charge'

export interface PointCampagne { id: string; libelle: string }
export type Perimetre = 'tous' | 'franchises' | 'integres' | 'choix'
export const perimetres: { id: Perimetre; libelle: string }[] = [
  { id: 'tous', libelle: 'Tous les magasins ouverts' },
  { id: 'franchises', libelle: 'Magasins franchisés' },
  { id: 'integres', libelle: 'Magasins intégrés' },
  { id: 'choix', libelle: 'Magasins choisis' },
]
export const MAX_POINTS = 5

export interface Campagne {
  id: string
  nom: string
  debut: string // AAAA-MM-JJ
  fin: string
  points: PointCampagne[]
  perimetre: Perimetre
  magasins: string[] // périmètre « choix »
}

// Constat d'un point dans un magasin : fait ou non, à une date, par une personne
export interface Constat { fait: boolean; date: string; par: string }
export interface Campagnes {
  liste: Campagne[]
  constats: Record<string, Record<string, Record<string, Constat>>> // campagne → magasin → point
}

export const campagnesVides = (): Campagnes => ({ liste: [], constats: {} })

export function normaliserCampagnes(brut: unknown): Campagnes {
  const b = (brut && typeof brut === 'object' ? brut : {}) as Partial<Campagnes>
  const t = (v: unknown) => (typeof v === 'string' ? v : '')
  const liste = (Array.isArray(b.liste) ? b.liste : []).filter((c) => c && typeof c === 'object').map((c: Partial<Campagne>) => ({
    id: t(c.id), nom: t(c.nom), debut: t(c.debut), fin: t(c.fin),
    points: (Array.isArray(c.points) ? c.points : []).map((p) => ({ id: t(p?.id), libelle: t(p?.libelle) })).filter((p) => p.id && p.libelle),
    perimetre: perimetres.some((p) => p.id === c.perimetre) ? c.perimetre! : 'tous',
    magasins: Array.isArray(c.magasins) ? c.magasins.map(t).filter(Boolean) : [],
  })).filter((c) => c.id && c.nom)
  return { liste, constats: b.constats && typeof b.constats === 'object' ? b.constats : {} }
}

export type Phase = 'encours' | 'avenir' | 'terminee'
export const libellesPhase: Record<Phase, string> = { encours: 'En cours', avenir: 'À venir', terminee: 'Terminées' }
export function phase(c: Campagne, jour: string): Phase {
  if (c.debut && jour < c.debut) return 'avenir'
  if (c.fin && jour > c.fin) return 'terminee'
  return 'encours'
}

export function magasinsConcernes(reseau: Reseau, c: Campagne): Magasin[] {
  const ouverts = reseau.magasins.filter((m) => m.statut !== 'avenir')
  if (c.perimetre === 'franchises') return ouverts.filter((m) => m.franchise)
  if (c.perimetre === 'integres') return ouverts.filter((m) => !m.franchise)
  if (c.perimetre === 'choix') return reseau.magasins.filter((m) => c.magasins.includes(m.nom))
  return ouverts
}

export const concerne = (reseau: Reseau, c: Campagne, magasin: string) => magasinsConcernes(reseau, c).some((m) => m.nom === magasin)

// Exécution d'une campagne dans un magasin : faite quand tous les points sont constatés faits
export type Execution = 'fait' | 'partiel' | 'non' | 'aConstater'
export const libellesExecution: Record<Execution, string> = { fait: 'Exécutée', partiel: 'En partie', non: 'Non exécutée', aConstater: 'À constater' }

export function executionMagasin(campagnes: Campagnes, c: Campagne, magasin: string): Execution {
  const k = campagnes.constats[c.id]?.[magasin] ?? {}
  const constates = c.points.filter((p) => k[p.id])
  const faits = constates.filter((p) => k[p.id].fait).length
  if (!constates.length) return 'aConstater'
  if (faits === c.points.length) return 'fait'
  return faits > 0 ? 'partiel' : 'non'
}

export interface Bilan { total: number; fait: number; partiel: number; non: number; aConstater: number; taux: number | null; constates: number }
export function bilan(campagnes: Campagnes, c: Campagne, magasins: Magasin[]): Bilan {
  const b = { total: magasins.length, fait: 0, partiel: 0, non: 0, aConstater: 0 }
  for (const m of magasins) b[executionMagasin(campagnes, c, m.nom)]++
  return { ...b, constates: b.total - b.aConstater, taux: b.total ? Math.round((b.fait / b.total) * 100) : null }
}

// Bilan par Coach ou par Responsable Régional des magasins concernés
export function bilanPar(reseau: Reseau, c: Campagne, magasins: Magasin[], par: 'coach' | 'rr'): { nom: string; b: Bilan }[] {
  const groupes = new Map<string, Magasin[]>()
  for (const m of magasins) {
    const nom = par === 'coach' ? coachA(m, reseau.jour) || 'Sans Coach' : m.rr?.nom ?? 'Sans Responsable Régional'
    groupes.set(nom, [...(groupes.get(nom) ?? []), m])
  }
  return [...groupes].map(([nom, ms]) => ({ nom, b: bilan(reseau.campagnes, c, ms) })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

// Campagnes à constater dans un magasin à une date : en cours à cette date
export function campagnesDuMagasin(reseau: Reseau, magasin: string, jour: string): Campagne[] {
  return reseau.campagnes.liste.filter((c) => phase(c, jour) === 'encours' && concerne(reseau, c, magasin))
}
