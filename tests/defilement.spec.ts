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
