import { expect, test } from '@playwright/test'
import { ancreAttention, pointsAttention, pointsSansJustification } from '../../../src/pilotage/moteur/attention'
import { ancreEcart, causesDuMois, ecartsDuMois, ecrireExplication, lireAncreEcart, lireExplication } from '../../../src/pilotage/moteur/causesEcarts'
import { reglesParDefaut } from '../../../src/pilotage/moteur/regles'
import { fraisResolus } from '../../../src/pilotage/moteur/communication'
import { fraisDuBudget } from '../../../src/pilotage/moteur/fraisBudget'
import type { MoisReel } from '../../../src/pilotage/moteur/suivi'

// Vague 6 (Joseph, 10/11/2026) : points d'attention avant l'envoi du budget (74) et causes des écarts du mois (77).
// Magasin fictif, chaque résultat se vérifie à la main.
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const fin = (echeances: number) => ({ echeances }) as never

// Budget sain : CA 600 k€ pour 560 k€ atterris (+7,1 %), EBE 40 k€, marge 38 %, % FP 22 %, échéances 20 k€ pour 45 k€ de CAF
const sain = { ca: 600_000, atterrissage: 560_000, ebe: 40_000, tauxMarge: 0.38, ratios: { pctFP: 0.22, ebeSurCA: 0.067 }, financement: fin(20_000), capaciteAutofinancement: 45_000 }

test('budget sain : aucun point d’attention', () => {
  expect(pointsAttention({ budget: sain, pointBas: { montant: 5_000, mois: 0 }, tauxMargeSiege: 0.385, regles: reglesParDefaut }, MOIS)).toEqual([])
})

test('chaque point d’attention, au-delà du seuil du Directeur', () => {
  // Trésorerie −29 k€ en janvier ; EBE −2 k€ ; marge 36,5 % pour 38 % au siège (1,5 pt > 1 pt) ; % FP 31 % (> 30 %) ;
  // échéances 50 k€ pour 45 k€ de CAF ; CA 630 k€ pour 560 k€ atterris (+12,5 % > 10 %)
  const b = { ...sain, ca: 630_000, ebe: -2_000, tauxMarge: 0.365, ratios: { pctFP: 0.31, ebeSurCA: 0 }, financement: fin(50_000) }
  const p = pointsAttention({ budget: b, pointBas: { montant: -29_000, mois: 0 }, tauxMargeSiege: 0.38, regles: reglesParDefaut }, MOIS)
  expect(p.map((x) => [x.cle, x.partie])).toEqual([['tresorerie', 'visualiser'], ['ebe', 'budget'], ['marge', 'ventes'], ['fp', 'equipe'], ['echeances', 'investissements'], ['ca', 'ventes']])
  expect(p[0].texte).toBe('La trésorerie descend à −29 k€ en janvier.')
  expect(p[2].texte).toBe('Le taux de marge (36,5 %) est 1,5 pt sous celui proposé par le siège (38,0 %).')
  expect(p[3].texte).toBe('Les frais de personnel font 31,0 % du CA HT, au-dessus de 30 %.')
  expect(p[5].texte).toBe('Le CA du budget (630 k€) dépasse l’atterrissage (560 k€) de 13 %, au-delà de 10 %.')
})

