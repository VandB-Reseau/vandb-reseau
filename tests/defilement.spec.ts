import { expect, test } from '@playwright/test'
import { seConnecter } from './supabase-simule'

// Barre de défilement visible, comme sur un PC Windows (le navigateur de test la masque par défaut)
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

test('ouvrir un filtre ne décale pas la page', async ({ page, isMobile }) => {
  test.skip(isMobile, 'La barre de défilement ne concerne que le PC')
  await seConnecter(page)
  await page.goto('./#/magasins?vue=liste')
  const puce = page.locator('[aria-label="Filtre Coach"]')
  const largeur = () => page.evaluate(() => document.querySelector('main')!.getBoundingClientRect().width)
  const avant = await largeur()
  await puce.click()
  await expect(page.getByRole('menu')).toBeVisible()
  // La page n'est ni bloquée ni rétrécie pendant que le menu est ouvert
  const style = await page.evaluate(() => `${document.documentElement.getAttribute('style') ?? ''}${document.body.getAttribute('style') ?? ''}`)
  expect(style).not.toContain('padding-right')
  expect(style).not.toContain('overflow: hidden')
  expect(await largeur()).toBe(avant)
})

const hauteur = (page: import('@playwright/test').Page) => page.evaluate(() => window.scrollY)

test('une fiche s’ouvre en haut et le retour retrouve la liste où on l’avait laissée', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins?vue=liste')
  const dernier = isMobile ? page.locator('main h3, main h2').filter({ hasText: /Test/ }).last() : page.getByRole('row').last()
  await dernier.scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 200)
  await expect.poll(() => hauteur(page)).toBeGreaterThan(300)
  const position = await hauteur(page)
  await dernier.click()
  await expect(page).toHaveURL(/#\/magasins\/[^?]+$/)
  await expect.poll(() => hauteur(page)).toBe(0)
  await page.goBack()
  await expect.poll(() => hauteur(page)).toBeGreaterThan(position - 50)
})

test('changer d’onglet ou de rubrique ramène en haut', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/equipe?vue=organisation&forme=liste')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect.poll(() => hauteur(page)).toBeGreaterThan(100)
  await page.evaluate(() => document.querySelector<HTMLElement>('[role="tab"]:not([aria-selected="true"])')!.click())
  await expect.poll(() => hauteur(page)).toBe(0)
  await page.goto('./#/magasins?vue=liste')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect.poll(() => hauteur(page)).toBeGreaterThan(100)
  await page.evaluate(() => (location.hash = '#/visites'))
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect.poll(() => hauteur(page)).toBe(0)
})
