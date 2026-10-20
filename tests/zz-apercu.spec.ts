import { test } from '@playwright/test'
import { seConnecter } from './supabase-simule'
const D = '/tmp/claude-0/-home-user-vandb-reseau/8ab7bcf0-1a52-5b49-a9e2-f67b18bd8179/scratchpad/apercu'
test('aperçu', async ({ page }, info) => {
  await seConnecter(page)
  const n = info.project.name
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${D}/${n}-accueil.png`, fullPage: true })
  for (const [u, nom] of [['/magasins?vue=liste', 'magasins'], ['/magasins/Lyon%20Test', 'fiche'], ['/plus/sante?vue=chiffres', 'sante'], ['/visites', 'visites'], ['/equipe', 'equipe']]) {
    await page.goto('./#' + u)
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${D}/${n}-${nom}.png`, fullPage: true })
  }
  await page.goto('./#/')
  await page.getByRole('button', { name: 'Créer' }).first().click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${D}/${n}-creer.png` })
  await page.getByRole('button', { name: 'Visite' }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${D}/${n}-visite.png` })
})
