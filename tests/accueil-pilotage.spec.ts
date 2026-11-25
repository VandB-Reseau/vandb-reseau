import { expect, test } from '@playwright/test'
import { deplierPoint, seConnecter, textesTropPetits } from './supabase-simule'

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

// Refonte vague 5 (Joseph, 10/11/2026, 43A, revient sur 7A) : les actualités au centre, « Aujourd'hui » à droite
// 429 à 436 (25/11/2026) : la colonne garde l'action terrain, plus de repères chiffrés au-dessus
test('PC : les actualités au centre, À traiter à droite dès l’arrivée, sans repères chiffrés', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Disposition du PC')
  await seConnecter(page)
  const actualites = page.getByRole('region', { name: 'Actualités' })
  await expect(actualites).toBeVisible()
  await expect(actualites).toBeInViewport()
  const colonne = page.getByRole('complementary', { name: 'Aujourd’hui' })
  const traiter = colonne.getByRole('region', { name: 'À traiter' })
  await expect(traiter).toBeVisible()
  await expect(traiter.getByRole('region', { name: 'Tâches' }).getByRole('link', { name: 'Ouvrir' })).toHaveAttribute('href', '#/taches')
  const a = (await actualites.boundingBox())!
  const t = (await traiter.boundingBox())!
  expect(a.x + a.width).toBeLessThanOrEqual(t.x)
  expect(t.y).toBeLessThan(page.viewportSize()!.height / 2)
  await expect(page.getByRole('region', { name: 'Pilotage' })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-accueil-pilotage.png` })
})

// Choix 278 (Joseph, 17/11/2026) : le fil seul, façon LinkedIn ; « Mon point du jour » passe en picto dans la barre du
// haut, avec le nombre d'urgences, et ouvre une page : ma journée, puis À traiter par famille (429 à 436)
test('278 : téléphone, le fil seul et le point du jour en picto dans la barre du haut', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Disposition du téléphone')
  await seConnecter(page)
  const picto = page.getByRole('banner').getByRole('button', { name: /^Mon point du jour, .*\d+ à traiter/ })
  await expect(picto).toBeVisible()
  const b = (await picto.boundingBox())!
  expect(b.width).toBeGreaterThanOrEqual(48)
  expect(b.height).toBeGreaterThanOrEqual(48)
  // Le fil ouvre la page, plus de bande au-dessus
  await expect(page.getByRole('main').getByRole('region').first()).toHaveAttribute('aria-label', 'Actualités')
  await expect(page.getByRole('region', { name: 'Pilotage' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await picto.click()
  const point = page.getByRole('dialog', { name: 'Mon point du jour' })
  await expect(point.getByRole('region', { name: 'Pilotage' })).toHaveCount(0)
  await expect(point.getByRole('group', { name: 'Période des chiffres' })).toHaveCount(0)
  const traiter = point.getByRole('region', { name: 'À traiter' })
  await expect(traiter.getByRole('region').first()).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await point.getByRole('button', { name: 'Fermer' }).click()
  await expect(point).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Actualités' })).toBeVisible()
})
