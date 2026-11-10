import { expect, test } from '@playwright/test'
import { fraisResolus } from '../../../src/pilotage/moteur/communication'
import { fraisDuBudget, lignesFraisBudget } from '../../../src/pilotage/moteur/fraisBudget'

// Budget communication (Joseph, 10/11/2026) : préconisation du siège (2,5 % du CA), pas une redevance ; le magasin la
// règle en part du CA ou en montant. Magasin fictif, chaque résultat se vérifie à la main.
const base = { frais: [
  { code: 'loyer', libelle: 'Loyer', rubrique: 'immobilier' as const, annuel: 36_000 },
  { code: 'budget_communication', libelle: 'Budget communication annuel', rubrique: 'communication' as const, annuel: 6_000 },
], amortissements: 0, interets: 0, remboursementCapital: 0 }

test('le magasin choisit 1,5 % du CA : la ligne passe en part du CA et le taux du siège ne la touche plus', () => {
  const choix = { budget_communication: { mode: 'partCA' as const, valeur: 0.015 } }
  const l = lignesFraisBudget(base, choix, 0.02, undefined, 0.025).find((x) => x.code === 'budget_communication')!
  // 2026 : 6 000 € ; 2027 : 1,5 % du CA, choix propre au magasin
  expect(l).toMatchObject({ avant: 6_000, tauxCA: 0.015, parDefaut: false, apres: 0 })
  expect(l.tauxAvant).toBeUndefined()
  const frais = fraisDuBudget(base, choix, 0.02).frais
  expect(frais[1]).toEqual({ code: 'budget_communication', libelle: 'Budget communication annuel', rubrique: 'communication', tauxCA: 0.015 })
  // Le taux du réseau (2,5 %) ne remplace pas le choix du magasin
  expect(fraisResolus(frais, { tauxCommunication: 0.025 })[1]).toMatchObject({ tauxCA: 0.015 })
  // Le loyer suit l'inflation : 36 000 × 1,02 = 36 720 €
  expect(frais[0]).toMatchObject({ annuel: 36_720 })
})

test('sans choix, la préconisation du siège ; en montant, 4 000 € ; magasin sans ligne : la part du CA s’ajoute', () => {
  const preco = lignesFraisBudget(base, undefined, 0.02, undefined, 0.025).find((x) => x.code === 'budget_communication')!
  expect(preco).toMatchObject({ avant: 6_000, tauxCA: 0.025, parDefaut: true })
  const montant = fraisDuBudget(base, { budget_communication: { mode: 'montant', valeur: 4_000 } }, 0.02).frais[1]
  expect(montant).toEqual({ code: 'budget_communication', libelle: 'Budget communication annuel', rubrique: 'communication', annuel: 4_000 })
  // Magasin sans budget communication en 2026 qui choisit 2 % du CA
  const sansLigne = { ...base, frais: [base.frais[0]] }
  const ajoutee = fraisDuBudget(sansLigne, { budget_communication: { mode: 'partCA', valeur: 0.02 } }, 0).frais
  expect(ajoutee.find((x) => x.code === 'budget_communication')).toEqual({ code: 'budget_communication', libelle: 'Budget communication annuel', rubrique: 'communication', tauxCA: 0.02 })
})
