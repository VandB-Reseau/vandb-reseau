import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// L5 (Joseph, 21/10/2026) : vues enregistrées dans Magasins (filtres et tri sous un nom, gardés sur l'appareil),
// avec un filtre Alerte : décroche, à surveiller, pas vu depuis longtemps

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('enregistrer une vue, la retrouver en un toucher, la retirer', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins?vue=liste&alerte=visite&tri=visite')
  const sousTitre = page.getByText(/^\d+ sur \d+ magasins$/)
  await expect(sousTitre).toBeVisible()
  const filtre = (await sousTitre.textContent())!
  const vues = page.getByRole('group', { name: 'Vues enregistrées' })
  await vues.getByRole('button', { name: 'Enregistrer la vue' }).click()
  const d = page.getByRole('dialog', { name: 'Enregistrer la vue' })
  await expect(d.getByLabel('Nom de la vue')).toHaveValue('Pas vu depuis longtemps')
  await d.getByLabel('Nom de la vue').fill('À voir cette semaine')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(vues.getByRole('button', { name: 'À voir cette semaine', pressed: true })).toBeVisible()
  expect((await vues.getByRole('button', { name: 'Retirer cette vue' }).boundingBox())!.height).toBeGreaterThanOrEqual(48)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-vues-magasins.png` })

  // Gardée sur l'appareil : retrouvée sans filtre, après rechargement
  await page.goto('./#/magasins?vue=liste')
  await page.reload()
  await expect(page.getByText(/^\d+ ouverts · \d+ à venir$/)).toBeVisible()
  await vues.getByRole('button', { name: 'À voir cette semaine', pressed: false }).click()
  await expect(page).toHaveURL(/alerte=visite/)
  await expect(page).toHaveURL(/tri=visite/)
  await expect(page.getByText(filtre, { exact: true })).toBeVisible()
  await vues.getByRole('button', { name: 'Retirer cette vue' }).click()
  await expect(vues.getByRole('button', { name: 'À voir cette semaine' })).toHaveCount(0)
  await expect(vues.getByRole('button', { name: 'Enregistrer la vue' })).toBeVisible()
})

test('sans vue ni filtre, rien n’est ajouté au-dessus de la liste', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins?vue=liste')
  await expect(page.getByText(/^\d+ ouverts · \d+ à venir$/)).toBeVisible()
  await expect(page.getByRole('group', { name: 'Vues enregistrées' })).toHaveCount(0)
})

test('le filtre Alerte garde les magasins qui décrochent', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins?vue=liste')
  if (isMobile) await page.getByRole('button', { name: 'Filtres' }).click()
  await page.getByRole('button', { name: 'Filtre Alerte' }).click()
  await page.getByRole('menuitem', { name: /^Décroche/ }).click()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/alerte=decroche/)
  await expect(page.getByText(/^\d+ sur \d+ magasins$/)).toBeVisible()
})
