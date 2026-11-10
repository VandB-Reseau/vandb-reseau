import { lignesFrais, type LigneGrille } from './parametres'
import { CODE_COMMUNICATION, LIBELLE_COMMUNICATION } from './communication'
import type { Hypotheses, LigneFrais, Rubrique } from './types'

// Lot 35 (Joseph, 02/11/2026) : frais du budget ligne par ligne, à partir des frais de l'année en cours. Pour chaque
// ligne : même montant, hausse en %, ou nouveau montant. Sans choix, les frais annuels suivent l'inflation des
// hypothèses ; ceux en part du CA gardent leur taux ; amortissements, intérêts et capital remboursé gardent leur montant.
// partCA (Joseph, 10/11/2026) : la ligne passe en part du CA HT, valeur = taux (0,025 pour 2,5 %) ; sert au budget
// communication, préconisation du siège que chaque magasin règle en % du CA ou en montant
export type ModeFrais = 'meme' | 'taux' | 'montant' | 'partCA'
// libelle et rubrique : ligne nouvelle au budget, telle que la grille la nommait au moment du choix (lot 40)
export interface ChoixFrais { mode: ModeFrais; valeur?: number; libelle?: string; rubrique?: Rubrique }
// Clés des montants sous l'EBE, à côté des codes des lignes de frais
export const FINANCES_BUDGET = { amortissements: 'Dotations aux amortissements', interets: 'Intérêts et charges assimilées', remboursementCapital: 'Capital d’emprunts remboursé' } as const
export type CleFinance = keyof typeof FINANCES_BUDGET
export const CLES_FINANCES = Object.keys(FINANCES_BUDGET) as CleFinance[]

export interface LigneFraisBudget {
  code: string; libelle: string; rubrique: Rubrique | 'finances'
  avant: number                 // montant annuel de l'année en cours (0 pour une ligne nouvelle)
  tauxCA?: number               // ligne en part du CA : son taux au budget
  tauxAvant?: number            // ligne en part du CA dans l'année en cours : son taux
  choix: ChoixFrais; parDefaut: boolean
  apres: number                 // montant annuel du budget (lignes en part du CA : 0, calculées sur le CA)
  depuisPrets?: boolean         // intérêts et capital tirés des prêts du magasin (03/11/2026), sans choix possible
}
type Base = Pick<Hypotheses, 'frais' | 'amortissements' | 'interets' | 'remboursementCapital'>

const defini = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v)
function montantApres(avant: number, c: ChoixFrais): number {
  if (c.mode === 'taux') return avant * (1 + (c.valeur ?? 0))
  if (c.mode === 'montant') return defini(c.valeur) ? c.valeur : avant
  return avant
}

