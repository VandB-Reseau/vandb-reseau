import { expect, test } from '@playwright/test'
import { gainsSelonFuts, simulerExterieur, simulerParc, simulerProspection, type ContratExterieur } from '../../../src/pilotage/moteur/boiteOutils'
import { parametresParDefaut } from '../../../src/pilotage/moteur/parametres'

// 236, 238, 239 (Joseph, 16/11/2026) : la fiche « Rentabilité Extérieur ». Chiffres de la fiche, vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 4) => expect(v).toBeCloseTo(attendu, chiffres)
const p = parametresParDefaut // redevance 2 %, publicité 1 %

test('236 · cible particulier : ce que rapporte le parc sur l’année', () => {
  // 19 tireuses, 10 week-ends de saison loués à 100 %, 42 autres à 10 % : 14,2 week-ends par tireuse ; 2 fûts par week-end
  const r = simulerParc({ tireuses: 19, semainesSaison: 10, sortiesSaison: 0, sortiesHorsSaison: 0, refus: 0, futsParSortie: 2, netParFut: 25, prixNeuve: 1500, dureeVie: 5, entretien: 60, vieilles: [],
    occupation: { saison: 1, hors: 0.1 }, prixVenteHT: 74, margeParFut: 27 })
  proche(r.weekendsParTireuse, 14.2)
  proche(r.futsParc, 539.6)          // 19 × 14,2 × 2
  proche(r.caParc, 39_930.4)         // × 74 €, le CA potentiel de la fiche
  proche(r.margeParc, 14_569.2)      // × 27 €
  proche(r.netParc, 13_490)          // × 25 €
})

const contrat: ContratExterieur = {
  futs: 40, prixVente: 69, remise: 0, prixAchat: 41.34, co2: 0, gobelets: 0, tireuse: 'neuve', prixTireuse: 1500, dureeTireuse: 1, entretien: 0,
  livraisons: 0, km: 0, prixKm: 0, heures: 0, coutHoraire: 0, don: { type: 'aucun', montant: 0, futs: 0, cerfa: false },
}

test('239 · cible associative : gain selon le nombre de fûts, la tireuse payée la première année', () => {
  // Marge 27,66 € par fût ; net 69 − 2,07 (3 %) − 41,34 = 25,59 € ; tireuse 1 500 € : équilibre à 1 500 ÷ 25,59 = 58,6, donc 59 fûts
  const r = simulerExterieur(contrat, p, false)
  proche(r.netParFut, 25.59)
  expect(r.equilibre).toBe(59)
  const l = gainsSelonFuts(r, 40)
  expect(l.map((x) => x.futs)).toEqual([20, 30, 40, 50, 59, 60, 70])
  proche(l[1].gain, 30 * 25.59 - 1500) // 30 fûts : perte de 732,30 €
  expect(l[2].prevu).toBe(true)
  expect(l[4].seuil).toBe(true)
  proche(l[4].gain, 59 * 25.59 - 1500)
  expect(l[4].gain).toBeGreaterThan(0)
  proche(l[6].ca, 70 * 69)
})

test('238 · cible entreprise : démarcher pendant un test de six mois', () => {
  // 3 h par semaine pendant 24 semaines à 15 € : 1 080 € ; 15 entreprises à 330 € = 4 950 € à 37 % = 1 831,50 €, moins 3 % = 148,50 €
  const r = simulerProspection({ heuresSemaine: 3, semaines: 24, coutHoraire: 15, entreprises: 15, ticket: 330, marge: 0.37 }, p)
  proche(r.heures, 72)
  proche(r.coutTemps, 1080)
  proche(r.ca, 4950)
  proche(r.marge, 1831.5)
  proche(r.redevance, 148.5)
  proche(r.gain, 603)
  expect(r.seuil).toBe(10) // 1 080 ÷ (330 × 34 %) = 9,6
  expect(simulerProspection({ heuresSemaine: 3, semaines: 24, coutHoraire: 15, entreprises: 15, ticket: 330, marge: 0.02 }, p).seuil).toBeNull()
})
