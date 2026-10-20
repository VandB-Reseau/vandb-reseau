// Campagnes commerciales (Noël, Beaujolais…) : des points à constater en magasin pendant une période.
// Stockées dans app_config (clé campagnes) : la liste des campagnes et les constats par magasin.
// Campagnes régionales : créées par un Responsable Régional pour ses magasins (table campagnes_regions).
import type { Magasin, Reseau } from './modele'
import { coachA } from './charge'
import { magasinsDu } from './perimetre'

export interface PointCampagne { id: string; libelle: string }
export type Perimetre = 'tous' | 'franchises' | 'integres' | 'choix' | 'region'
export const perimetres: { id: Perimetre; libelle: string }[] = [
  { id: 'tous', libelle: 'Tous les magasins ouverts' },
  { id: 'franchises', libelle: 'Magasins franchisés' },
  { id: 'integres', libelle: 'Magasins intégrés' },
  { id: 'choix', libelle: 'Magasins choisis' },
]
// Campagne d'un Responsable Régional : sa région, une partie de ses magasins, ou exceptionnellement tout le réseau
export const perimetresRegion: { id: Perimetre; libelle: string }[] = [
  { id: 'region', libelle: 'Tous les magasins de la région' },
  { id: 'choix', libelle: 'Magasins choisis' },
  { id: 'tous', libelle: 'Tout le réseau' },
]
export const libellePerimetre = (c: Campagne) => (c.rr ? perimetresRegion : perimetres).find((p) => p.id === c.perimetre)?.libelle ?? ''
export const MAX_POINTS = 5

export interface Campagne {
  id: string
  nom: string
  debut: string // AAAA-MM-JJ
  fin: string
  points: PointCampagne[]
  perimetre: Perimetre
  magasins: string[] // périmètre « choix »
  rr?: string // campagne régionale : identifiant du Responsable Régional qui la tient
}

// Constat d'un point dans un magasin : fait ou non, à une date, par une personne
export interface Constat { fait: boolean; date: string; par: string }
export interface Campagnes {
  liste: Campagne[]
  constats: Record<string, Record<string, Record<string, Constat>>> // campagne → magasin → point
}

export const campagnesVides = (): Campagnes => ({ liste: [], constats: {} })

const texte = (v: unknown) => (typeof v === 'string' ? v : '')
function normaliserCampagne(c: Partial<Campagne>, rr = ''): Campagne {
  const t = texte
  const choix = rr ? perimetresRegion : perimetres
  return {
    id: t(c.id), nom: t(c.nom), debut: t(c.debut), fin: t(c.fin),
    points: (Array.isArray(c.points) ? c.points : []).map((p) => ({ id: t(p?.id), libelle: t(p?.libelle) })).filter((p) => p.id && p.libelle),
    perimetre: choix.some((p) => p.id === c.perimetre) ? c.perimetre! : choix[0].id,
    magasins: Array.isArray(c.magasins) ? c.magasins.map(t).filter(Boolean) : [],
    ...(rr ? { rr } : {}),
  }
}

// regions : lignes de campagnes_regions (une par campagne régionale), ajoutées à la liste
export function normaliserCampagnes(brut: unknown, regions: { id?: unknown; rr?: unknown; valeur?: unknown }[] = []): Campagnes {
  const b = (brut && typeof brut === 'object' ? brut : {}) as Partial<Campagnes>
  const objet = (c: unknown) => !!c && typeof c === 'object'
  const liste = (Array.isArray(b.liste) ? b.liste : []).filter(objet).map((c: Partial<Campagne>) => normaliserCampagne(c))
  const ids = new Set(liste.map((c) => c.id))
  const regionales = regions.filter((r) => texte(r.rr) && objet(r.valeur))
    .map((r) => normaliserCampagne({ ...(r.valeur as Partial<Campagne>), id: texte(r.id) }, texte(r.rr))).filter((c) => !ids.has(c.id))
  return { liste: [...liste, ...regionales].filter((c) => c.id && c.nom), constats: b.constats && typeof b.constats === 'object' ? b.constats : {} }
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
  if (c.perimetre === 'region') return magasinsDu(reseau, { type: 'rr', id: c.rr ?? '' }).filter((m) => m.statut !== 'avenir')
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
