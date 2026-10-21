import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// L4 (Joseph, 21/10/2026) : favoris et fiches ouvertes récemment en tête de Magasins et de la recherche globale

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('une fiche ouverte apparaît dans « Consultés récemment », une étoile la passe en Favoris', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins?vue=liste')
  await expect(page.getByRole('region', { name: 'Liste des magasins' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Consultés récemment' })).toHaveCount(0)

  await page.goto('./#/magasins/Nantes%20Test')
  await expect(page.getByRole('heading', { level: 1, name: 'Nantes Test' })).toBeVisible()
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByRole('heading', { level: 1, name: 'Lyon Test' })).toBeVisible()
  await page.getByRole('button', { name: 'Autres actions' }).click()
  const ajouter = page.getByRole('menuitem', { name: 'Ajouter aux favoris' })
  expect((await ajouter.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await ajouter.click()

  await page.goto('./#/magasins?vue=liste')
  const favoris = page.getByRole('region', { name: 'Favoris' })
  const recents = page.getByRole('region', { name: 'Consultés récemment' })
  await expect(favoris.getByRole('link', { name: /Lyon Test/ })).toBeVisible()
  await expect(recents.getByRole('link', { name: /Nantes Test/ })).toBeVisible()
  await expect(recents.getByRole('link', { name: /Lyon Test/ })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-magasins-favoris-recents.png` })

  // Gardés au rechargement de la page
  await page.reload()
  await expect(page.getByRole('region', { name: 'Favoris' }).getByRole('link', { name: /Lyon Test/ })).toBeVisible()

  // Un filtre posé : la liste ne montre plus que les résultats
  await page.goto('./#/magasins?vue=liste&q=Agen')
  await expect(page.getByRole('region', { name: 'Favoris' })).toHaveCount(0)

  // Retirer des favoris
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Autres actions' }).click()
  await page.getByRole('menuitem', { name: 'Retirer des favoris' }).click()
  await page.goto('./#/magasins?vue=liste')
  await expect(page.getByRole('region', { name: 'Favoris' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Consultés récemment' }).getByRole('link', { name: /Lyon Test/ })).toBeVisible()
})

test('recherche globale : favoris et récents proposés dès qu’on touche le champ', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Brest%20Test')
  await expect(page.getByRole('heading', { level: 1, name: 'Brest Test' })).toBeVisible()
  await page.getByRole('button', { name: 'Autres actions' }).click()
  await page.getByRole('menuitem', { name: 'Ajouter aux favoris' }).click()
  await page.goto('./#/magasins/Agen%20Test')
  await expect(page.getByRole('heading', { level: 1, name: 'Agen Test' })).toBeVisible()

  await page.goto('./#/')
  const champ = page.getByLabel('Recherche globale')
  await champ.click()
  const liste = page.getByRole('listbox')
  await expect(liste.getByText('Favoris', { exact: true })).toBeVisible()
  await expect(liste.getByText('Consultés récemment', { exact: true })).toBeVisible()
  const options = liste.getByRole('option')
  await expect(options.first()).toContainText('Brest Test')
  await expect(options.nth(1)).toContainText('Agen Test')
  expect((await options.first().boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await page.screenshot({ path: `captures/${info.project.name}-recherche-favoris-recents.png` })

  // En tapant, la recherche reprend sans doublon
  await champ.fill('Brest')
  await expect(liste.getByText('Favoris', { exact: true })).toHaveCount(0)
  await expect(liste.getByRole('option', { name: /^Brest Test/ })).toHaveCount(1)
  await liste.getByRole('option', { name: /^Brest Test/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Brest Test' })).toBeVisible()
})
