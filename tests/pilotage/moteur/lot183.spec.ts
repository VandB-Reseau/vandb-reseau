import { expect, test } from '@playwright/test'
import { meilleursLeviers } from '../../../src/pilotage/moteur/leviers'
import type { Budget } from '../../../src/pilotage/moteur/types'
import { constater, moisSuivant } from '../../../src/data/planAction'
import type { ChiffreMois } from '../../../src/data/chiffres'

// Choix 183 à 185 (Joseph, 15/11/2026) : meilleur levier, mesure en caisse d'une priorité, bilan d'une opération
// commerciale (185, retiré le 17/11/2026). Magasin fictif, chaque résultat se vérifie à la main.
const proche = (v: number | null | undefined, attendu: number) => expect(v).toBeCloseTo(attendu, 2)

// Cave : 600 000 € HT, marge 40 %, 20 000 tickets, panier 36 € TTC (600 000 × 1,2 ÷ 20 000).
// Bar : 200 000 € HT, marge 70 %, 25 000 tickets, panier 9,60 € TTC (200 000 × 1,2 ÷ 25 000).
const budget = {
  familles: [
    { univers: 'cave', objectif: 600_000, margeObjectif: 240_000 },
    { univers: 'bar', objectif: 200_000, margeObjectif: 140_000 },
  ],
  flux: { cave: { objectif: 20_000, panierObjectifTTC: 36 }, bar: { objectif: 25_000, panierObjectifTTC: 9.6 } },
} as unknown as Budget
const p = { tauxRedevance: 0.02, tauxPublicite: 0.01, tvaPanier: { cave: 0.2, bar: 0.2 } }

test('183 : les leviers rangés du plus au moins rentable, avec ce que la caisse doit montrer', () => {
  const l = meilleursLeviers(budget, p, { ticketsJour: 1, panierTTC: 0.5, pointsMarge: 1, heuresSemaine: 2, coutHeure: 20, joursParAn: 300 })
  // Marge + 1 pt : 800 000 × 1 % = 8 000 € (le CA ne bouge pas)
  // Panier Bar + 0,50 € : 200 000 × 0,5 ÷ 9,6 = 10 416,67 € de CA ; marge 7 291,67 ; EBE 7 291,67 − 3 % × 10 416,67 = 6 979,17
  // Tickets Cave + 300 : 600 000 × 300 ÷ 20 000 = 9 000 € ; marge 3 600 ; EBE 3 600 − 270 = 3 330
  // Panier Cave + 0,50 € : 600 000 × 0,5 ÷ 36 = 8 333,33 € ; marge 3 333,33 ; EBE 3 333,33 − 250 = 3 083,33
  // Heures − 2 par semaine : 2 × 52 × 20 = 2 080
  // Tickets Bar + 300 : 200 000 × 300 ÷ 25 000 = 2 400 € ; marge 1 680 ; EBE 1 680 − 72 = 1 608
  expect(l.map((x) => x.cle)).toEqual(['marge', 'panier_bar', 'tickets_cave', 'panier_cave', 'heures', 'tickets_bar'])
  proche(l[0].ebe, 8_000); proche(l[0].ca, 0)
  proche(l[1].ca, 10_416.67); proche(l[1].ebe, 6_979.17)
  proche(l[2].ca, 9_000); proche(l[2].ebe, 3_330)
  proche(l[3].ebe, 3_083.33)
  proche(l[4].ebe, 2_080); expect(l[4].mesure).toBeNull()
  proche(l[5].ebe, 1_608)
  // En caisse, par mois : + 25 tickets (300 ÷ 12), + 0,4167 € HT de panier (0,50 ÷ 1,2), + 1 point de marge
  expect(l[2].mesure).toEqual({ indicateur: 'fluxCave', attendu: 25 })
  expect(l[3].mesure?.indicateur).toBe('pmCave'); proche(l[3].mesure?.attendu, 0.4167)
  expect(l[0].mesure).toEqual({ indicateur: 'marge', attendu: 1 })
  // Effort à zéro : la ligne disparaît
  expect(meilleursLeviers(budget, p, { ticketsJour: 0, panierTTC: 0, pointsMarge: 0, heuresSemaine: 2, coutHeure: 20, joursParAn: 300 }).map((x) => x.cle)).toEqual(['heures'])
})

const ligne = (mois: string, caCave: number, pmCave = 40): ChiffreMois => ({ magasin: 'X', mois, caExt: 0, pmCave, fluxCave: caCave / pmCave, pmBar: 12, fluxBar: 1_000, caCave, caBar: 12_000, tickets: null, panier: null, marge: 42 })

test('184 : le constaté est l’écart moyen face à l’an passé, sur les mois clos depuis le départ', () => {
  expect(moisSuivant('2026-07-15')).toBe('2026-08')
  expect(moisSuivant('2026-12-02')).toBe('2027-01')
  const chiffres = [ligne('2025-08', 50_000, 40), ligne('2025-09', 50_000, 40), ligne('2026-07', 50_000, 40), ligne('2026-08', 52_000, 40.5), ligne('2026-09', 53_000, 41)]
  // Panier Cave : août + 0,50, septembre + 1,00 → moyenne + 0,75 sur 2 mois, attendu + 0,42 : au rendez-vous
  const c = constater(chiffres, { indicateur: 'pmCave', attendu: 0.42, depuis: '2026-08', source: '' })
  expect(c?.mois).toBe(2); expect(c?.dernier).toBe('2026-09'); proche(c?.ecart, 0.75); expect(c?.atteint).toBe(true)
  // CA du magasin (Cave + Bar + Extérieur) : + 2 000 puis + 3 000 → + 2 500 ; attendu + 5 000 : la moitié
  const ca = constater(chiffres, { indicateur: 'ca', attendu: 5_000, depuis: '2026-08', source: '' })
  proche(ca?.ecart, 2_500); proche(ca?.part, 0.5); expect(ca?.atteint).toBe(false)
  // Aucun mois clos depuis le départ : pas encore de constat
  expect(constater(chiffres, { indicateur: 'ca', attendu: 1, depuis: '2026-10', source: '' })).toBeNull()
})
