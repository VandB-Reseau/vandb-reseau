import type { Magasin, Reseau } from './modele'
import { analyser, dernierAudit, typesAudit } from './chiffres'
import { caseDe } from './sante'
import { anneeDe, suiviRythme, type LigneRythme } from './visites'

// Portefeuille d'un Coach ou d'un Responsable Régional, comparé au réseau : rien à saisir, tout se calcule sur l'existant
export const CASES_A_SURVEILLER = ['redressement', 'relance', 'renforcer']

export interface Portefeuille {
  magasins: number
  visitesFaites: number
  visitesReference: number // visites de référence de la nine box, à titre indicatif
  decroche: number // magasins en Décroche
  avecChiffres: number // magasins dont l'alerte peut se calculer
  partDecroche: number | null // %
  evolutionCA: number | null // CA cumulé du portefeuille vs l'an dernier, mêmes mois (%)
  audit: number | null // score moyen des derniers audits (%)
  audites: number
  aSurveiller: number // magasins en Redressement, Relance ou Management à renforcer
  classes: number // magasins classés dans la nine box
}

const part = (n: number, sur: number) => (sur ? (n / sur) * 100 : null)

export function portefeuilleDe(reseau: Reseau, magasins: Magasin[], rythme?: LigneRythme[]): Portefeuille {
  const noms = new Set(magasins.map((m) => m.nom))
  const lignes = (rythme ?? suiviRythme(reseau, anneeDe(reseau.jour))).filter((l) => noms.has(l.magasin.nom))
  let decroche = 0, avecChiffres = 0, ca = 0, caRef = 0, scores = 0, audites = 0, aSurveiller = 0, classes = 0
  for (const m of magasins) {
    const a = analyser(reseau, m.nom)
    if (a?.statut) { avecChiffres++; if (a.statut === 'decroche') decroche++ }
    if (a && a.ca !== null && a.caReference) { ca += a.ca; caRef += a.caReference }
    const notes = typesAudit.map((t) => dernierAudit(reseau, m.nom, t)?.score).filter((s): s is number => typeof s === 'number')
    if (notes.length) { audites++; scores += notes.reduce((t, s) => t + s, 0) / notes.length }
    const c = caseDe(reseau.evaluations[m.nom])
    if (c) { classes++; if (CASES_A_SURVEILLER.includes(c.id)) aSurveiller++ }
  }
  return {
    magasins: magasins.length,
    visitesFaites: lignes.reduce((t, l) => t + l.faites, 0),
    visitesReference: lignes.reduce((t, l) => t + l.reference, 0),
    decroche, avecChiffres, partDecroche: part(decroche, avecChiffres),
    evolutionCA: caRef ? ((ca - caRef) / caRef) * 100 : null,
    audit: audites ? scores / audites : null, audites,
    aSurveiller, classes,
  }
}

// Écart en points (ou en %) au réseau ; sens : +1 si plus haut vaut mieux, -1 sinon
export type Sens = 1 | -1
export function tonEcart(valeur: number | null, reseau: number | null, sens: Sens, seuil = 5): 'mieux' | 'moins' | 'egal' | null {
  if (valeur === null || reseau === null) return null
  const d = (valeur - reseau) * sens
  return d >= seuil ? 'mieux' : d <= -seuil ? 'moins' : 'egal'
}
