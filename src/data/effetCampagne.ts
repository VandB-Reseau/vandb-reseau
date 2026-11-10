// Bilan d'une campagne par la caisse (refonte vague 5, Joseph 10/11/2026, 49A) : l'évolution du CA face à N-1, sur les
// mois entiers de la campagne, des magasins qui l'ont exécutée (constat « fait ») comparée à celle des autres (exécution
// « non » ou magasins ouverts qui n'étaient pas visés). Lecture prudente : il faut au moins 10 magasins de chaque côté,
// et la mesure porte sur le mois entier, pas seulement sur les jours de la campagne.
import type { Reseau } from './modele'
import { caDe, chiffresDuMagasin, decalerMois, type ChiffreMois } from './chiffres'
import { executionMagasin, magasinsConcernes, type Campagne, type Univers } from './campagnes'

export const MIN_MAGASINS_EFFET = 10

const caUnivers = (c: ChiffreMois | undefined, u: Univers) => (!c ? null : u === 'cave' ? c.caCave : u === 'bar' ? c.caBar : caDe(c))

// Mois entiers couverts par la campagne, connus en caisse à ce jour (le mois en cours n'est pas encore clos)
export function moisDeCampagne(c: Campagne, jour: string): string[] {
  if (!c.debut || !c.fin) return []
  const fin = c.fin.slice(0, 7) < jour.slice(0, 7) ? c.fin.slice(0, 7) : decalerMois(jour.slice(0, 7), -1)
  const l: string[] = []
  for (let m = c.debut.slice(0, 7); m <= fin && l.length < 24; m = decalerMois(m, 1)) l.push(m)
  return l
}

// CA des mois et des mêmes mois de N-1 d'un magasin ; null s'il manque un mois d'un côté ou de l'autre
function sommes(reseau: Reseau, nom: string, mois: string[], u: Univers): [number, number] | null {
  const parMois = new Map(chiffresDuMagasin(reseau, nom).map((x) => [x.mois, x]))
  let a = 0, b = 0
  for (const m of mois) {
    const x = caUnivers(parMois.get(m), u), y = caUnivers(parMois.get(decalerMois(m, -12)), u)
    if (x === null || y === null || y <= 0) return null
    a += x; b += y
  }
  return [a, b]
}

export function evolutionMagasin(reseau: Reseau, c: Campagne, nom: string): number | null {
  const mois = moisDeCampagne(c, reseau.jour)
  const s = mois.length ? sommes(reseau, nom, mois, c.univers ?? 'tout') : null
  return s ? Math.round(((s[0] - s[1]) / s[1]) * 1000) / 10 : null
}

export interface Groupe { n: number; evolution: number | null }
export interface EffetCampagne { mois: string[]; participants: Groupe; autres: Groupe; ecart: number | null; assez: boolean }

export function effetCampagne(reseau: Reseau, c: Campagne): EffetCampagne {
  const mois = moisDeCampagne(c, reseau.jour)
  const u = c.univers ?? 'tout'
  const vises = new Set(magasinsConcernes(reseau, c).map((m) => m.nom))
  const groupe = (noms: string[]): Groupe => {
    const s = mois.length ? noms.map((n) => sommes(reseau, n, mois, u)).filter((x): x is [number, number] => !!x) : []
    const a = s.reduce((t, x) => t + x[0], 0), b = s.reduce((t, x) => t + x[1], 0)
    return { n: s.length, evolution: b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null }
  }
  const ouverts = reseau.magasins.filter((m) => m.statut !== 'avenir')
  const participants = groupe(ouverts.filter((m) => vises.has(m.nom) && executionMagasin(reseau.campagnes, c, m.nom) === 'fait').map((m) => m.nom))
  const autres = groupe(ouverts.filter((m) => !vises.has(m.nom) || executionMagasin(reseau.campagnes, c, m.nom) === 'non').map((m) => m.nom))
  const assez = participants.n >= MIN_MAGASINS_EFFET && autres.n >= MIN_MAGASINS_EFFET
  const ecart = assez && participants.evolution !== null && autres.evolution !== null ? Math.round((participants.evolution - autres.evolution) * 10) / 10 : null
  return { mois, participants, autres, ecart, assez }
}
