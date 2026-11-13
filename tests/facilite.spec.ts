import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'
import { zonesTropPetites } from './pilotage/supabase-simule'

// Facilité d'usage (choix 114 à 124, Joseph 13/11/2026). Données fictives uniquement.

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

async function lisible(page: Page, isMobile: boolean) {
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
}

test('116 : montrer au franchisé, les chiffres du magasin en grand et rien d’interne', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Annecy%20Test')
  await expect(page.getByText('Nine box :')).toBeVisible()
  await page.getByRole('button', { name: 'Montrer au franchisé' }).click()
  const presentation = page.getByRole('dialog', { name: 'Annecy Test' })
  await expect(presentation.getByRole('heading', { name: 'Annecy Test' })).toBeVisible()
  await expect(presentation.getByRole('region', { name: /^Chiffre d’affaires de / })).toContainText(/tu fais .* qu’en /)
  await expect(presentation.getByRole('group', { name: 'Panier moyen HT Cave' })).toBeVisible()
  // Liste blanche : ni Nine box, ni santé, ni médiane, ni note, ni tâche
  for (const interne of [/Nine box/i, /médiane/i, /santé/i, /note/i, /tâche/i, /appréciation/i]) await expect(presentation).not.toContainText(interne)
  // La fiche reste derrière la présentation : on contrôle les textes, et la seule zone tactile de la présentation
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect((await presentation.getByRole('button', { name: 'Fermer' }).boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await page.screenshot({ path: `captures/${info.project.name}-montrer-au-franchise.png` })
  await presentation.getByRole('button', { name: 'Fermer' }).click()
  await expect(presentation).toHaveCount(0)
})
