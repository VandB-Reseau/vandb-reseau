import { UNIVERS, type Budget, type Univers } from './types'

// Leviers commerciaux chiffrés (lot 28, 28/10/2026) : ce que rapportent sur un an, Cave et Bar séparés,
// - plus de tickets (fréquentation), en part des tickets de l'année ;
// - un panier plus fort (vente additionnelle), en euros TTC par ticket ;
// - un mix vers les familles les mieux margées, en points de taux de marge de l'univers.
// CA de l'univers × (1 + tickets) × (1 + euros de panier / panier TTC) ; marge au taux de l'univers plus les points de mix.
// Redevance et publicité suivent le CA ; l'équipe et les frais ne bougent pas : l'effet sur l'EBE est un plafond.
// Rien n'est enregistré : c'est un simulateur.
// Extérieur (Joseph, 03/11/2026) : sans tickets ni panier, son levier de volume est « CA en plus » (clients gagnés,
// locations en plus), porté par le champ tickets ; le panier reste à 0.

export interface BaseLevier { ca: number; tauxMarge: number; panierTTC: number | null }
export interface Leviers { tickets: number; panier: number; mix: number }  // 0,02 = +2 % ; euros TTC ; 0,005 = +0,5 point
export interface EffetLeviers {
  univers: Partial<Record<Univers, { ca: number; marge: number }>>     // gains de l'univers
  ca: number; marge: number; ebe: number                                      // gains totaux sur un an
}
export const AUCUN_LEVIER: Leviers = { tickets: 0, panier: 0, mix: 0 }

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

// Base d'un budget (ou d'un atterrissage) : CA et marge visés des familles de l'univers, panier TTC visé (ou réalisé)
export function baseLeviers(b: Budget): Partial<Record<Univers, BaseLevier>> {
  const r: Partial<Record<Univers, BaseLevier>> = {}
  for (const u of UNIVERS) {
    const f = b.familles.filter((x) => x.univers === u)
    const ca = somme(f.map((x) => x.objectif))
    if (ca <= 0) continue
    const panier = u === 'exterieur' ? 0 : b.flux[u]?.panierObjectifTTC || b.flux[u]?.panierRealiseTTC || 0
    r[u] = { ca, tauxMarge: somme(f.map((x) => x.margeObjectif)) / ca, panierTTC: panier > 0 ? panier : null }
  }
  return r
}

export function effetLeviers(
  base: Partial<Record<Univers, BaseLevier>>,
  leviers: Partial<Record<Univers, Leviers>>,
  p: { tauxRedevance: number; tauxPublicite: number },
): EffetLeviers {
  const univers: EffetLeviers['univers'] = {}
  for (const u of UNIVERS) {
    const b = base[u], l = leviers[u]
    if (!b || !l) continue
    const panier = b.panierTTC ? l.panier / b.panierTTC : 0
    const ca = b.ca * (1 + l.tickets) * (1 + panier)
    univers[u] = { ca: ca - b.ca, marge: ca * (b.tauxMarge + l.mix) - b.ca * b.tauxMarge }
  }
  const ca = somme(Object.values(univers).map((x) => x.ca)), marge = somme(Object.values(univers).map((x) => x.marge))
  return { univers, ca, marge, ebe: marge - ca * (p.tauxRedevance + p.tauxPublicite) }
}

