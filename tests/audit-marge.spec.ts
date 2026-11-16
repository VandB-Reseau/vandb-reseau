import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// 244 (Joseph, 16/11/2026) : sa check-list « Audit de marge » devient une grille d'audit toute prête
test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('244 : grille « Audit de marge » dans Paramètres et dans la visite', async ({ page }) => {
  await seConnecter(page, {})
  await page.goto('./#/parametres/reglages?rubrique=audits')
  const carte = page.getByRole('heading', { name: 'Grilles d’audit' }).locator('xpath=ancestor::div[contains(@class,"MuiCard-root")]')
  await carte.getByRole('tab', { name: 'Audit de marge' }).click()
  await expect(carte.getByLabel('Thème').first()).toHaveValue('Commande')
  await expect(carte.getByLabel('Point 1').first()).toHaveValue('Commandes ajustées à l’activité réelle (stock de quelques références sondé face aux ventes)')
  expect(await textesTropPetits(page)).toEqual([])

  await page.goto('./#/magasins/Annecy%20Test?vue=visites')
  await page.getByRole('button', { name: 'Saisir', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await d.getByRole('region', { name: 'Visite' }).getByRole('button', { name: 'Modifier' }).click()
  await d.getByLabel('Type').click()
  await page.getByRole('option', { name: 'Audit de marge' }).click()
  const grille = d.getByRole('region', { name: 'Grille audit de marge' })
  await expect(grille.getByText('Pertes notées et valorisées')).toBeVisible()
})
