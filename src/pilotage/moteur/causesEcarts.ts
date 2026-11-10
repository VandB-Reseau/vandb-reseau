import type { MoisReel } from './suivi'
import type { Budget } from './types'

// Causes des écarts du mois (vague 6, Joseph 10/11/2026, 77A) : à la clôture d'un mois, chaque écart au-delà du seuil
// d'alerte (CA sous le budget du mois, taux de marge sous celui de l'an dernier) reçoit une cause d'une courte liste et
// une phrase. Rangée en commentaire du suivi (ancre « ecart/aaaa-mm/indicateur »), texte « Cause : phrase ».
export const CAUSES_ECART = [
  { cle: 'meteo', libelle: 'Météo' },
  { cle: 'travaux', libelle: 'Travaux' },
  { cle: 'rupture', libelle: 'Rupture' },
  { cle: 'prix', libelle: 'Prix' },
  { cle: 'personnel', libelle: 'Personnel' },
  { cle: 'evenement', libelle: 'Événement' },
  { cle: 'autre', libelle: 'Autre' },
] as const
export type CauseEcart = (typeof CAUSES_ECART)[number]['cle']
export type IndicateurEcart = 'ca' | 'marge'
export interface EcartMois { indicateur: IndicateurEcart; libelle: string; ecart: number; reel: number; reference: number }

export const ancreEcart = (annee: number, mois: number, i: IndicateurEcart) => `ecart/${annee}-${String(mois).padStart(2, '0')}/${i}`
export function lireAncreEcart(ancre: string): { annee: number; mois: number; indicateur: IndicateurEcart } | null {
  const m = /^ecart\/(\d{4})-(\d{2})\/(ca|marge)$/.exec(ancre)
  return m ? { annee: Number(m[1]), mois: Number(m[2]), indicateur: m[3] as IndicateurEcart } : null
}

// mois : 1 à 12. Seuils : ceux des alertes (5 % sous le budget, 1 point de marge par défaut)
export function ecartsDuMois(mois: number, n: MoisReel[], n1: MoisReel[], budget: Pick<Budget, 'mois'> | null, s: { ecartCA: number; baisseMarge: number }): EcartMois[] {
  const r: EcartMois[] = []
  const x = n[mois - 1]
  if (!x || x.caHT <= 0) return r
  const caBudget = budget?.mois[mois - 1]?.ca ?? 0
  if (caBudget > 0 && x.caHT / caBudget - 1 < -s.ecartCA - 1e-9) r.push({ indicateur: 'ca', libelle: 'CA sous le budget', ecart: x.caHT / caBudget - 1, reel: x.caHT, reference: caBudget })
  const y = n1[mois - 1]
  const t = x.caAvecMarge > 0 ? x.margeHT / x.caAvecMarge : null
  const t1 = y && y.caAvecMarge > 0 ? y.margeHT / y.caAvecMarge : null
  if (t !== null && t1 !== null && t - t1 < -s.baisseMarge - 1e-9) r.push({ indicateur: 'marge', libelle: 'Taux de marge sous l’an dernier', ecart: t - t1, reel: t, reference: t1 })
  return r
}

export const ecrireExplication = (cause: CauseEcart, phrase: string) => {
  const l = CAUSES_ECART.find((c) => c.cle === cause)!.libelle
  return phrase.trim() ? `${l} : ${phrase.trim()}` : l
}
export function lireExplication(texte: string): { cause: CauseEcart; phrase: string } {
  const c = CAUSES_ECART.find((x) => texte === x.libelle || texte.startsWith(`${x.libelle} : `))
  return c ? { cause: c.cle, phrase: texte.slice(c.libelle.length + 3) } : { cause: 'autre', phrase: texte }
}

// Lecture du réseau : causes d'un mois comptées sur tous les magasins (une explication par écart, la première)
export function causesDuMois(l: { magasin: string; ancre: string; texte: string; parent?: number | null }[], annee: number, mois: number): { cause: CauseEcart; libelle: string; n: number }[] {
  const vues = new Set<string>()
  const n = new Map<CauseEcart, number>()
  for (const c of l) {
    if (c.parent) continue
    const a = lireAncreEcart(c.ancre)
    if (!a || a.annee !== annee || a.mois !== mois) continue
    const cle = `${c.magasin}|${c.ancre}`
    if (vues.has(cle)) continue
    vues.add(cle)
    const cause = lireExplication(c.texte).cause
    n.set(cause, (n.get(cause) ?? 0) + 1)
  }
  return CAUSES_ECART.filter((c) => n.has(c.cle)).map((c) => ({ cause: c.cle, libelle: c.libelle, n: n.get(c.cle)! })).sort((a, b) => b.n - a.n)
}
