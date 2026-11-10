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

// Refonte (Joseph, 09/11/2026, 2A) : la rubrique Réglages tient Équipe et Paramètres ; l'Évolution du parc est une vue de Magasins
test('Réglages en deux entrées : Équipe, Paramètres', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/parametres/reglages')
  if (!isMobile) {
    const menu = page.getByRole('navigation', { name: 'Navigation principale' })
    // Vague 5 (51A) : Équipe et Paramètres dans le menu du compte
    await page.getByRole('button', { name: 'Mon compte' }).click()
    for (const l of ['Équipe', 'Paramètres']) await expect(page.getByRole('menuitem', { name: l, exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu.getByRole('button', { name: 'Évolution du parc', exact: true })).toHaveCount(0)
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

test('Campagnes passent dans Santé du parc, Bonnes pratiques dans Infos réseau', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/visites')
  const onglets = page.getByRole('tablist', { name: 'Rubriques des visites' })
  await expect(onglets).not.toContainText('Campagnes')
  await expect(onglets).not.toContainText('Pratiques')
  await page.goto('./#/visites?vue=campagnes')
  // Vague 3 (27A) : les campagnes ont leur page, dans la rubrique Animation
  await expect(page).toHaveURL(/#\/campagnes\?vue=campagnes/)
  await expect(page.getByRole('heading', { name: 'Campagnes', level: 1 })).toBeVisible()
  // Bonnes pratiques : Infos réseau (sprint 22, S1)
  await page.goto('./#/visites?vue=pratiques')
  await expect(page).toHaveURL(/#\/infos\?vue=pratiques$/)
  await expect(page.getByRole('heading', { name: 'Actualités', level: 1 })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-echanges-pratiques.png`, fullPage: !isMobile })
})
