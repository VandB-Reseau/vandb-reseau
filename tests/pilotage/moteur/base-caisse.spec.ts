import { expect, test } from '@playwright/test'
import { baseCaisse, budgetSurCaisse, type MoisCaisse } from '../../../src/pilotage/moteur/leviers'
import type { Budget } from '../../../src/pilotage/moteur/types'

// 191 (Joseph, 15/11/2026) : tickets et panier des simulateurs lus en caisse sur les 12 derniers mois clos. Chiffres
// fictifs, chaque résultat se vérifie à la main.
const mois = (de: string, n: number) => Array.from({ length: n }, (_, i) => {
  const [a, m] = de.split('-').map(Number), t = a * 12 + m - 1 + i
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
})

test('base de la caisse : 12 mois complets par univers, sinon l’univers garde le budget', () => {
  // Cave : 1 000 tickets à 20 € HT chaque mois ; Bar : un mois sans tickets (juin 2026) → écarté
  const l: MoisCaisse[] = mois('2025-11', 12).map((m) => ({ mois: m, fluxCave: 1_000, pmCave: 20, fluxBar: m === '2026-06' ? 0 : 500, pmBar: 10 }))
  const b = baseCaisse(l)!
  expect(b).toEqual({ de: '2025-11', a: '2026-10', univers: { cave: { tickets: 12_000, ca: 240_000, panierHT: 20 } } })
  // Moins de 12 mois : pas de base
  expect(baseCaisse(l.slice(1))).toBeNull()
  expect(baseCaisse([])).toBeNull()
  // Le dernier mois avec des tickets borne la fenêtre : un mois de plus sans rien ne la décale pas
  expect(baseCaisse([...l, { mois: '2026-11', fluxCave: null, pmCave: null, fluxBar: null, pmBar: null }])?.a).toBe('2026-10')
})

test('budget recalé sur la caisse : tickets, panier TTC et CA de l’univers, taux de marge inchangé', () => {
  const b = {
    flux: { cave: { objectif: 10_000, panierObjectifTTC: 30, panierRealiseTTC: 0 } },
    familles: [
      { univers: 'cave', objectif: 200_000, margeObjectif: 70_000 },
      { univers: 'cave', objectif: 100_000, margeObjectif: 30_000 },
      { univers: 'bar', objectif: 50_000, margeObjectif: 35_000 },
    ],
  } as unknown as Budget
  const r = budgetSurCaisse(b, { de: '2025-11', a: '2026-10', univers: { cave: { tickets: 12_000, ca: 240_000, panierHT: 20 }, bar: { tickets: 5_000, ca: 50_000, panierHT: 10 } } }, { cave: 0.2, bar: 0.2 })
  // CA de la Cave 300 000 € → 240 000 € (× 0,8), familles au prorata ; marge 100 000 € → 80 000 € (taux 33,3 % gardé)
  expect(r.familles.map((x) => [x.objectif, x.margeObjectif])).toEqual([[160_000, 56_000], [80_000, 24_000], [50_000, 35_000]])
  // Tickets de la caisse, panier 20 € HT → 24 € TTC ; le Bar sans tickets visés au budget n'est pas touché
  expect(r.flux.cave).toEqual({ objectif: 12_000, panierObjectifTTC: 24, panierRealiseTTC: 0 })
  expect(r.flux.bar).toBeUndefined()
  // Le budget d'origine ne bouge pas
  expect(b.familles[0].objectif).toBe(200_000)
})
