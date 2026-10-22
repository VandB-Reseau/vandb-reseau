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

test('PC : quatre colonnes par magasin, triées par leur titre', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Colonnes du PC')
  await seConnecter(page)
  await page.goto('./#/magasins?vue=liste')
  const titres = page.getByRole('group', { name: 'Trier par colonne' })
  await expect(titres.getByRole('button')).toHaveText(['Magasin', 'CA vs N-1', 'Case', 'Vu', 'Tâches'])
  await expect(page.getByRole('group', { name: 'Trier par', exact: true })).toHaveCount(0)
  const lyon = page.getByRole('link').filter({ hasText: 'Lyon Test' }).first()
  await expect(lyon).toContainText('−30,0 %')
  await expect(lyon).toContainText('Redressement urgent')
  await expect(lyon).toContainText('Décroche')
  await titres.getByRole('button', { name: 'Trier par Case' }).click()
  await expect(page).toHaveURL(/tri=case/)
  await expect(page.getByRole('region', { name: 'Liste des magasins' }).getByRole('link').first()).toContainText('Redressement urgent')
  await titres.getByRole('button', { name: 'Trier par Tâches' }).click()
  await expect(page).toHaveURL(/tri=taches/)
  await titres.getByRole('button', { name: 'Magasin' }).click()
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