test('seuils tout juste atteints : pas de point ; seuils réglés autrement : le point apparaît', () => {
  // Marge 1 pt pile sous le siège, % FP 30 % pile, CA +10 % pile
  const b = { ...sain, ca: 616_000, tauxMarge: 0.37, ratios: { pctFP: 0.3, ebeSurCA: 0 } }
  expect(pointsAttention({ budget: b, pointBas: null, tauxMargeSiege: 0.38, regles: reglesParDefaut }, MOIS)).toEqual([])
  const r = { ...reglesParDefaut, attentionMarge: 0.005, attentionFPMax: 0.28, attentionCA: 0.05 }
  expect(pointsAttention({ budget: b, pointBas: null, tauxMargeSiege: 0.38, regles: r }, MOIS).map((x) => x.cle)).toEqual(['marge', 'fp', 'ca'])
  // Sans proposition du siège, pas de comparaison de marge ; % FP sous 10 %
  expect(pointsAttention({ budget: { ...sain, ratios: { pctFP: 0.08, ebeSurCA: 0 } }, pointBas: null, tauxMargeSiege: null, regles: reglesParDefaut }, MOIS).map((x) => [x.cle, x.libelle])).toEqual([['fp', '% FP bas']])
  // Capacité d'autofinancement nulle avec des échéances : point ; sans échéance : rien
  expect(pointsAttention({ budget: { ...sain, capaciteAutofinancement: 0 }, pointBas: null, tauxMargeSiege: null, regles: reglesParDefaut }, MOIS).map((x) => x.cle)).toEqual(['echeances'])
  expect(pointsAttention({ budget: { ...sain, capaciteAutofinancement: 0, financement: fin(0) }, pointBas: null, tauxMargeSiege: null, regles: reglesParDefaut }, MOIS)).toEqual([])
})

test('un point justifié ne bloque plus l’envoi', () => {
  const b = { ...sain, ebe: -2_000 }
  const p = pointsAttention({ budget: b, pointBas: { montant: -1_000, mois: 6 }, tauxMargeSiege: null, regles: reglesParDefaut }, MOIS)
  expect(p.map((x) => x.cle)).toEqual(['tresorerie', 'ebe'])
  expect(ancreAttention('ebe')).toBe('attention/ebe')
  expect(pointsSansJustification(p, ['attention/ebe', 'theme/ventes']).map((x) => x.cle)).toEqual(['tresorerie'])
})

const mois = (caHT: number, margeHT: number): MoisReel => ({ caHT, margeHT, caAvecMarge: caHT, caTTC: caHT * 1.2, tickets: 0 })
const vide = mois(0, 0)

test('écarts du mois : CA 5 % sous le budget, marge 1 point sous l’an dernier', () => {
  // Septembre : 47 k€ pour 50 k€ au budget (−6 %) ; marge 17 860 € sur 47 k€ = 38 %, contre 39,5 % en septembre dernier (−1,5 pt)
  const n = Array.from({ length: 12 }, (_, i) => (i === 8 ? mois(47_000, 17_860) : i < 8 ? mois(50_000, 20_000) : vide))
  const n1 = Array.from({ length: 12 }, () => mois(40_000, 15_800))
  const budget = { mois: Array.from({ length: 12 }, () => ({ ca: 50_000 })) } as never
  const e = ecartsDuMois(9, n, n1, budget, { ecartCA: 0.05, baisseMarge: 0.01 })
  expect(e.map((x) => [x.indicateur, Math.round(x.ecart * 1000) / 1000])).toEqual([['ca', -0.06], ['marge', -0.015]])
  // Août : 50 k€ au budget, marge 40 % contre 39,5 % : rien à expliquer ; mois sans réel : rien
  expect(ecartsDuMois(8, n, n1, budget, { ecartCA: 0.05, baisseMarge: 0.01 })).toEqual([])
  expect(ecartsDuMois(10, n, n1, budget, { ecartCA: 0.05, baisseMarge: 0.01 })).toEqual([])
  // Sans budget : seule la marge se compare
  expect(ecartsDuMois(9, n, n1, null, { ecartCA: 0.05, baisseMarge: 0.01 }).map((x) => x.indicateur)).toEqual(['marge'])
})

