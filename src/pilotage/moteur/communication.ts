import type { LigneFrais } from './types'

// Budget communication (Joseph, 10/11/2026 : « généralement à 2,5 % du CA par an ») : taux réglé par le Directeur dans
// Paramètres (absent ou 0 : rien ne change). La ligne « Budget communication annuel » d'un budget sans choix du magasin
// suit ce taux du CA HT ; un montant ou une hausse choisis par le magasin restent les siens.
export const CODE_COMMUNICATION = 'budget_communication'
export const LIBELLE_COMMUNICATION = 'Budget communication annuel'

export function fraisResolus(frais: LigneFrais[], p: { tauxCommunication?: number }): LigneFrais[] {
  const t = p.tauxCommunication ?? 0
  // Sans taux réglé : la ligne ajoutée d'office (0 €) disparaît, rien ne change
  if (!(t > 0)) return frais.filter((l) => !(l.communicationReseau && !l.annuel && !l.tauxCA))
  return frais.map((l) => (l.communicationReseau ? { code: l.code, libelle: l.libelle, rubrique: l.rubrique, tauxCA: t, communicationReseau: true } : l))
}