// ── 183 · Mon meilleur levier (Joseph, 15/11/2026) ─────────────────────────────────────────────────────────────────
// Pour un même petit effort, ce que chaque levier rapporte en EBE sur un an à CE magasin, du plus au moins rentable :
// - un ticket de plus par jour d'ouverture, Cave puis Bar (tickets de l'univers × jours / tickets visés) ;
// - quelques euros TTC de plus par panier, Cave puis Bar ;
// - un point de marge sur tout le CA (Cave, Bar, Extérieur) ;
// - quelques heures payées de moins par semaine (52 semaines × coût chargé d'une heure), sans perte de CA.
// Les quatre premiers passent par effetLeviers (redevance et publicité suivent le CA). Chaque ligne dit aussi ce qui se
// mesure en caisse chaque mois (184) : tickets, panier HT, points de marge ; les heures ne se lisent pas en caisse.
export type CleLevier = 'tickets_cave' | 'tickets_bar' | 'panier_cave' | 'panier_bar' | 'marge' | 'heures'
export interface EffortsLeviers { ticketsJour: number; panierTTC: number; pointsMarge: number; heuresSemaine: number; coutHeure: number; joursParAn: number }
export interface LigneLevier {
  cle: CleLevier; univers: 'cave' | 'bar' | null
  ca: number; marge: number; ebe: number
  mesure: { indicateur: 'fluxCave' | 'fluxBar' | 'pmCave' | 'pmBar' | 'marge'; attendu: number } | null // par mois
}
export function meilleursLeviers(b: Budget, p: { tauxRedevance: number; tauxPublicite: number; tvaPanier: Partial<Record<Univers, number>> }, x: EffortsLeviers): LigneLevier[] {
  const base = baseLeviers(b)
  const l: LigneLevier[] = []
  const ajoute = (cle: CleLevier, univers: 'cave' | 'bar' | null, leviers: Partial<Record<Univers, Leviers>>, mesure: LigneLevier['mesure']) => {
    const e = effetLeviers(base, leviers, p)
    l.push({ cle, univers, ca: e.ca, marge: e.marge, ebe: e.ebe, mesure })
  }
  for (const u of ['cave', 'bar'] as const) {
    const tickets = b.flux[u]?.objectif ?? 0
    if (!base[u] || tickets <= 0) continue
    const enPlus = x.ticketsJour * x.joursParAn
    if (x.ticketsJour > 0) ajoute(`tickets_${u}`, u, { [u]: { ...AUCUN_LEVIER, tickets: enPlus / tickets } }, { indicateur: u === 'cave' ? 'fluxCave' : 'fluxBar', attendu: enPlus / 12 })
    if (x.panierTTC > 0 && base[u]!.panierTTC) ajoute(`panier_${u}`, u, { [u]: { ...AUCUN_LEVIER, panier: x.panierTTC } }, { indicateur: u === 'cave' ? 'pmCave' : 'pmBar', attendu: x.panierTTC / (1 + (p.tvaPanier[u] ?? 0)) })
  }
  if (x.pointsMarge > 0 && Object.keys(base).length) {
    ajoute('marge', null, Object.fromEntries(Object.keys(base).map((u) => [u, { ...AUCUN_LEVIER, mix: x.pointsMarge / 100 }])), { indicateur: 'marge', attendu: x.pointsMarge })
  }
  if (x.heuresSemaine > 0 && x.coutHeure > 0) {
    const gain = x.heuresSemaine * 52 * x.coutHeure
    l.push({ cle: 'heures', univers: null, ca: 0, marge: 0, ebe: gain, mesure: null })
  }
  return l.sort((a, c) => c.ebe - a.ebe)
}

// ── 191 · Base de la caisse (Joseph, 15/11/2026) ───────────────────────────────────────────────────────────────────
// Les simulateurs « Mon meilleur levier » et « Vente additionnelle » partent des tickets et du panier réellement passés en
// caisse sur les 12 derniers mois clos plutôt que des seuls tickets visés au budget. Un univers ne compte que si ses
// 12 mois ont tous des tickets et un panier ; sinon il garde le budget. Panier de la caisse en HT (TVA du panier pour le TTC).
export interface MoisCaisse { mois: string; fluxCave: number | null; pmCave: number | null; fluxBar: number | null; pmBar: number | null } // mois AAAA-MM
export interface BaseCaisseUnivers { tickets: number; panierHT: number; ca: number }
export interface BaseCaisse { de: string; a: string; univers: Partial<Record<'cave' | 'bar', BaseCaisseUnivers>> }
const moisAvant = (m: string, n: number) => {
  const [a, mm] = m.split('-').map(Number)
  const t = a * 12 + (mm - 1) - n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}
export function baseCaisse(liste: MoisCaisse[]): BaseCaisse | null {
  const avecTickets = liste.filter((x) => (x.fluxCave ?? 0) > 0 || (x.fluxBar ?? 0) > 0).map((x) => x.mois).sort()
  const a = avecTickets.at(-1)
  if (!a) return null
  const parMois = new Map(liste.map((x) => [x.mois, x]))
  const douze = Array.from({ length: 12 }, (_, i) => parMois.get(moisAvant(a, 11 - i)))
  const univers: BaseCaisse['univers'] = {}
  for (const u of ['cave', 'bar'] as const) {
    const flux = douze.map((x) => (u === 'cave' ? x?.fluxCave : x?.fluxBar) ?? 0), pm = douze.map((x) => (u === 'cave' ? x?.pmCave : x?.pmBar) ?? 0)
    if (flux.some((f) => f <= 0) || pm.some((p) => p <= 0)) continue
    const tickets = somme(flux), ca = somme(flux.map((f, i) => f * pm[i]))
    univers[u] = { tickets, ca, panierHT: ca / tickets }
  }
  return Object.keys(univers).length ? { de: moisAvant(a, 11), a, univers } : null
}
// Le budget recalé sur la caisse : tickets, panier TTC et CA de l'univers (familles au prorata, taux de marge inchangé)
export function budgetSurCaisse(b: Budget, base: BaseCaisse, tvaPanier: Partial<Record<Univers, number>>): Budget {
  const flux = { ...b.flux }
  let familles = b.familles
  for (const u of ['cave', 'bar'] as const) {
    const c = base.univers[u], f = b.flux[u]
    const caU = somme(b.familles.filter((x) => x.univers === u).map((x) => x.objectif))
    if (!c || !f || caU <= 0) continue
    const k = c.ca / caU
    familles = familles.map((x) => (x.univers === u ? { ...x, objectif: x.objectif * k, margeObjectif: x.margeObjectif * k } : x))
    flux[u] = { ...f, objectif: c.tickets, panierObjectifTTC: c.panierHT * (1 + (tvaPanier[u] ?? 0)) }
  }
  return { ...b, flux, familles }
}
