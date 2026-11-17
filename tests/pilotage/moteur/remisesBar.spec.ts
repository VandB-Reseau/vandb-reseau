import { expect, test } from '@playwright/test'
import { simulerRemisesBar, type LigneBar } from '../../../src/pilotage/moteur/boiteOutils'
import { parametresParDefaut } from '../../../src/pilotage/moteur/parametres'

// Remises entreprise au bar (Joseph, 17/11/2026). Chiffres fictifs, vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 4) => expect(v).toBeCloseTo(attendu, chiffres)
const p = parametresParDefaut // redevance 2 %, publicité 1 %
const tva = { food: 0.1, soft: 0.1, alcool: 0.2 }
const paliers = [{ min: 0, remise: 0 }, { min: 20, remise: 0.5 }, { min: 50, remise: 1 }]
// Une venue : 1 planche à 11 € TTC (10 € HT, 70 % de marge, achat 3 €) et 2 verres à 6 € TTC (5 € HT, 80 %, achat 1 €)
const panier: LigneBar[] = [
  { libelle: 'Food', nature: 'food', parVenue: 1, prixTTC: 11, taux: 0.7 },
  { libelle: 'Alcool', nature: 'alcool', parVenue: 2, prixTTC: 6, taux: 0.8 },
]
const base = { paliers, lignes: panier, venues: 40, periode: 'semaine' as const, base: 'produit' as const, plancher: 0.25, tva }

test('bar · remise en euros par produit, palier lu sur les venues de la période', () => {
  const r = simulerRemisesBar(base, p)
  expect(r.palier).toBe(1)
  proche(r.remise, 0.5)
  expect(r.produits).toBe(3)
  proche(r.caTTC, 23); proche(r.caHT, 20); proche(r.achat, 5)
  // 0,50 € TTC par produit : 0,50 ÷ 1,1 + 2 × 0,50 ÷ 1,2 = 1,2879 € HT par venue
  proche(r.remiseHT, 0.5 / 1.1 + 1 / 1.2)
  proche(r.caBrut, 800)                         // 40 × 20
  proche(r.caNet, 40 * (20 - 1.287879), 3)      // 748,48
  proche(r.marge, 40 * 13.712121, 3)            // 548,48
  proche(r.margeCedee, 40 * 1.287879, 3)        // 51,52
  proche(r.reste, 40 * 13.150758, 3)            // marge − 3 % du CA remisé
  proche(r.resteSansRemise, 40 * 14.4, 3)       // 15 − 0,60 par venue
  // La remise retire 1,2492 € par venue au reste, soit 49,97 € par semaine ; à 13,15 € par venue remisée : 4 venues en plus
  expect(r.venuesEnPlus).toBe(4)
  proche(r.perteAn, 40 * 1.249242 * 52, 1)      // 2 598,42 €
  expect(r.suivant).toEqual({ index: 2, manque: 10, remise: 1 })
  expect(r.evin).toBe(true)
})

test('bar · remise par panier répartie au prorata du TTC', () => {
  const r = simulerRemisesBar({ ...base, base: 'panier', venues: 60, periode: 'mois' }, p)
  expect(r.palier).toBe(2)
  proche(r.remiseHT, 20 / 23)                   // 1 € TTC × 20 HT ÷ 23 TTC
  expect(r.parAn).toBe(12)
})

test('bar · paliers, creux et plancher', () => {
  const r = simulerRemisesBar(base, p)
  proche(r.paliers[0].resteVenue, 14.4)
  proche(r.paliers[2].remiseHT, 1 / 1.1 + 2 / 1.2)
  // 19 venues à 14,40 € = 273,60 € ; à 13,15 € par venue il en faut 20,8, donc 21
  expect(r.paliers[1].margeRetrouveeA).toBe(21)
  // 49 × 13,1508 = 644,39 € ; à 11,9015 € il en faut 54,1, donc 55
  expect(r.paliers[2].margeRetrouveeA).toBe(55)
  // Remise maximale TTC sur la planche au plancher de 25 % : (10 − 3 ÷ 0,75) × 1,1 = 6,60 €
  proche(r.lignes[0].remiseMax, 6.6)
  expect(r.lignes[0].alerte).toBe('ok')
  // Une remise de 5 € par produit : les verres à 6 € vendus 1 € TTC (0,83 € HT) sous leur achat de 1 €
  const fort = simulerRemisesBar({ ...base, paliers: [{ min: 0, remise: 5 }] }, p)
  expect(fort.lignes[1].alerte).toBe('perte')
})

test('bar · loi Évin : jamais de remise sur l’alcool seul', () => {
  const r = simulerRemisesBar({ ...base, lignes: [panier[1], { ...panier[0], parVenue: 0 }] }, p)
  expect(r.evin).toBe(false)
  const sansRemise = simulerRemisesBar({ ...base, venues: 5, lignes: [panier[1]] }, p)
  expect(sansRemise.evin).toBe(true)
})
