import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Accueil de pilotage (maquette A, Joseph 22/10/2026, revue le 09/11/2026) : quatre repères, À traiter, Mes tâches et
// Cette semaine au centre, actualités à droite ; sur téléphone, ces trois blocs en onglets courts au-dessus des actualités

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('quatre repères de pilotage en tête de l’accueil, chacun mène à son détail', async ({ page, isMobile }) => {
  await seConnecter(page)
  // Vague 8 : sur téléphone, les indicateurs se déplient sous les actualités
  if (isMobile) await page.getByRole('button', { name: 'Mes indicateurs' }).click()
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

// Refonte vague 5 (Joseph, 10/11/2026, 43A, revient sur 7A) : les actualités au centre, « Aujourd'hui » à droite
test('PC : les actualités au centre, À traiter, Mes tâches et Cette semaine à droite dès l’arrivée', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Disposition du PC')
  await seConnecter(page)
  const actualites = page.getByRole('region', { name: 'Actualités' })
  await expect(actualites).toBeVisible()
  await expect(actualites).toBeInViewport()
  const colonne = page.getByRole('complementary', { name: 'Aujourd’hui' })
  const traiter = colonne.getByRole('region', { name: 'À traiter' })
  await expect(traiter).toBeVisible()
  await expect(page.getByRole('region', { name: 'Mes tâches' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Mes tâches' }).getByRole('link', { name: 'Toutes' })).toHaveAttribute('href', '#/taches')
  const a = (await actualites.boundingBox())!
  const t = (await traiter.boundingBox())!
  expect(a.x + a.width).toBeLessThanOrEqual(t.x)
  expect(t.y).toBeLessThan(page.viewportSize()!.height / 2)
  // Les repères au-dessus des deux colonnes
  const p = (await page.getByRole('region', { name: 'Pilotage' }).boundingBox())!
  expect(p.y + p.height).toBeLessThanOrEqual(t.y)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-accueil-pilotage.png` })
})

test('téléphone : les actualités d’abord, un bloc court à onglets, repères en 2 × 2 dépliés à la demande', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'Disposition du téléphone')
  await seConnecter(page)
  await page.getByRole('button', { name: 'Mes indicateurs' }).click()
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
  await expect(onglets).toHaveText([/^À traiter/, /^Tâches/, 'Semaine', /^Contrats/])
  for (const o of await onglets.all()) expect((await o.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  // Vague 8 (retour de Joseph, 13/11/2026) : les actualités passent avant le bloc à onglets
  await expect(page.getByRole('region', { name: 'À traiter' }).getByRole('link')).toHaveCount(2)
  const actualites = page.getByRole('region', { name: 'Actualités' })
  expect((await actualites.boundingBox())!.y).toBeLessThan((await page.getByRole('tablist', { name: 'Mon point' }).boundingBox())!.y)
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