test('explications rangées en commentaires et comptées pour le réseau', () => {
  expect(ancreEcart(2026, 9, 'ca')).toBe('ecart/2026-09/ca')
  expect(lireAncreEcart('ecart/2026-09/marge')).toEqual({ annee: 2026, mois: 9, indicateur: 'marge' })
  expect(lireAncreEcart('theme/ventes')).toBeNull()
  expect(ecrireExplication('rupture', ' Fûts de blonde manquants deux semaines ')).toBe('Rupture : Fûts de blonde manquants deux semaines')
  expect(ecrireExplication('meteo', '')).toBe('Météo')
  expect(lireExplication('Rupture : Fûts manquants')).toEqual({ cause: 'rupture', phrase: 'Fûts manquants' })
  expect(lireExplication('Météo')).toEqual({ cause: 'meteo', phrase: '' })
  expect(lireExplication('texte libre')).toEqual({ cause: 'autre', phrase: 'texte libre' })
  const l = [
    { magasin: 'Arlanc', ancre: 'ecart/2026-09/ca', texte: 'Rupture : Bar' },
    { magasin: 'Arlanc', ancre: 'ecart/2026-09/ca', texte: 'Météo', },          // deuxième explication du même écart : ignorée
    { magasin: 'Arlanc', ancre: 'ecart/2026-09/marge', texte: 'Prix : promotions' },
    { magasin: 'Brionne', ancre: 'ecart/2026-09/ca', texte: 'Rupture' },
    { magasin: 'Brionne', ancre: 'ecart/2026-09/ca', texte: 'Merci', parent: 4 }, // réponse : ignorée
    { magasin: 'Brionne', ancre: 'ecart/2026-08/ca', texte: 'Météo' },            // autre mois
  ]
  expect(causesDuMois(l, 2026, 9)).toEqual([{ cause: 'rupture', libelle: 'Rupture', n: 2 }, { cause: 'prix', libelle: 'Prix', n: 1 }])
})

test('budget communication : 2,5 % du CA quand le Directeur le règle, le choix du magasin reste le sien', () => {
  const base = { frais: [
    { code: 'loyer', libelle: 'Loyer', rubrique: 'immobilier' as const, annuel: 36_000 },
    { code: 'budget_communication', libelle: 'Budget communication annuel', rubrique: 'communication' as const, annuel: 6_000 },
  ], amortissements: 0, interets: 0, remboursementCapital: 0 }
  // Sans choix : la ligne suit le réseau ; sans taux réglé, ses 6 000 € (+ 2 % d'inflation = 6 120 €) restent
  const sansChoix = fraisDuBudget(base, undefined, 0.02).frais
  expect(sansChoix[1]).toEqual({ code: 'budget_communication', libelle: 'Budget communication annuel', rubrique: 'communication', annuel: 6_120, communicationReseau: true })
  expect(fraisResolus(sansChoix, {})).toEqual(sansChoix)
  // Taux réglé à 2,5 % : la ligne passe en part du CA (600 000 € de CA : 15 000 €)
  const regle = fraisResolus(sansChoix, { tauxCommunication: 0.025 })
  expect(regle[1]).toEqual({ code: 'budget_communication', libelle: 'Budget communication annuel', rubrique: 'communication', tauxCA: 0.025, communicationReseau: true })
  expect(regle[0]).toEqual(sansChoix[0])
  // Montant choisi par le magasin : il le garde
  const choisi = fraisDuBudget(base, { budget_communication: { mode: 'montant', valeur: 9_000 } }, 0.02).frais
  expect(fraisResolus(choisi, { tauxCommunication: 0.025 })[1]).toEqual({ code: 'budget_communication', libelle: 'Budget communication annuel', rubrique: 'communication', annuel: 9_000 })
  // Magasin sans budget communication : ligne à 0 €, retirée tant que le taux n'est pas réglé
  const sansLigne = fraisDuBudget({ ...base, frais: [base.frais[0]] }, undefined, 0).frais
  expect(fraisResolus(sansLigne, {}).map((l) => l.code)).toEqual(['loyer'])
  expect(fraisResolus(sansLigne, { tauxCommunication: 0.025 })[1]).toMatchObject({ code: 'budget_communication', tauxCA: 0.025 })
})
