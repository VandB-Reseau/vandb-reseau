import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Accueil de pilotage (maquette A, Joseph 22/10/2026) : quatre repères, actualités en colonne principale,
// À traiter, Mes tâches et Cette semaine à droite ; sur téléphone, ces trois blocs en onglets courts au-dessus des actualités

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('quatre repères de pilotage en tête de l’accueil, chacun mène à son détail', async ({ page }) => {
  await seConnecter(page)
  const pilotage = page.getByRole('region', { name: 'Pilotage' })
  const tuiles = pilotage.getByRole('link')
  await expect(tuiles).toHaveCount(4)
  await expect(tuiles.nth(0)).toHaveAccessibleName(/^CA (de|du) /)
  await expect(tuiles.nth(1)).toHaveAccessibleName(/^Décrochent : \d+/)
  await expect(tuiles.nth(2)).toHaveAccessibleName(/^Visites de l’année : (\d+ %|—)/)
  await expect(tuiles.nth(3)).toHaveAccessibleName(/^Santé du parc : \d+, prioritaires sur \d+ classés/)
  await tuiles.nth(3).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Santé du parc' })).toBeVisible()
})

test('PC : actualités à gauche, À traiter, Mes tâches et Cette semaine à droite', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Disposition du PC')
  await seConnecter(page)
  const actualites = page.getByRole('region', { name: 'Actualités' })
  const colonne = page.getByRole('complementary', { name: 'À traiter, mes tâches et cette semaine' })
  await expect(actualites).toBeVisible()
  await expect(colonne.getByRole('region', { name: 'À traiter' })).toBeVisible()
  await expect(colonne.getByRole('region', { name: 'Mes tâches' })).toBeVisible()
  await expect(colonne.getByRole('link', { name: 'Toutes' })).toHaveAttribute('href', '#/echanges?vue=taches')
  const a = (await actualites.boundingBox())!
  const c = (await colonne.boundingBox())!
  expect(a.x + a.width).toBeLessThanOrEqual(c.x)
  // Les repères au-dessus des deux colonnes
  const p = (await page.getByRole('region', { name: 'Pilotage' }).boundingBox())!
  expect(p.y + p.height).toBeLessThanOrEqual(a.y)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-accueil-pilotage.png` })
})

test('téléphone : repères en 2 × 2, un bloc court à onglets, puis les actualités', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'Disposition du téléphone')
  await seConnecter(page)
  const pilotage = page.getByRole('region', { name: 'Pilotage' })
  // Quatre cartes égales en 2 × 2, toutes dans l'écran, sans défilement de côté
  await expect(pilotage.getByRole('link')).toHaveCount(4)
  const b = await Promise.all((await pilotage.getByRole('link').all()).map(async (l) => (await l.boundingBox())!))
  expect(b).toHaveLength(4)
  expect(Math.abs(b[0].y - b[1].y)).toBeLessThan(2)
  expect(b[2].y).toBeGreaterThan(b[0].y + b[0].height - 1)
  expect(Math.abs(b[0].width - b[1].width)).toBeLessThan(2)
  expect(Math.abs(b[0].height - b[1].height)).toBeLessThan(2)
  for (const x of b) expect(x.x + x.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  expect(await pilotage.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const onglets = page.getByRole('tablist', { name: 'Mon point' }).getByRole('tab')
  await expect(onglets).toHaveText([/^À traiter/, /^Tâches/, 'Semaine'])
  for (const o of await onglets.all()) expect((await o.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  // Deux lignes seulement, les actualités juste en dessous
  await expect(page.getByRole('region', { name: 'À traiter' }).getByRole('link')).toHaveCount(2)
  const actualites = page.getByRole('region', { name: 'Actualités' })
  const haut = (await actualites.boundingBox())!.y
  expect(haut).toBeLessThan(page.viewportSize()!.height * 1.1)
  await onglets.nth(1).click()
  await expect(onglets.nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'Mes tâches' })).toBeVisible()
  await onglets.nth(2).click()
  await expect(page.getByRole('region', { name: 'Cette semaine' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ouvrir l’agenda' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await onglets.nth(0).click()
  await page.screenshot({ path: `captures/${info.project.name}-accueil-pilotage.png` })
})
