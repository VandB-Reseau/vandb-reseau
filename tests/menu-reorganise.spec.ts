import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('Paramètres en trois entrées : Équipe, Évolution du parc, Paramètres', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/parametres/reglages')
  if (!isMobile) {
    const menu = page.getByRole('navigation', { name: 'Navigation principale' })
    for (const l of ['Équipe', 'Évolution du parc', 'Paramètres']) await expect(menu.getByRole('button', { name: l, exact: true })).toBeVisible()
    for (const l of ['Charge des Coachs', 'Collaborateurs', 'Franchisés', 'Import et export']) await expect(menu.getByRole('button', { name: l, exact: true })).toHaveCount(0)
  }
  const sommaire = page.getByRole('region', { name: 'Rubriques des paramètres' })
  await sommaire.getByRole('link', { name: 'Charge des Coachs' }).click()
  await expect(page.getByRole('heading', { name: 'Charge des Coachs', level: 1 })).toBeVisible()
  await page.getByRole('link', { name: 'Paramètres', exact: true }).click()
  await page.getByRole('region', { name: 'Rubriques des paramètres' }).getByRole('link', { name: 'Import et export' }).click()
  await expect(page.getByRole('heading', { name: 'Import et export', level: 1 })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-parametres-trois-entrees.png` })
})

test('Collaborateurs et Franchisés sont des onglets de l’Équipe ; les anciennes adresses y mènent', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/parametres/franchises')
  await expect(page).toHaveURL(/#\/equipe\?vue=franchises/)
  await expect(page.getByRole('heading', { name: 'Équipe', level: 1 })).toBeVisible()
  await page.goto('./#/parametres/collaborateurs')
  await expect(page).toHaveURL(/#\/equipe\?vue=collaborateurs/)
})

test('Campagnes passent dans Santé du parc, Bonnes pratiques dans Échanges', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/visites')
  const onglets = page.getByRole('tablist', { name: 'Rubriques des visites' })
  await expect(onglets).not.toContainText('Campagnes')
  await expect(onglets).not.toContainText('Pratiques')
  await page.goto('./#/visites?vue=campagnes')
  await expect(page).toHaveURL(/#\/plus\/sante\?vue=campagnes/)
  await expect(page.getByRole('tablist', { name: 'Rubriques de la santé du parc' })).toContainText('Campagnes')
  await page.goto('./#/visites?vue=pratiques')
  await expect(page).toHaveURL(/#\/echanges\/pratiques/)
  await expect(page.getByRole('heading', { name: 'Bonnes pratiques' })).toBeVisible()
  await page.goto('./#/echanges')
  const epingle = page.getByRole('list', { name: 'Conversations' }).getByRole('button', { name: 'Bonnes pratiques' })
  await expect(epingle).toBeVisible()
  expect((await epingle.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await epingle.click()
  await expect(page).toHaveURL(/#\/echanges\/pratiques/)
  await expect(page.getByRole('button', { name: 'Ajouter une bonne pratique' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-echanges-pratiques.png`, fullPage: !isMobile })
})
