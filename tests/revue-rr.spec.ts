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

test('la revue du mois d’un RR : décrochages, visites par Coach, tâches en retard', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe/rr/rr2?vue=revue&mois=2026-09')
  await expect(page.getByRole('heading', { name: 'Revue de septembre 2026 · Sam SUD' })).toBeVisible()
  const decrochent = page.getByRole('region', { name: 'Magasins qui décrochent' })
  await expect(decrochent.getByRole('link', { name: 'Lyon Test' })).toBeVisible()
  await expect(decrochent).toContainText('CA −30,0 %')
  await expect(decrochent).toContainText('Décroche')
  await expect(decrochent).not.toContainText('Annecy Test')
  const visites = page.getByRole('region', { name: 'Visites par Coach' })
  await expect(visites.getByRole('link', { name: 'Noé MODELE' })).toBeVisible()
  await expect(visites.getByLabel(/^1 visite pour une référence de/)).toBeVisible()
  const retards = page.getByRole('region', { name: 'Tâches en retard' })
  await expect(retards).toContainText('Refaire la vitrine')
  await expect(retards).not.toContainText('Changer l’enseigne')
  await expect(retards).not.toContainText('Former l’équipe')
  await expect(page.getByRole('region', { name: 'Changements de case' })).toContainText('Aucun magasin n’a changé de case')
  await expect(page.getByRole('button', { name: 'Télécharger en PDF' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-revue-rr.png`, fullPage: !isMobile })
})

test('changer de mois : la nine box du mois et les chiffres pas encore saisis', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/equipe/rr/rr2?vue=revue&mois=2026-09')
  await page.getByRole('combobox', { name: 'Mois' }).click()
  await page.getByRole('option', { name: 'octobre 2026' }).click()
  await expect(page).toHaveURL(/mois=2026-10/)
  const cases = page.getByRole('region', { name: 'Changements de case' })
  await expect(cases.getByRole('link', { name: 'Lyon Test' })).toBeVisible()
  await expect(cases.getByLabel('Cœur de réseau vers Redressement urgent')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Magasins qui décrochent' })).toContainText('pas encore saisis')
  expect((await page.getByRole('combobox', { name: 'Mois' }).boundingBox())!.height).toBeGreaterThanOrEqual(48)
})
