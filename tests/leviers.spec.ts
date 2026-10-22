import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Leviers du CA (sprint 21, F1) : panier face au réseau, flux face à N-1, levier le plus en retrait nommé ;
// filtre Levier dans Magasins

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

// Réseau fictif de septembre 2026 : panier cave autour de 38 €, panier bar autour de 14 €
const reperesEquipe = { mois: '2026-09', indicateurs: {
  pmCave: { n: 40, quartBas: 34, mediane: 38, quartHaut: 42 },
  pmBar: { n: 40, quartBas: 12.5, mediane: 14, quartHaut: 15.5 },
  fluxCave: { n: 40, quartBas: 1200, mediane: 1600, quartHaut: 2000 },
  fluxBar: { n: 40, quartBas: 1500, mediane: 2200, quartHaut: 2800 },
} }

test('la fiche nomme le levier : flux cave pour Lyon, qui perd 30 % de clients', async ({ page }, info) => {
  await seConnecter(page, { reperesEquipe })
  await page.goto('#/magasins/Lyon%20Test?vue=chiffres')
  const section = page.getByRole('heading', { name: 'Leviers · septembre 2026' })
  await expect(section).toBeVisible()
  await expect(page.getByText('Levier : flux cave')).toBeVisible()
  const lignes = page.getByRole('list', { name: 'Panier et flux' }).getByRole('listitem')
  await expect(lignes).toHaveCount(4)
  await expect(lignes.nth(0)).toContainText('Panier cave · 40,00 €')
  await expect(lignes.nth(0)).toContainText('+5,3 % vs réseau')
  await expect(lignes.nth(1)).toContainText('−30,0 % vs N-1')
  await expect(lignes.nth(2)).toContainText('Réseau : 12,50 € à 15,50 €')
  expect(await textesTropPetits(page)).toEqual([])
  await section.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `captures/${info.project.name}-leviers-fiche.png` })
})

test('Magasins : le filtre Levier isole les paniers bar en retrait', async ({ page, isMobile }, info) => {
  await seConnecter(page, { reperesEquipe })
  await page.goto('./#/magasins?vue=liste')
  if (isMobile) await page.getByRole('button', { name: 'Filtres' }).click()
  await page.getByRole('button', { name: 'Filtre Levier' }).click()
  await expect(page.getByRole('menuitem', { name: /^Panier bar/ })).toContainText('2 magasins')
  await page.getByRole('menuitem', { name: /^Panier bar/ }).click()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/levier=pmBar/)
  await expect(page.getByText(/^2 sur \d+ magasins$/)).toBeVisible()
  await expect(page.getByRole('link', { name: /Nantes Test/ }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Annecy Test/ }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Lyon Test/ })).toHaveCount(0)
  await page.screenshot({ path: `captures/${info.project.name}-leviers-filtre.png` })
})

test('sans repères du réseau, la fiche compare au moins à N-1', async ({ page }) => {
  await seConnecter(page, { reperesEquipe: null })
  await page.goto('#/magasins/Lyon%20Test?vue=chiffres')
  await expect(page.getByText('Levier : flux cave')).toBeVisible()
  await expect(page.getByText('vs réseau')).toHaveCount(0)
})
