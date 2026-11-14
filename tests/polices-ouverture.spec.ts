import { expect, test } from '@playwright/test'
import { seConnecter } from './supabase-simule'

// Joseph (14/11/2026) : le mois de l'Agenda changeait de police juste après l'ouverture. Les polices de la charte sont
// préchargées et l'app attend qu'elles soient prêtes avant son premier affichage : aucun texte en police de secours.

test('polices de la charte prêtes dès le premier affichage, Agenda compris', async ({ page }) => {
  // Relevé pris à l'instant où l'app dessine pour la première fois
  await page.addInitScript(() => {
    const w = window as unknown as { premierAffichage?: boolean[] }
    new MutationObserver((_m, obs) => {
      if (!document.getElementById('root')?.firstChild) return
      w.premierAffichage = ['400 16px Lato', '700 16px Lato', '900 16px Lato', '700 18px Alegreya', '800 22px Alegreya'].map((p) => document.fonts.check(p))
      obs.disconnect()
    }).observe(document, { childList: true, subtree: true })
  })
  await seConnecter(page)
  // Les cinq fichiers de police (jeu latin) sont annoncés dans la page, avant le code
  expect(await page.locator('link[rel="preload"][as="font"]').count()).toBe(5)

  await page.goto('./#/plus/agenda')
  const mois = page.getByRole('heading', { level: 2 }).filter({ hasText: /\d{4}/ }).first()
  await expect(mois).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { premierAffichage?: boolean[] }).premierAffichage)).toEqual([true, true, true, true, true])
  expect(await mois.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/^"?Alegreya/)
})
