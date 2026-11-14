import { expect, test } from '@playwright/test'
import { caExterieurAnnee, exterieurDe, quantile } from '../../../src/data/exterieur'
import type { ChiffreMois } from '../../../src/data/chiffres'
import type { Reseau } from '../../../src/data/modele'

// L'Extérieur dans les chiffres du magasin (vague 9, choix 140). Chiffres fictifs, vérifiés à la main.
const mois = (magasin: string, m: string, caExt: number | null, ca = 50_000): ChiffreMois =>
  ({ magasin, mois: m, caExt, caCave: ca, caBar: 0, pmCave: null, fluxCave: null, pmBar: null, fluxBar: null, tickets: null, panier: null, marge: null })
const annee = (magasin: string, a: number, ext: number) => Array.from({ length: 6 }, (_, i) => mois(magasin, `${a}-0${i + 1}`, i >= 3 ? ext : 0))

test('CA extérieur de l’année, part, évolution et position parmi les magasins qui en font', () => {
  // A : 3 mois × 5 000 = 15 000 € en 2026 (avril à juin), 10 000 € en 2025 ; quatre autres magasins à 3, 6, 9 et 30 k€
  const chiffres: Record<string, ChiffreMois[]> = {
    A: [...annee('A', 2025, 10_000 / 3), ...annee('A', 2026, 5_000)],
    B: annee('B', 2026, 1_000), C: annee('C', 2026, 2_000), D: annee('D', 2026, 3_000), E: annee('E', 2026, 10_000),
    F: annee('F', 2026, 0),
  }
  const x = exterieurDe({ chiffres } as unknown as Reseau, 'A')!
  expect(x).toMatchObject({ annee: '2026', dernierMois: '2026-06', caExt: 15_000 })
  // CA du semestre : 6 × 50 000 + 15 000 = 315 000 € ; évolution (15 000 − 10 000) ÷ 10 000 = + 50 %
  expect(x.part).toBeCloseTo(15_000 / 315_000, 9)
  expect(x.caExtN1).toBeCloseTo(10_000, 6)
  expect(x.evolution).toBeCloseTo(50, 6)
  // Cinq magasins avec un CA extérieur (F n'en a pas) : 3, 6, 9, 15, 30 k€ ; médiane 9 000, quarts 6 000 et 15 000 ; A 2e
  expect(x.reseau).toEqual({ n: 5, q1: 6_000, mediane: 9_000, q3: 15_000, rang: 2, position: 'haut' })
  // Sans Extérieur ni l'an dernier : rien à montrer
  expect(exterieurDe({ chiffres } as unknown as Reseau, 'F')).toBeNull()
  expect(caExterieurAnnee({ chiffres } as unknown as Reseau, 'A', '2026')).toBe(15_000)
  expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
})
