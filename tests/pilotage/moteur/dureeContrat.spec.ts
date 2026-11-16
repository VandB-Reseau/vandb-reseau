import { expect, test } from '@playwright/test'
import { simulerExterieur, type ContratExterieur } from '../../../src/pilotage/moteur/boiteOutils'
import { parametresParDefaut } from '../../../src/pilotage/moteur/parametres'

// Durée du contrat (Joseph, 16/11/2026 : « l'amortissement de la tireuse peut être sur 5 ans, mais si le contrat est sur 3… ça
// fait mal »). Chiffres vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 4) => expect(v).toBeCloseTo(attendu, chiffres)
const p = parametresParDefaut // redevance 2 %, publicité 1 %

const contrat: ContratExterieur = {
  futs: 40, prixVente: 69, remise: 0, prixAchat: 41.34, co2: 0, gobelets: 0, tireuse: 'neuve', prixTireuse: 1500, dureeTireuse: 5, entretien: 60,
  livraisons: 0, km: 0, prixKm: 0, heures: 0, coutHoraire: 0, don: { type: 'aucun', montant: 0, futs: 0, cerfa: false },
}

test('contrat de 3 ans, tireuse de 5 ans : payée sur le contrat, reste non amorti, équilibre si elle ressert', () => {
  // Net 69 − 2,07 − 41,34 = 25,59 € par fût. Tireuse : 1 500 ÷ 3 + 60 = 560 € par an (au lieu de 1 500 ÷ 5 + 60 = 360 €)
  const r = simulerExterieur({ ...contrat, dureeContrat: 3 }, p, false)
  expect(r.anneesTireuse).toBe(3)
  proche(r.tireuseAn, 560)
  proche(r.tireuseAnDureeVie, 360)
  proche(r.coutFixe, 560)
  expect(r.equilibre).toBe(22)               // 560 ÷ 25,59 = 21,9
  expect(r.equilibreDureeVie).toBe(15)       // 360 ÷ 25,59 = 14,1
  proche(r.resteNonAmorti, 600)              // 1 500 × 2 ÷ 5
  proche(r.gain, 40 * 25.59 - 560)           // 463,60 €
  proche(r.gainContrat, 3 * (40 * 25.59 - 560))
  // Remise maximale : celle qui ramène le gain à 0 avec 560 € de tireuse : 25,59 − 560 ÷ 40 = 11,59 € de net à rendre, ÷ 0,97
  proche(r.remiseMax, (25.59 - 14) / 0.97)
})

test('contrat aussi long que la tireuse, sans durée ou tireuse déjà dans le parc : rien ne change', () => {
  const base = simulerExterieur(contrat, p, false)
  proche(base.tireuseAn, 360)
  expect(base.resteNonAmorti).toBe(0)
  expect(base.gainContrat).toBeNull()
  expect(base.equilibreDureeVie).toBe(base.equilibre)
  const long = simulerExterieur({ ...contrat, dureeContrat: 6 }, p, false)
  proche(long.tireuseAn, 360)
  expect(long.resteNonAmorti).toBe(0)
  proche(long.gainContrat, 6 * long.gain)
  const parc = simulerExterieur({ ...contrat, tireuse: 'parc', dureeContrat: 2 }, p, false)
  proche(parc.tireuseAn, 60)
  expect(parc.resteNonAmorti).toBe(0)
})

test('gobelets réutilisables du contrat : nombre × prix, en coût fixe', () => {
  // 500 × 0,25 = 125 € ; 560 € de tireuse + 125 € = 685 € ; 685 ÷ 25,59 = 26,8, 27 fûts
  const r = simulerExterieur({ ...contrat, dureeContrat: 3, gobeletsContrat: { nombre: 500, prix: 0.25 } }, p, false)
  proche(r.gobeletsAn, 125)
  proche(r.coutFixe, 685)
  proche(r.netParFut, 25.59)
  expect(r.equilibre).toBe(27)
  proche(r.gain, 40 * 25.59 - 685)
})
