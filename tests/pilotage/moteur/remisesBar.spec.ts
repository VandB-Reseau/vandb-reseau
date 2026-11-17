import { expect, test } from '@playwright/test'
import { simulerRemisesBar, type LigneBar } from '../../../src/pilotage/moteur/boiteOutils'
import { parametresParDefaut } from '../../../src/pilotage/moteur/parametres'

// Remises entreprise au bar (Joseph, 17/11/2026) : on part des venues habituelles, sans remise, et chaque palier
// propose une remise si la société vient X fois de plus. Chiffres fictifs, vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 4) => expect(v).toBeCloseTo(attendu, chiffres)
const p = parametresParDefaut // redevance 2 %, publicité 1 %
const tva = { food: 0.1, soft: 0.1, alcool: 0.2 }
const paliers = [{ plus: 30, remise: 1 }, { plus: 10, remise: 0.5 }] // saisis dans le désordre
// Une venue : 1 planche à 11 € TTC (10 € HT, 70 % de marge, achat 3 €) et 2 verres à 6 € TTC (5 € HT, 80 %, achat 1 €)
const panier: LigneBar[] = [
  { libelle: 'Food', nature: 'food', parVenue: 1, prixTTC: 11, taux: 0.7 },
  { libelle: 'Alcool', nature: 'alcool', parVenue: 2, prixTTC: 6, taux: 0.8 },
]
const base = { paliers, lignes: panier, habituelles: 40, periode: 'semaine' as const, base: 'produit' as const, plancher: 0.25, tva }

test('bar · aujourd’hui : les venues habituelles, sans remise', () => {
  const r = simulerRemisesBar(base, p)
  expect(r.produits).toBe(3)
  proche(r.caTTC, 23); proche(r.caHT, 20); proche(r.achat, 5)
  expect(r.aujourdhui.venues).toBe(40)
  proche(r.aujourdhui.resteVenue, 14.4)          // 20 − 5 − 3 % de 20
  proche(r.aujourdhui.reste, 576)                // 40 × 14,40 par semaine
  proche(r.aujourdhui.gain, 0)
  expect(r.parAn).toBe(52)
})

test('bar · paliers au-dessus des habitudes : gain face à aujourd’hui et remise payée dès', () => {
  const r = simulerRemisesBar(base, p)
  expect(r.paliers.map((x) => x.plus)).toEqual([10, 30])
  const [p1, p2] = r.paliers
  // 0,50 € TTC par produit : 0,50 ÷ 1,1 + 2 × 0,50 ÷ 1,2 = 1,2879 € HT par venue ; reste 13,1508 € par venue
  proche(p1.remiseHT, 0.5 / 1.1 + 1 / 1.2)
  proche(p1.resteVenue, 13.150758, 5)
  expect(p1.venues).toBe(50)
  // 50 × 13,1508 = 657,54 € contre 576 € aujourd'hui : + 81,54 € par semaine, 4 239,97 € par an
  proche(p1.gain, 81.5379, 3)
  proche(p1.gainAn, 4239.97, 1)
  // La remise retire 40 × 1,2492 = 49,97 € aux venues habituelles ; à 13,15 € par venue remisée : 4 venues de plus
  expect(p1.payeeDes).toBe(4)
  // 1 € : 2,5758 € HT par venue, reste 11,9015 € ; 70 × 11,9015 = 833,11 €, + 257,11 € par semaine
  proche(p2.resteVenue, 11.901515, 5)
  proche(p2.gain, 257.106, 2)
  // 40 × 2,4985 = 99,94 € ÷ 11,9015 = 8,4 : 9 venues de plus
  expect(p2.payeeDes).toBe(9)
  expect(r.meilleur).toBe(1)
  expect(r.remiseForte).toBe(1)
})

test('bar · un palier trop généreux fait perdre, une remise trop forte ne se rattrape jamais', () => {
  // + 2 venues seulement pour 1 € : 42 × 11,9015 = 499,86 € < 576 €
  const r = simulerRemisesBar({ ...base, paliers: [{ plus: 2, remise: 1 }] }, p)
  expect(r.paliers[0].gain).toBeLessThan(0)
  expect(r.meilleur).toBeNull()
  // 20 € par produit : chaque produit offert, la venue remisée coûte l'achat
  const fort = simulerRemisesBar({ ...base, paliers: [{ plus: 10, remise: 20 }] }, p)
  expect(fort.paliers[0].payeeDes).toBeNull()
  // 5 € par produit : les verres à 6 € vendus 1 € TTC (0,83 € HT) sous leur achat de 1 €
  expect(simulerRemisesBar({ ...base, paliers: [{ plus: 10, remise: 5 }] }, p).lignes[1].alerte).toBe('perte')
})

test('bar · remise par panier, au mois, nouvelle société', () => {
  const r = simulerRemisesBar({ ...base, base: 'panier', periode: 'mois', habituelles: 0 }, p)
  proche(r.paliers[0].remiseHT, 0.5 * 20 / 23)   // 0,50 € TTC × 20 HT ÷ 23 TTC
  expect(r.parAn).toBe(12)
  expect(r.paliers[0].payeeDes).toBe(0)           // rien à perdre sur des venues qui n'existent pas
  proche(r.paliers[0].gain, 10 * r.paliers[0].resteVenue)
})

test('bar · détail du panier à la remise la plus forte, plancher', () => {
  const r = simulerRemisesBar(base, p)
  // Remise maximale TTC sur la planche au plancher de 25 % : (10 − 3 ÷ 0,75) × 1,1 = 6,60 €
  proche(r.lignes[0].remiseMax, 6.6)
  // Planche à 1 € de remise : 10 − 0,909 = 9,091 € HT, marge 6,091 €
  proche(r.lignes[0].margeApres, 10 - 1 / 1.1 - 3)
  expect(r.lignes[0].alerte).toBe('ok')
})

test('bar · loi Évin : jamais de remise sur l’alcool seul', () => {
  const r = simulerRemisesBar({ ...base, lignes: [panier[1], { ...panier[0], parVenue: 0 }] }, p)
  expect(r.evin).toBe(false)
  const sansRemise = simulerRemisesBar({ ...base, paliers: [], lignes: [panier[1]] }, p)
  expect(sansRemise.evin).toBe(true)
})
