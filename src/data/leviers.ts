// Leviers du CA d'un magasin : panier et flux, côté cave et côté bar, face au réseau et à N-1.
// Le panier se compare au réseau (médiane et quartiles du même mois) ; le flux, qui dépend de l'emplacement
// et de la surface, se compare d'abord au même mois de l'an dernier du magasin.
// Le levier nommé est l'indicateur le plus en retrait, s'il l'est d'au moins 5 %.
import { useEffect, useState } from 'react'
import type { Reseau } from './modele'
import { chiffresDuMagasin, decalerMois, type ChiffreMois } from './chiffres'
import { chargerReperesEquipe, type Repere, type Reperes } from './espaceFranchise'

export type Levier = 'pmCave' | 'fluxCave' | 'pmBar' | 'fluxBar'
export const leviers: Levier[] = ['pmCave', 'fluxCave', 'pmBar', 'fluxBar']
export const libellesLevier: Record<Levier, string> = { pmCave: 'Panier cave', fluxCave: 'Flux cave', pmBar: 'Panier bar', fluxBar: 'Flux bar' }
export const SEUIL_LEVIER = -5

export interface PositionLevier {
  indicateur: Levier
  valeur: number
  repere: Repere | null // réseau du même mois (au moins 5 magasins)
  ecartReseau: number | null // % vs la médiane du réseau
  evolution: number | null // % vs le même mois de l'an dernier
  quart: 'bas' | 'milieu' | 'haut' | null
  score: number | null // ce qui désigne le levier : écart au réseau (panier), évolution (flux)
}
export interface LeviersMagasin { mois: string; positions: PositionLevier[]; levier: Levier | null }

const pct = (v: number, ref: number | null | undefined) => (ref ? Math.round(((v - ref) / ref) * 1000) / 10 : null)

export function leviersDuMagasin(reseau: Reseau, nom: string, reperes: Reperes | null): LeviersMagasin | null {
  const liste = chiffresDuMagasin(reseau, nom)
  const mois = reperes?.mois ?? liste.at(-1)?.mois
  if (!mois) return null
  const c = liste.find((x) => x.mois === mois)
  if (!c) return null
  const avant: ChiffreMois | undefined = liste.find((x) => x.mois === decalerMois(mois, -12))
  const positions: PositionLevier[] = []
  for (const i of leviers) {
    const valeur = c[i]
    if (valeur === null) continue
    const repere = reperes?.indicateurs[i] ?? null
    const ecartReseau = pct(valeur, repere?.mediane)
    const evolution = pct(valeur, avant?.[i])
    const quart = !repere ? null : repere.quartBas !== undefined && valeur < repere.quartBas ? 'bas' : valeur > repere.quartHaut ? 'haut' : 'milieu'
    const score = i === 'pmCave' || i === 'pmBar' ? ecartReseau ?? evolution : evolution
    positions.push({ indicateur: i, valeur, repere, ecartReseau, evolution, quart, score })
  }
  if (!positions.length) return null
  const candidats = positions.filter((p) => p.score !== null && p.score <= SEUIL_LEVIER).sort((a, b) => a.score! - b.score!)
  return { mois, positions, levier: candidats[0]?.indicateur ?? null }
}

// Repères du réseau pour un ensemble de magasins (dernier mois connu de ces magasins), gardés le temps de la session
const cache = new Map<string, Promise<Reperes | null>>()
export function useReperesReseau(magasins: string[]): Reperes | null | undefined {
  const cle = [...magasins].sort().join('|')
  const [r, setR] = useState<{ cle: string; v: Reperes | null } | null>(null)
  useEffect(() => {
    if (!cle) return
    let actif = true
    let p = cache.get(cle)
    if (!p) { p = chargerReperesEquipe(cle.split('|')).catch(() => null); cache.set(cle, p) }
    p.then((v) => { if (actif) setR({ cle, v }) })
    return () => { actif = false }
  }, [cle])
  if (!cle) return null
  return r?.cle === cle ? r.v : undefined
}
