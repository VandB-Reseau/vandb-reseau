import { expect, test } from '@playwright/test'
import { achatsAVenir, cibleStock, coutVentesDe, etatStock, moisCouverts, stockComplete, stockParDefaut, suiviStock, type CoutVentes } from '../../../src/pilotage/moteur/stock'
import type { Budget } from '../../../src/pilotage/moteur/types'

// Valeur du stock en fin de mois (03/11/2026) : cible de 2,5 mois d'achats des ventes à venir pour la Cave, 1 mois pour
// le Bar, tolérance 10 %. Magasin fictif, chiffres vérifiés à la main.
const proche = (v: number | null, attendu: number) => expect(v).toBeCloseTo(attendu, 6)

// Coût d'achat des ventes : Cave 10 000 € par mois, puis 20 000 en octobre, 30 000 en novembre, 40 000 en décembre ;
// Bar 2 000 € tous les mois ; Extérieur 5 000 € en juillet (sans stock)
const cave = [10, 10, 10, 10, 10, 10, 10, 10, 10, 20, 30, 40].map((k) => k * 1_000)
const cout: CoutVentes = { cave, bar: Array(12).fill(2_000), exterieur: [0, 0, 0, 0, 0, 0, 5_000, 0, 0, 0, 0, 0] }

test('achats à venir : mois entiers puis fraction, l’année recommence après décembre', () => {
  proche(achatsAVenir(cave, 8, 2.5), 20_000 + 30_000 + 20_000)   // fin septembre : octobre, novembre, moitié de décembre
  proche(achatsAVenir(cave, 11, 2.5), 10_000 + 10_000 + 5_000)   // fin décembre : janvier, février, moitié de mars
  proche(achatsAVenir(cave, 8, 0), 0)
  proche(moisCouverts(cave, 8, 60_000), 2.25)                     // 20 000 + 30 000, puis 10 000 sur 40 000
  proche(moisCouverts(cave, 8, 0), 0)
})

test('cible par univers : Cave 2,5 mois, Bar 1 mois, Extérieur sans stock', () => {
  const c = cibleStock(cout, 8)
  proche(c.cave, 70_000)
  proche(c.bar, 2_000)
  proche(c.exterieur, 0)
  // Mois modifiables (Paramètres réseau) : Cave 2 mois, Bar 1,5 mois
  const m = cibleStock(cout, 8, { mois: { cave: 2, bar: 1.5, exterieur: 0 }, tolerance: 0.1 })
  proche(m.cave, 50_000)
  proche(m.bar, 3_000)
})

test('suivi : réel face à la cible, état avec 10 % de tolérance, couverture en mois', () => {
  const saisies = Array(12).fill(null)
  saisies[8] = { cave: 60_000, bar: 3_000 }    // fin septembre
  saisies[9] = { cave: 80_000, bar: 2_000 }    // fin octobre
  saisies[10] = { cave: null, bar: null }      // novembre : rien de saisi
  const s = suiviStock(cout, saisies)
  const sept = s.mois[8], oct = s.mois[9]
  proche(sept.cible, 72_000)
  proche(sept.mini, 64_800)
  proche(sept.maxi, 79_200)
  proche(sept.reel, 63_000)
  proche(sept.ecart, -9_000)
  expect(sept.etat).toBe('bas')
  proche(sept.couverture.cave, 2.25)
  proche(sept.couverture.bar, 1.5)             // 2 000 d'octobre, puis 1 000 sur 2 000 de novembre
  // Fin octobre : novembre 30 000 + décembre 40 000 + moitié de janvier 5 000, plus 2 000 de Bar
  proche(oct.cible, 77_000)
  proche(oct.reel, 82_000)
  expect(oct.etat).toBe('ok')
  expect(s.mois[10].reel).toBeNull()
  expect(s.mois[10].etat).toBeNull()
  expect(s.saisis).toBe(2)
  expect(s.dernier?.mois).toBe(10)
  expect(etatStock(90_000, 77_000, 0.1)).toBe('haut')   // au-dessus de 84 700
  expect(stockParDefaut.mois).toEqual({ cave: 2.5, bar: 1, exterieur: 1 })
})

test('coût des ventes d’un budget, prolongé par le budget de l’année suivante', () => {
  const b = (achats: number) => ({ mois: Array.from({ length: 12 }, () => ({ achats: achats + 1_000, univers: { cave: { achats }, bar: { achats: 1_000 }, exterieur: { achats: 0 } } })) }) as unknown as Budget
  const c = coutVentesDe(b(10_000), b(8_000))
  expect(c.cave).toHaveLength(24)
  // Fin décembre : janvier, février et moitié de mars de l'année suivante
  proche(cibleStock(c, 11).cave, 8_000 * 2.5)
  // Budget ancien sans détail par univers : tout en Cave
  const ancien = { mois: Array.from({ length: 12 }, () => ({ achats: 6_000 })) } as unknown as Budget
  proche(cibleStock(coutVentesDe(ancien), 11).cave, 15_000)
  proche(cibleStock(coutVentesDe(ancien), 11).bar, 0)
})

// Stock cible de l'Extérieur (Joseph, 04/11/2026) : 1 mois d'achats des ventes à venir par défaut, réglable ; saisi avec
// la Cave et le Bar, il entre dans le stock total, la cible, l'écart et sa couverture.
test('Extérieur : cible d’un mois d’achats à venir, saisie comptée dans le total et la couverture', () => {
  // Fin juin : juillet porte 5 000 € d'achats de l'Extérieur
  const c = cibleStock(cout, 5)
  proche(c.exterieur, 5_000)
  proche(c.cave, 25_000)                       // juillet, août, moitié de septembre : 10 000 + 10 000 + 5 000
  proche(c.bar, 2_000)
  proche(cibleStock(cout, 5, { mois: { cave: 2.5, bar: 1, exterieur: 0.5 }, tolerance: 0.1 }).exterieur, 2_500)
  proche(cibleStock(cout, 6).exterieur, 0)     // fin juillet : rien d'acheté pour août
  const saisies = Array(12).fill(null)
  saisies[5] = { cave: 25_000, bar: 2_000, exterieur: 4_000 }   // fin juin
  saisies[6] = { cave: 25_000, bar: 2_000 }                     // fin juillet, saisi avant l'Extérieur : compté pour 0
  const s = suiviStock(cout, saisies)
  const juin = s.mois[5]
  proche(juin.cible, 32_000)
  proche(juin.cibleUnivers.exterieur, 5_000)
  proche(juin.reel, 31_000)
  proche(juin.ecart, -1_000)
  expect(juin.etat).toBe('ok')                 // fourchette de 28 800 à 35 200
  proche(juin.couverture.exterieur, 0.8)       // 4 000 sur les 5 000 de juillet
  expect(juin.reelUnivers.exterieur).toBe(4_000)
  expect(s.mois[6].reelUnivers.exterieur).toBeNull()
  expect(s.mois[6].couverture.exterieur).toBeNull()
  proche(s.mois[6].reel, 27_000)
  // Mois non saisi entre deux saisies : l'Extérieur s'estime comme la Cave et le Bar
  const complet = stockComplete(cout, [null, null, null, null, { cave: 20_000, bar: 2_000, exterieur: 0 }, null, { cave: 25_000, bar: 2_000, exterieur: 0 }, null, null, null, null, null])
  expect(complet[5].exterieur).not.toBeNull()
  expect(complet[5].estime).toBe(true)
  proche(complet[5].total!, complet[5].cave! + complet[5].bar! + complet[5].exterieur!)
})
