import type { Budget, ReglesCalcul } from './types'

// Points d'attention avant l'envoi du budget (vague 6, Joseph 10/11/2026, 74A) : ce qu'un budget ne devrait pas laisser
// passer sans un mot. Chaque point dit où le corriger (partie du budget) ; s'il reste, une phrase de justification est
// écrite avant l'envoi (commentaire du budget sur l'ancre « attention/<clé> »). Seuils : règles de calcul du Directeur.
export type CleAttention = 'tresorerie' | 'ebe' | 'marge' | 'fp' | 'echeances' | 'ca'
export interface PointAttention { cle: CleAttention; libelle: string; texte: string; partie: string }

export const ancreAttention = (cle: CleAttention) => `attention/${cle}`

const k = (x: number) => `${x < 0 ? '−' : ''}${Math.abs(Math.round(x / 1000)).toLocaleString('fr-FR')} k€`
const pct = (x: number, d = 0) => `${(x * 100).toFixed(d).replace('.', ',')} %`

export function pointsAttention(e: {
  budget: Pick<Budget, 'ca' | 'atterrissage' | 'ebe' | 'tauxMarge' | 'ratios' | 'financement' | 'capaciteAutofinancement'>
  pointBas: { montant: number; mois: number } | null
  tauxMargeSiege: number | null
  regles: Pick<ReglesCalcul, 'attentionMarge' | 'attentionFPMin' | 'attentionFPMax' | 'attentionCA'>
}, mois: readonly string[]): PointAttention[] {
  const { budget: b, regles: r } = e
  const p: PointAttention[] = []
  if (e.pointBas && e.pointBas.montant < 0) {
    p.push({ cle: 'tresorerie', libelle: 'Trésorerie sous zéro', partie: 'visualiser', texte: `La trésorerie descend à ${k(e.pointBas.montant)} en ${mois[e.pointBas.mois]}.` })
  }
  if (b.ebe < 0) p.push({ cle: 'ebe', libelle: 'EBE négatif', partie: 'budget', texte: `L’EBE de l’année est négatif : ${k(b.ebe)}.` })
  if (e.tauxMargeSiege !== null && e.tauxMargeSiege - b.tauxMarge > r.attentionMarge + 1e-9) {
    const ecart = e.tauxMargeSiege - b.tauxMarge
    p.push({ cle: 'marge', libelle: 'Marge sous la proposition du siège', partie: 'ventes', texte: `Le taux de marge (${pct(b.tauxMarge, 1)}) est ${(ecart * 100).toFixed(1).replace('.', ',')} pt sous celui proposé par le siège (${pct(e.tauxMargeSiege, 1)}).` })
  }
  if (b.ca > 0 && (b.ratios.pctFP < r.attentionFPMin - 1e-9 || b.ratios.pctFP > r.attentionFPMax + 1e-9)) {
    const bas = b.ratios.pctFP < r.attentionFPMin
    p.push({ cle: 'fp', libelle: bas ? '% FP bas' : '% FP élevé', partie: 'equipe', texte: `Les frais de personnel font ${pct(b.ratios.pctFP, 1)} du CA HT, ${bas ? `sous ${pct(r.attentionFPMin)}` : `au-dessus de ${pct(r.attentionFPMax)}`}.` })
  }
  const f = b.financement
  if (f.echeances > 0 && (b.capaciteAutofinancement <= 0 || f.echeances > b.capaciteAutofinancement + 1e-9)) {
    p.push({ cle: 'echeances', libelle: 'Échéances au-dessus de la capacité d’autofinancement', partie: 'investissements', texte: `Les échéances d’emprunt (${k(f.echeances)}) dépassent la capacité d’autofinancement (${k(b.capaciteAutofinancement)}).` })
  }
  if (b.atterrissage > 0 && b.ca / b.atterrissage - 1 > r.attentionCA + 1e-9) {
    p.push({ cle: 'ca', libelle: 'CA très au-dessus de l’atterrissage', partie: 'ventes', texte: `Le CA du budget (${k(b.ca)}) dépasse l’atterrissage (${k(b.atterrissage)}) de ${pct(b.ca / b.atterrissage - 1)}, au-delà de ${pct(r.attentionCA)}.` })
  }
  return p
}

// Points encore sans justification : ceux qui bloquent l'envoi
export function pointsSansJustification(points: PointAttention[], ancresCommentees: Iterable<string>): PointAttention[] {
  const faites = new Set(ancresCommentees)
  return points.filter((x) => !faites.has(ancreAttention(x.cle)))
}
