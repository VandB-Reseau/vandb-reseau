import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Magasins sur PC large (sprint 21, D2) : CA vs N-1, case nine box, dernière visite et tâches en colonnes,
// triées d'un clic sur leur titre ; le téléphone garde une seule info à droite

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

// Refonte (Joseph, 09/11/2026, 5A) : sur PC, un vrai tableau, colonnes triables par leur titre
test('PC : un tableau des magasins, trié par le titre des colonnes', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Colonnes du PC')
  await seConnecter(page)
  await page.goto('./#/magasins?vue=liste')
  const tableau = page.getByRole('table', { name: 'Tableau des magasins' })
  await expect(tableau.getByRole('columnheader')).toHaveText(['Magasin', 'Coach', 'Responsable Régional', 'CA du mois', 'vs N-1', 'Nine box', 'Dernière visite', 'Tâches'])
  const lyon = tableau.getByRole('row').filter({ has: page.getByRole('link', { name: 'Lyon Test', exact: true }) })
  await expect(lyon).toContainText('−30,0 %')
  await expect(lyon).toContainText('Redressement urgent')
  await expect(lyon).toContainText('Décroche')
  await tableau.getByRole('button', { name: 'Trier par nine box' }).click()
  await expect(page).toHaveURL(/tri=case/)
  await expect(tableau.getByRole('row').nth(1)).toContainText('Redressement urgent')
  await tableau.getByRole('button', { name: 'Trier par tâches' }).click()
  await expect(page).toHaveURL(/tri=taches/)
  await tableau.getByRole('button', { name: 'Trier par magasin' }).click()
  await expect(page).not.toHaveURL(/tri=/)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-magasins-colonnes.png` })
})

test('téléphone : une seule info à droite, pas de colonnes', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Téléphone')
  await seConnecter(page)
  await page.goto('./#/magasins?vue=liste')
  await expect(page.getByRole('group', { name: 'Trier par colonne' })).toHaveCount(0)
  // Plus de puces de tri au téléphone : la page Visites suffit (Joseph, 22/10/2026)
  await expect(page.getByRole('group', { name: 'Trier par', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link').filter({ hasText: 'Lyon Test' }).first()).not.toContainText('Redressement urgent')
})
