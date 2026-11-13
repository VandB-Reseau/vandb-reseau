import { expect, test } from '@playwright/test'
import { phraseCA, phraseCADuMois, phraseEBE, phraseFP, phraseMarge } from '../../../src/pilotage/moteur/phrases'

// Choix 119 : chaque modèle de phrase vérifié à la main. Les espaces des nombres français sont insécables : on les normalise.
const n = (s: string | null) => s?.replace(/[  ]/g, ' ') ?? null

test('CA face au budget : écart en % et en k€, cause principale en mots de vendeur', () => {
  // 192 000 réalisés pour 200 000 au budget : −4 %, 8 k€ de moins ; le Bar fait 6 000 des 8 000 € manquants (≥ la moitié)
  const effets = [
    { cle: 'tickets/cave', libelle: 'Tickets Cave', effet: -1_000 }, { cle: 'panier/cave', libelle: 'Panier moyen Cave', effet: -1_000 },
    { cle: 'tickets/bar', libelle: 'Tickets Bar', effet: 1_000 }, { cle: 'panier/bar', libelle: 'Panier moyen Bar', effet: -7_000 },
  ]
  expect(n(phraseCA({ fin: 'septembre', caReel: 192_000, caBudget: 200_000, caN1: null, anneeN1: 2025, effets })))
    .toBe('À fin septembre, tu es 4 % sous ton budget, soit 8 k€ de moins, surtout au Bar, où le panier moyen baisse.')
  // Aucune cause ne fait la moitié de l'écart : pas de « surtout »
  const eparpille = [{ cle: 'ca/cave', libelle: '', effet: -3_000 }, { cle: 'ca/bar', libelle: '', effet: -3_000 }, { cle: 'ca/exterieur', libelle: '', effet: -2_000 }]
  expect(n(phraseCA({ fin: 'septembre', caReel: 192_000, caBudget: 200_000, caN1: null, anneeN1: 2025, effets: eparpille })))
    .toBe('À fin septembre, tu es 4 % sous ton budget, soit 8 k€ de moins.')
  // Au-dessus : 206 000 pour 200 000 = +3 %, grâce aux clients de la Cave (5 000 sur 6 000)
  expect(n(phraseCA({ fin: 'mai', caReel: 206_000, caBudget: 200_000, caN1: null, anneeN1: 2025, effets: [{ cle: 'tickets/cave', libelle: '', effet: 5_000 }, { cle: 'panier/cave', libelle: '', effet: 1_000 }] })))
    .toBe('À fin mai, tu es 3 % au-dessus de ton budget, soit 6 k€ de plus, surtout à la Cave, grâce à plus de clients.')
  // Sous 0,5 % : dans le budget
  expect(phraseCA({ fin: 'mai', caReel: 199_100, caBudget: 200_000, caN1: null, anneeN1: 2025 })).toBe('À fin mai, tu es dans ton budget.')
})

test('CA sans budget : face à l’an dernier, sinon le montant', () => {
  // 110 000 pour 100 000 l'an dernier : +10 %
  expect(n(phraseCA({ fin: 'juin', caReel: 110_000, caBudget: null, caN1: 100_000, anneeN1: 2025 }))).toBe('À fin juin, tu fais 10 % de plus qu’en 2025.')
  expect(n(phraseCA({ fin: 'juin', caReel: 110_000, caBudget: null, caN1: null, anneeN1: 2025 }))).toBe('À fin juin, tu as fait 110 k€ de chiffre d’affaires.')
})

test('marge, frais de personnel et EBE ramenés à 100 € vendus ou en k€', () => {
  // 38,2 % de marge pour 39 % au budget : 38,20 € sur 100 €, 0,80 € de moins
  expect(n(phraseMarge({ taux: 0.382, tauxBudget: 0.39 }))).toBe('Sur 100 € vendus, il te reste 38,20 € de marge, 0,80 € de moins que prévu.')
  expect(n(phraseMarge({ taux: 0.3905, tauxBudget: 0.39 }))).toBe('Sur 100 € vendus, il te reste 39,05 € de marge, comme prévu.')
  expect(phraseMarge({ taux: null, tauxBudget: 0.39 })).toBeNull()
  // 21,5 % de frais de personnel : 21,50 € sur 100 €
  expect(n(phraseFP(0.215))).toBe('Sur 100 € vendus, 21,50 € paient l’équipe.')
  expect(phraseFP(0)).toBeNull()
  // EBE 45 000 pour 48 000 : 3 k€ de moins ; 47 700 : 48 k€ (arrondi au k€ dès 10 k€), comme prévu (écart sous 500 €)
  expect(n(phraseEBE({ valeur: 45_000, budget: 48_000, fin: 'août' }))).toBe('À fin août, il te reste 45 k€ pour rembourser tes emprunts, investir et payer tes impôts, 3 k€ de moins que prévu.')
  expect(n(phraseEBE({ valeur: 47_700, budget: 48_000, fin: null }))).toBe('Sur l’année, il te reste 48 k€ pour rembourser tes emprunts, investir et payer tes impôts, comme prévu.')
})

test('accueil : le CA du mois face au même mois de l’an dernier', () => {
  // −4,23 % arrondi au dixième : 4,2 % de moins ; +0,3 % : autant
  expect(n(phraseCADuMois({ mois: 'septembre 2026', reference: 'septembre 2025', ecartPct: -4.23 }))).toBe('En septembre 2026, tu fais 4,2 % de moins qu’en septembre 2025.')
  expect(phraseCADuMois({ mois: 'septembre 2026', reference: 'septembre 2025', ecartPct: 0.3 })).toBe('En septembre 2026, tu fais autant qu’en septembre 2025.')
  expect(phraseCADuMois({ mois: 'septembre 2026', reference: 'septembre 2025', ecartPct: null })).toBeNull()
})
