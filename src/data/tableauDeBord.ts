// 364 / 365 (Joseph, 23/11/2026) : les chiffres du tableau de bord (réseau ou magasin), calculés une fois, sans écran.
// Comparaison à périmètre égal : un écart face à l'an dernier ne compte que les magasins qui ont les deux mois.
// Cave et Bar ne s'additionnent jamais pour le panier : le panier affiché est celui de la Cave.
import { caDe, decalerMois, type ChiffreMois } from './chiffres'
import type { Reseau } from './modele'

export interface TableauDeBord {
  mois: string
  nbMagasins: number // magasins qui ont un CA ce mois-là
  ca: number
  evolCA: number | null // en %, à périmètre égal face au même mois de l'an dernier
  marge: number | null // en %, pondérée par le CA
  evolMarge: number | null // en points
  panierCave: number | null // € TTC, pondéré par les tickets Cave
  evolPanier: number | null // en %
  parts: { cave: number; bar: number; ext: number }
  mois6: { mois: string; ca: number | null; caN1: number | null }[]
}

const somme = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function moisDuTableau(reseau: Reseau, noms: string[]): string | null {
  // Dernier mois connu de chaque magasin ; on retient le plus récent que la moitié au moins des magasins ont déjà
  const derniers = noms.map((n) => (reseau.chiffres[n] ?? []).filter((c) => caDe(c) !== null).at(-1)?.mois).filter((m): m is string => !!m).sort()
  if (!derniers.length) return null
  return derniers[Math.floor((derniers.length - 1) / 2)] ?? null
}

export function tableauDeBord(reseau: Reseau, noms: string[], moisForce?: string): TableauDeBord | null {
  const mois = moisForce ?? moisDuTableau(reseau, noms)
  if (!mois) return null
  const ref = decalerMois(mois, -12)
  const du = (n: string, m: string): ChiffreMois | undefined => (reseau.chiffres[n] ?? []).find((c) => c.mois === m)
  const lignes = noms.map((n) => ({ c: du(n, mois), r: du(n, ref) })).filter((l) => caDe(l.c) !== null)
  if (!lignes.length) return null
  const ca = somme(lignes.map((l) => caDe(l.c)!))
  const comparables = lignes.filter((l) => caDe(l.r))
  const evolCA = comparables.length ? (somme(comparables.map((l) => caDe(l.c)!)) / somme(comparables.map((l) => caDe(l.r)!)) - 1) * 100 : null
  const pondere = (xs: { v: number | null; p: number | null }[]) => {
    const ok = xs.filter((x) => x.v != null && x.p) as { v: number; p: number }[]
    const poids = somme(ok.map((x) => x.p))
    return poids ? somme(ok.map((x) => x.v * x.p)) / poids : null
  }
  const marge = pondere(lignes.map((l) => ({ v: l.c!.marge, p: caDe(l.c) })))
  const margeComp = comparables.filter((l) => l.c!.marge != null && l.r!.marge != null)
  const evolMarge = margeComp.length ? pondere(margeComp.map((l) => ({ v: l.c!.marge, p: caDe(l.c) })))! - pondere(margeComp.map((l) => ({ v: l.r!.marge, p: caDe(l.r) })))! : null
  const panierCave = pondere(lignes.map((l) => ({ v: l.c!.pmCave, p: l.c!.fluxCave })))
  const panComp = comparables.filter((l) => l.c!.pmCave != null && l.r!.pmCave != null && l.c!.fluxCave && l.r!.fluxCave)
  const pc = pondere(panComp.map((l) => ({ v: l.c!.pmCave, p: l.c!.fluxCave }))), pr = pondere(panComp.map((l) => ({ v: l.r!.pmCave, p: l.r!.fluxCave })))
  const evolPanier = pc != null && pr ? (pc / pr - 1) * 100 : null
  const parts = { cave: somme(lignes.map((l) => l.c!.caCave ?? 0)), bar: somme(lignes.map((l) => l.c!.caBar ?? 0)), ext: somme(lignes.map((l) => l.c!.caExt ?? 0)) }
  const total = (m: string) => { const v = noms.map((n) => caDe(du(n, m))).filter((x): x is number => x !== null); return v.length ? somme(v) : null }
  const mois6 = Array.from({ length: 6 }, (_x, i) => { const m = decalerMois(mois, i - 5); return { mois: m, ca: total(m), caN1: total(decalerMois(m, -12)) } })
  return { mois, nbMagasins: lignes.length, ca, evolCA, marge, evolMarge, panierCave, evolPanier, parts, mois6 }
}
