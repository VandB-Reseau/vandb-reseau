import { expect, test } from '@playwright/test'
import { actionFiche, seConnecter, textesTropPetits } from './supabase-simule'

// Fiche magasin (Joseph, 26/10/2026) : « Modifier la fiche » ne garde que le référentiel ; la santé et les déploiements
// se modifient dans Santé du parc ; le Concept 2.0 est montré à côté du nom

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('« Modifier la fiche » ne propose plus la santé ni les déploiements', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  await actionFiche(page, 'Modifier la fiche')
  const d = page.getByRole('dialog', { name: 'Modifier Lyon Test' })
  await expect(d.getByLabel('Typologie')).toBeVisible()
  await expect(d.getByRole('heading', { name: 'Santé (nine box)' })).toHaveCount(0)
  await expect(d.getByRole('heading', { name: 'Déploiements' })).toHaveCount(0)
  await expect(d.getByLabel('Date du classement')).toHaveCount(0)
  await expect(d.getByRole('button', { name: /^Fort : / })).toHaveCount(0)
})

test('le Concept 2.0 se voit à côté du nom du magasin', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  const entete = page.getByRole('heading', { level: 1, name: 'Lyon Test' }).locator('..')
  await expect(entete.getByText('Concept 2.0', { exact: true })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-concept20.png` })
  await page.goto('./#/magasins/Annecy%20Test')
  await expect(page.getByRole('heading', { level: 1, name: 'Annecy Test' }).locator('..').getByText('Concept 2.0 en cours', { exact: true })).toBeVisible()
  await page.goto('./#/magasins/Nantes%20Test')
  await expect(page.getByRole('heading', { level: 1, name: 'Nantes Test' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Nantes Test' }).locator('..').getByText(/Concept 2\.0/)).toHaveCount(0)
})
