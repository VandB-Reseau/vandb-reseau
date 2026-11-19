import { expect, test } from '@playwright/test'
import { simulerExterieur, type ContratExterieur } from '../../../src/pilotage/moteur/boiteOutils'
import { parametresParDefaut } from '../../../src/pilotage/moteur/parametres'
import { parametresSimulateurs } from '../../../src/pilotage/moteur/simulateurs'

// Gaz, consignes et gratuité de fût (Joseph, 19/11/2026). Chiffres fictifs vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 4) => expect(v).toBeCloseTo(attendu, chiffres)
const p = parametresParDefaut // redevance 2 %, publicité 1 %

const contrat: ContratExterieur = {
  futs: 40, prixVente: 69, remise: 0, prixAchat: 41.34, co2: 0, gobelets: 0, tireuse: 'neuve', prixTireuse: 1500, dureeTireuse: 5, entretien: 60,
  livraisons: 10, km: 0, prixKm: 0, heures: 0, coutHoraire: 0, don: { type: 'aucun', montant: 0, futs: 0, cerfa: false },
  tireuses: 2,
  co2Bouteilles: { enPlace: 3, vendues: 3, prixTTC: 40, marge: 0.4, tva: 0.2 },
  consignes: { fut: 60, bouteille: 85, facturees: false },
}

test('repères du siège : 40 € TTC, 40 % de marge, consignes 85 € et 60 € tant que rien n’est réglé', () => {
  expect(parametresSimulateurs({}).exterieur).toMatchObject({ bouteilleTTC: 40, margeBouteille: 0.4, consigneBouteille: 85, consigneFut: 60 })
  expect(parametresSimulateurs({ simulateurs: { exterieur: { bouteilleTTC: 45, consigneFut: 0 } as never } }).exterieur).toMatchObject({ bouteilleTTC: 45, consigneFut: 0, consigneBouteille: 85 })
})

test('deux tireuses, trois bouteilles de CO2 vendues : CA, marge du gaz, gain', () => {
  const r = simulerExterieur(contrat, p, false)
  // Tireuses : 2 × (1 500 ÷ 5 + 60) = 720 € par an
  proche(r.tireuseAn, 720)
  // CO2 : 3 × 40 ÷ 1,2 = 100 € HT ; achat 100 × 60 % = 60 € ; marge 40 €
  proche(r.co2.ca, 100); proche(r.co2.achat, 60); proche(r.co2.marge, 40)
  proche(r.ca, 2_860)
  // Net 69 − 2,07 − 41,34 = 25,59 € ; recettes nettes 100 × 0,97 − 60 = 37 € ; gain 40 × 25,59 + 37 − 720 = 340,60 €
  proche(r.netParFut, 25.59)
  proche(r.recettesNettes, 37)
  proche(r.gain, 340.6)
  // Le compte retombe sur le gain : 2 860 − 1 653,60 (fûts) − 60 (CO2) − 85,80 (redevance) − 720 = 340,60
  proche(r.ca - r.coutFuts - r.coutOfferts - r.co2.achat - r.redevance - r.tireuseAn, 340.6)
  // Équilibre : (720 − 37) ÷ 25,59 = 26,7, 27 fûts
  expect(r.equilibre).toBe(27)
  expect(r.locationsFacturees).toBe(0)
})

test('remise de 10 % : marge des fûts et coût du geste', () => {
  const r = simulerExterieur({ ...contrat, remise: 6.9 }, p, false)
  // Sans geste : 40 × (69 − 41,34) = 1 106,40 €, 40,1 % de 2 760 € ; avec : 40 × (62,10 − 41,34) = 830,40 €, 33,4 % de 2 484 €
  proche(r.geste.margeSans, 1_106.4); proche(r.geste.tauxSans, 1_106.4 / 2_760)
  proche(r.geste.margeAvec, 830.4); proche(r.geste.tauxAvec, 830.4 / 2_484)
  // Coût sur le gain : 40 × 6,90 × 0,97 = 267,72 € ; gain 340,60 − 267,72 = 72,88 €
  proche(r.geste.coutGain, 267.72)
  proche(r.gain, 72.88)
})

test('deux fûts offerts : achetés sans CA, en coût fixe', () => {
  const r = simulerExterieur({ ...contrat, futsOfferts: 2 }, p, false)
  // 2 × 41,34 = 82,68 € ; gain 340,60 − 82,68 = 257,92 € ; équilibre (802,68 − 37) ÷ 25,59 = 29,9, 30 fûts
  proche(r.coutOfferts, 82.68)
  proche(r.coutFixe, 802.68)
  proche(r.gain, 257.92)
  expect(r.equilibre).toBe(30)
  proche(r.geste.margeAvec, 1_106.4 - 82.68)
  proche(r.geste.coutGain, 82.68)
  // 42 fûts livrés en 10 livraisons : 5 par livraison ; bloqué 5 × 60 + 3 × 85 = 555 €
  expect(r.consignes.futsParLivraison).toBe(5)
  proche(r.consignes.bloque, 555)
})

test('consignes : avancées, rendues, bloquées au plus fort, ou avancées par le client', () => {
  const r = simulerExterieur(contrat, p, false)
  // 40 × 60 + 3 × 85 = 2 655 € avancés et rendus ; au plus fort 4 fûts × 60 + 255 = 495 €
  proche(r.consignes.sorties, 2_655)
  proche(r.consignes.rentrees, 2_655)
  expect(r.consignes.futsParLivraison).toBe(4)
  proche(r.consignes.bloque, 495)
  // Les consignes ne changent pas le gain
  proche(simulerExterieur({ ...contrat, consignes: undefined }, p, false).gain, r.gain)
  const client = simulerExterieur({ ...contrat, consignes: { fut: 60, bouteille: 85, facturees: true } }, p, false)
  expect(client.consignes.bloque).toBe(0)
  proche(client.consignes.avanceClient, 495)
})
