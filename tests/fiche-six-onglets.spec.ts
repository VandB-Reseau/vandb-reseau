import { expect, test } from '@playwright/test'
import { ouvrirOnglet, seConnecter, textesTropPetits } from './supabase-simule'

// L3 (Joseph, 21/10/2026) : fiche magasin en six onglets ; le journal dans le fil, la santé avec les chiffres,
// les campagnes avec les tâches ; les anciens liens ouvrent l'onglet qui les accueille

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const largeurTenue = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

test('chaque onglet regroupé montre ses deux parties, sans déborder de l’écran', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByRole('region', { name: 'Fil du magasin' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Journal de Lyon Test' })).toBeVisible()
  expect(await largeurTenue(page)).toBe(true)
  await ouvrirOnglet(page, 'Chiffres')
  await expect(page.getByText(/En recul depuis le 1 oct\. 2026/)).toBeVisible()
  expect(await largeurTenue(page)).toBe(true)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-chiffres-sante.png`, fullPage: true })
  await ouvrirOnglet(page, 'Tâches')
  await expect(page.getByRole('heading', { name: 'Campagnes' })).toBeVisible()
  expect(await largeurTenue(page)).toBe(true)
})

for (const { ancienne, onglet, vu } of [
  { ancienne: 'sante', onglet: /^Chiffres/, vu: /En recul depuis le 1 oct\. 2026/ },
  { ancienne: 'journal', onglet: /^Fil$/, vu: 'Classé Cœur de réseau' },
]) {
  test(`un ancien lien ?vue=${ancienne} ouvre l’onglet qui l’accueille`, async ({ page, isMobile }) => {
    await seConnecter(page)
    await page.goto(`./#/magasins/Lyon%20Test?vue=${ancienne}`)
    if (!isMobile || ancienne === 'journal') await expect(page.getByRole('tablist', { name: 'Rubriques de Lyon Test' }).getByRole('tab', { name: onglet, selected: true })).toBeVisible()
    await expect(page.getByText(vu).first()).toBeInViewport()
  })
}

test('grand téléphone : quatre onglets avant « Plus », sans déborder même quand « Plus » porte un nom', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'téléphone seulement')
  await page.setViewportSize({ width: 430, height: 900 })
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByRole('tab', { name: 'Messages' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Autres rubriques' })).toBeVisible()
  await ouvrirOnglet(page, 'Chiffres')
  await expect(page.getByRole('tab', { name: /Chiffres et santé, autres rubriques/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Messages' })).toBeVisible()
  const droite = await page.evaluate(() => Math.max(...[...document.querySelectorAll('.onglets-fiche [role=tab]')].map((t) => t.getBoundingClientRect().right)))
  expect(droite).toBeLessThanOrEqual(430 - 16)
})
