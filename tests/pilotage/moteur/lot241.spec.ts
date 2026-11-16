import { expect, test } from '@playwright/test'
import { cibleProductivite, simulerHeuresSup } from '../../../src/pilotage/moteur/boiteOutils'
import { parametresParDefaut } from '../../../src/pilotage/moteur/parametres'
import { simulerSoireeAnimee } from '../../../src/pilotage/moteur/simulateurs'
import { stockReseau, stockParDefaut } from '../../../src/pilotage/moteur/stock'

// Lot 241, 242, 245 et grille de productivité (Joseph, 16/11/2026). Chiffres fictifs, vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 4) => expect(v).toBeCloseTo(attendu, chiffres)
const p = parametresParDefaut // redevance 2 %, publicité 1 %

test('241 · soirée animée sans billet : CA du bar à viser au-delà d’un soir normal', () => {
  // Soir normal 2 000 €, attendu 4 200 €, marge 72 % ; DJ 400 + sécurité 250 + déco 450 = 1 100 €, extras 200 €
  const r = simulerSoireeAnimee({ caNormal: 2_000, caAttendu: 4_200, tauxMarge: 0.72, couts: 1_100, extras: 200 }, p)
  expect(r.caEnPlus).toBe(2_200)
  proche(r.marge, 1_584)                      // 2 200 × 0,72
  proche(r.redevance, 66)                     // 2 200 × 3 %
  proche(r.gain, 218)                         // 1 584 − 66 − 1 300
  proche(r.caEnPlusAViser!, 1_884.0580)       // 1 300 ÷ (0,72 − 0,03)
  proche(r.caAViser!, 3_884.0580)             // 2 000 + 1 884,06, comme la fiche Excel
  // Heures de l'équipe en place : 2 personnes × 3 h × 20 € × 1,25 = 150 €
  proche(simulerSoireeAnimee({ caNormal: 2_000, caAttendu: 4_200, tauxMarge: 0.72, couts: 1_100, extras: 200, equipe: { personnes: 2, heures: 3, coutHoraire: 20, majoration: 0.25 } }, p).gain, 68)
  // Marge sous la redevance : jamais rentable
  expect(simulerSoireeAnimee({ caNormal: 0, caAttendu: 100, tauxMarge: 0.02, couts: 10, extras: 0 }, p).caAViser).toBeNull()
})

test('242 · heures sup : part, coût, majoration, seuil où un extra coûte moins cher', () => {
  const r = simulerHeuresSup({ heures: 600, heuresSup: 30, coutHoraire: 20, majoration: 0.25, paieExtraMois: 20 })
  proche(r.part!, 0.05)                       // 30 ÷ 600
  proche(r.coutMois, 750)                     // 30 × 20 × 1,25
  proche(r.majorationMois, 150)               // 30 × 20 × 0,25
  proche(r.coutAn, 9_000)
  proche(r.gainExtraMois, 130)                // 150 − 20 de paie
  proche(r.seuilHeures!, 4)                   // 20 ÷ (20 × 0,25)
  expect(simulerHeuresSup({ heures: 0, heuresSup: 0, coutHoraire: 0, majoration: 0.25, paieExtraMois: 20 })).toMatchObject({ part: null, seuilHeures: null })
})

test('245 · mois de stock du réseau : ventes à venir de l’an dernier, sinon rythme récent ; cible pondérée', () => {
  const mois = (ca: number, cave = 0, bar = 0) => ({ caHT: ca, margeHT: ca * 0.4, caAvecMarge: ca, univers: { cave: { caTTC: cave }, bar: { caTTC: bar } } })
  const n = [mois(10_000, 6_000, 4_000), mois(10_000, 6_000, 4_000), mois(10_000, 6_000, 4_000), ...Array.from({ length: 9 }, () => mois(0))]
  const n1 = Array.from({ length: 12 }, () => mois(10_000))
  const saisies = [null, null, { cave: 12_000, bar: 3_000 }, ...Array(9).fill(null)]
  // Achats d'un mois : 10 000 × 60 % = 6 000 € ; 15 000 € de stock fin mars = 2,5 mois
  // Cible : (18 000 × 2,5 + 12 000 × 1) ÷ 30 000 = 1,9 mois ; 2,5 > 1,9 × 1,1 : au-dessus
  const r = stockReseau(n, n1, saisies, stockParDefaut)!
  expect(r).toMatchObject({ mois: 3, stock: 15_000 })
  proche(r.moisCouverts, 2.5)
  proche(r.cible!, 1.9)
  expect(r.etat).toBe('haut')
  // Sans an dernier complet : rythme des 3 derniers mois (10 000 €), même résultat
  proche(stockReseau(n, [], saisies)!.moisCouverts, 2.5)
  // Aucun stock saisi : rien
  expect(stockReseau(n, n1, Array(12).fill(null))).toBeNull()
})

test('grille de productivité en 3 paliers (46 % et 53 % de bar)', () => {
  const grille = [{ partBar: 0.53, cible: 95 }, { partBar: 0.46, cible: 102 }, { partBar: 0, cible: 117 }]
  expect(cibleProductivite(grille, 0.6)).toBe(95)
  expect(cibleProductivite(grille, 0.5)).toBe(102)
  expect(cibleProductivite(grille, 0.46)).toBe(102)
  expect(cibleProductivite(grille, 0.4)).toBe(117)
})
