import { caDe, chiffresDuMagasin, type ChiffreMois } from './chiffres'
import type { Reseau } from './modele'

// L'Extérieur dans les chiffres du magasin (vague 9, choix 140, Joseph 14/11/2026) : remplace la feuille « ROI Extérieurs »
// faite à la main. CA du marché extérieur de janvier au dernier mois connu, part dans le CA, évolution sur les mêmes mois
// de l'an dernier, et position parmi les magasins visibles par le compte qui ont un CA extérieur (au moins 5, sinon rien).
// Équipe seulement : la fiche magasin n'existe pas pour le franchisé.
export interface PositionExterieur { n: number; q1: number; mediane: number; q3: number; rang: number; position: 'haut' | 'milieu' | 'bas' }
export interface ExterieurMagasin {
  annee: string; dernierMois: string
  caExt: number; ca: number; part: number | null
  caExtN1: number | null; evolution: number | null // en %
  reseau: PositionExterieur | null
}

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const moisDe = (annee: string, dernier: string) => Array.from({ length: Number(dernier.slice(5, 7)) }, (_, i) => `${annee}-${String(i + 1).padStart(2, '0')}`)
function cumul(liste: ChiffreMois[], mois: string[]): { ext: number | null; ca: number } {
  const parMois = new Map(liste.map((c) => [c.mois, c]))
  const lignes = mois.map((m) => parMois.get(m)).filter((c): c is ChiffreMois => !!c)
  const avecExt = lignes.filter((c) => c.caExt !== null && c.caExt !== undefined)
  return { ext: avecExt.length ? somme(avecExt.map((c) => c.caExt ?? 0)) : null, ca: somme(lignes.map((c) => caDe(c) ?? 0)) }
}
// Quantile à interpolation linéaire (comme percentile_cont de PostgreSQL)
export function quantile(tries: number[], q: number): number {
  if (!tries.length) return 0
  const i = (tries.length - 1) * q, bas = Math.floor(i), haut = Math.ceil(i)
  return tries[bas] + (tries[haut] - tries[bas]) * (i - bas)
}

export function exterieurDe(reseau: Reseau, nom: string): ExterieurMagasin | null {
  const liste = chiffresDuMagasin(reseau, nom)
  const dernierMois = liste.filter((c) => caDe(c) !== null).at(-1)?.mois
  if (!dernierMois) return null
  const annee = dernierMois.slice(0, 4)
  const mois = moisDe(annee, dernierMois)
  const n = cumul(liste, mois)
  const n1 = cumul(liste, mois.map((m) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`))
  const caExt = n.ext ?? 0
  if (!caExt && !n1.ext) return null
  // Les autres magasins, sur les mêmes mois ; seuls ceux qui ont un CA extérieur comptent
  const valeurs = Object.keys(reseau.chiffres).map((x) => (x === nom ? caExt : cumul(reseau.chiffres[x] ?? [], mois).ext ?? 0)).filter((v) => v > 0)
  const tries = [...valeurs].sort((a, b) => a - b)
  let position: PositionExterieur | null = null
  if (caExt > 0 && tries.length >= 5) {
    const q1 = quantile(tries, 0.25), mediane = quantile(tries, 0.5), q3 = quantile(tries, 0.75)
    position = { n: tries.length, q1, mediane, q3, rang: tries.filter((v) => v > caExt).length + 1, position: caExt >= q3 ? 'haut' : caExt < q1 ? 'bas' : 'milieu' }
  }
  return {
    annee, dernierMois, caExt, ca: n.ca, part: n.ca > 0 ? caExt / n.ca : null,
    caExtN1: n1.ext, evolution: n1.ext ? ((caExt - n1.ext) / n1.ext) * 100 : null, reseau: position,
  }
}

// Colonne de la liste des magasins : CA extérieur de l'année en cours (null : aucun chiffre extérieur)
export function caExterieurAnnee(reseau: Reseau, nom: string, annee: string): number | null {
  const l = chiffresDuMagasin(reseau, nom).filter((c) => c.mois.startsWith(`${annee}-`) && c.caExt !== null && c.caExt !== undefined)
  return l.length ? somme(l.map((c) => c.caExt ?? 0)) : null
}