export function lignesFraisBudget(base: Base, choix: Record<string, ChoixFrais> | undefined, inflation: number, grille: LigneGrille[] = lignesFrais, tauxCommunication = 0): LigneFraisBudget[] {
  const ch = choix ?? {}
  // Budget communication sans choix du magasin : au taux du réseau quand il est réglé (10/11/2026)
  const communication = (code: string) => code === CODE_COMMUNICATION && tauxCommunication > 0 && !ch[code]
  const enPartCA = (c: ChoixFrais | undefined): c is ChoixFrais & { valeur: number } => c?.mode === 'partCA' && defini(c.valeur)
  const lignes: LigneFraisBudget[] = base.frais.map((l) => {
    const c = ch[l.code]
    if (enPartCA(c)) return { code: l.code, libelle: l.libelle, rubrique: l.rubrique, avant: l.annuel ?? 0, ...(defini(l.tauxCA) ? { tauxAvant: l.tauxCA } : {}), tauxCA: c.valeur, choix: c, parDefaut: false, apres: 0 }
    if (communication(l.code)) return { code: l.code, libelle: l.libelle, rubrique: l.rubrique, avant: l.annuel ?? 0, tauxCA: tauxCommunication, choix: { mode: 'meme' }, parDefaut: true, apres: 0 }
    if (defini(l.tauxCA) && ch[l.code]?.mode !== 'montant') {
      return { code: l.code, libelle: l.libelle, rubrique: l.rubrique, avant: 0, tauxAvant: l.tauxCA, tauxCA: l.tauxCA, choix: { mode: 'meme' }, parDefaut: true, apres: 0 }
    }
    const avant = l.annuel ?? 0
    const choix = c && c.mode !== 'partCA' ? c : { mode: 'taux' as const, valeur: inflation }
    return { code: l.code, libelle: l.libelle, rubrique: l.rubrique, avant, ...(defini(l.tauxCA) ? { tauxAvant: l.tauxCA } : {}), choix, parDefaut: choix !== c, apres: montantApres(avant, choix) }
  })
  if (communication(CODE_COMMUNICATION) && !base.frais.some((l) => l.code === CODE_COMMUNICATION)) {
    lignes.push({ code: CODE_COMMUNICATION, libelle: LIBELLE_COMMUNICATION, rubrique: 'communication', avant: 0, tauxCA: tauxCommunication, choix: { mode: 'meme' }, parDefaut: true, apres: 0 })
  }
  // Ligne nouvelle au budget : absente de l'année en cours, avec un montant
  for (const [code, c] of Object.entries(ch)) {
    if ((c.mode !== 'montant' && c.mode !== 'partCA') || !defini(c.valeur) || base.frais.some((l) => l.code === code) || code in FINANCES_BUDGET) continue
    const g = grille.find((l) => l.code === code) ?? (c.libelle && c.rubrique ? { libelle: c.libelle, rubrique: c.rubrique } : null)
    if (!g) continue
    lignes.push(c.mode === 'partCA' ? { code, libelle: g.libelle, rubrique: g.rubrique, avant: 0, tauxCA: c.valeur, choix: c, parDefaut: false, apres: 0 }
      : { code, libelle: g.libelle, rubrique: g.rubrique, avant: 0, choix: c, parDefaut: false, apres: c.valeur })
  }
  for (const k of CLES_FINANCES) {
    const avant = base[k] ?? 0
    const c = ch[k] ?? { mode: 'meme' as const }
    lignes.push({ code: k, libelle: FINANCES_BUDGET[k], rubrique: 'finances', avant, choix: c, parDefaut: !ch[k], apres: montantApres(avant, c) })
  }
  return lignes
}

// Frais et montants sous l'EBE du budget, à mettre dans ses hypothèses
export function fraisDuBudget(base: Base, choix: Record<string, ChoixFrais> | undefined, inflation: number): Base {
  const l = lignesFraisBudget(base, choix, inflation)
  const fin = (k: CleFinance) => l.find((x) => x.code === k)!.apres
  return {
    frais: [
      ...l.filter((x) => x.rubrique !== 'finances').map((x): LigneFrais => ({
        code: x.code, libelle: x.libelle, rubrique: x.rubrique as Rubrique, ...(defini(x.tauxCA) ? { tauxCA: x.tauxCA } : { annuel: x.apres }),
        ...(x.code === CODE_COMMUNICATION && x.parDefaut && !defini(x.tauxCA) ? { communicationReseau: true } : {}),
      })),
      // Sans budget communication dans les frais de l'année : la ligne suit le taux du réseau, 0 tant qu'il n'est pas réglé
      ...(l.some((x) => x.code === CODE_COMMUNICATION) ? [] : [{ code: CODE_COMMUNICATION, libelle: LIBELLE_COMMUNICATION, rubrique: 'communication' as Rubrique, annuel: 0, communicationReseau: true }]),
    ],
    amortissements: fin('amortissements'), interets: fin('interets'), remboursementCapital: fin('remboursementCapital'),
  }
}

// Prêts du magasin (03/11/2026) : intérêts et capital de chaque année ajoutés aux lignes sous l'EBE, qui ne gardent
// des frais que les comptes courants et les agios (voir avecPrets)
export interface PretsDeuxAnnees { avant: { interets: number; capital: number }; apres: { interets: number; capital: number } }
export function avecPretsBudget(lignes: LigneFraisBudget[], prets: PretsDeuxAnnees | null | undefined): LigneFraisBudget[] {
  if (!prets) return lignes
  return lignes.map((l) => l.code === 'interets' ? { ...l, avant: l.avant + prets.avant.interets, apres: l.apres + prets.apres.interets, depuisPrets: true }
    : l.code === 'remboursementCapital' ? { ...l, avant: prets.avant.capital, apres: prets.apres.capital, depuisPrets: true }
    : l)
}
