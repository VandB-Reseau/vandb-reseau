import { expect, test } from '@playwright/test'
import { simulerRemisesBar, type LigneBar } from '../../../src/pilotage/moteur/boiteOutils'

// Remises entreprise au bar (Joseph, 17/11/2026) : on part des venues habituelles, sans remise ; pour chaque remise,
// combien de venues de plus pour garder la même masse de marge. Chiffres fictifs, vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 4) => expect(v).toBeCloseTo(attendu, chiffres)
const tva = { food: 0.1, soft: 0.1, alcool: 0.2 }
const paliers = [{ remise: 1 }, { remise: 0.5 }] // saisies dans le désordre
// Une venue : 1 planche à 11 € TTC (10 € HT, 70 % de marge, achat 3 €) et 2 verres à 6 € TTC (5 € HT, 80 %, achat 1 €)
const panier: LigneBar[] = [
  { libelle: 'Food', nature: 'food', parVenue: 1, prixTTC: 11, taux: 0.7 },
  { libelle: 'Alcool', nature: 'alcool', parVenue: 2, prixTTC: 6, taux: 0.8 },
]
const base = { paliers, lignes: panier, habituelles: 40, periode: 'semaine' as const, base: 'produit' as const, plancher: 0.25, tva }

test('bar · aujourd’hui : les venues habituelles, sans remise', () => {
  const r = simulerRemisesBar(base)
  expect(r.produits).toBe(3)
  proche(r.caTTC, 23); proche(r.caHT, 20); proche(r.achat, 5)
  proche(r.margeVenue, 15)                       // 20 − 5
  proche(r.marge, 600)                           // 40 × 15 par semaine
  proche(r.taux, 0.75)
  expect(r.parAn).toBe(52)
})

test('bar · venues en plus pour garder la même masse de marge, remise par remise', () => {
  const r = simulerRemisesBar(base)
  expect(r.paliers.map((x) => x.remise)).toEqual([0.5, 1])
  const [a, b] = r.paliers
  // 0,50 € TTC par produit : 0,50 ÷ 1,1 + 2 × 0,50 ÷ 1,2 = 1,2879 € HT ; marge 13,7121 € par venue
  proche(a.remiseHT, 0.5 / 1.1 + 1 / 1.2)
  proche(a.margeVenue, 13.712121, 5)
  // 600 ÷ 13,7121 = 43,76 : 44 venues, 4 de plus (+ 10 %)
  expect(a.venues).toBe(44)
  expect(a.enPlus).toBe(4)
  proche(a.hausse, 0.1)
  proche(a.marge, 44 * 13.712121, 3)             // 603,33 € ≥ 600 €
  // 1 € : 2,5758 € HT, marge 12,4242 € ; 600 ÷ 12,4242 = 48,29 : 49 venues, 9 de plus
  proche(b.margeVenue, 12.424242, 5)
  expect(b.enPlus).toBe(9)
  expect(r.remiseForte).toBe(1)
})

test('bar · une remise qui ne laisse plus de marge ne se compense jamais', () => {
  // 20 € par produit : chaque produit offert, la venue remisée coûte l'achat
  const r = simulerRemisesBar({ ...base, paliers: [{ remise: 20 }] })
  expect(r.paliers[0].enPlus).toBeNull()
  expect(r.paliers[0].venues).toBeNull()
  // 5 € par produit : les verres à 6 € vendus 1 € TTC (0,83 € HT) sous leur achat de 1 €
  expect(simulerRemisesBar({ ...base, paliers: [{ remise: 5 }] }).lignes[1].alerte).toBe('perte')
})

test('bar · remise par panier, au mois, sans venue habituelle', () => {
  const r = simulerRemisesBar({ ...base, base: 'panier', periode: 'mois' })
  proche(r.paliers[0].remiseHT, 0.5 * 20 / 23)   // 0,50 € TTC × 20 HT ÷ 23 TTC
  // marge 14,5652 € ; 600 ÷ 14,5652 = 41,19 : 42 venues, 2 de plus
  expect(r.paliers[0].enPlus).toBe(2)
  expect(r.parAn).toBe(12)
  const nouvelle = simulerRemisesBar({ ...base, habituelles: 0 })
  expect(nouvelle.paliers[0].enPlus).toBe(0)
  expect(nouvelle.paliers[0].hausse).toBeNull()
})

test('bar · détail du panier à la remise la plus forte, plancher', () => {
  const r = simulerRemisesBar(base)
  // Remise maximale TTC sur la planche au plancher de 25 % : (10 − 3 ÷ 0,75) × 1,1 = 6,60 €
  proche(r.lignes[0].remiseMax, 6.6)
  // Planche à 1 € de remise : 10 − 0,909 = 9,091 € HT, marge 6,091 €
  proche(r.lignes[0].margeApres, 10 - 1 / 1.1 - 3)
  expect(r.lignes[0].alerte).toBe('ok')
})

test('bar · loi Évin : jamais de remise sur l’alcool seul', () => {
  const r = simulerRemisesBar({ ...base, lignes: [panier[1], { ...panier[0], parVenue: 0 }] })
  expect(r.evin).toBe(false)
  const sansRemise = simulerRemisesBar({ ...base, paliers: [], lignes: [panier[1]] })
  expect(sansRemise.evin).toBe(true)
})
