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

test('114 : sans réseau, la note et la tâche sont gardées sur l’appareil et partent au retour du réseau', async ({ page, context, isMobile }, info) => {
  const envois: string[] = []
  page.on('request', (r) => { if (r.url().includes('suivi_magasins') && ['POST', 'PATCH'].includes(r.method())) envois.push(r.postData() ?? '') })
  await seConnecter(page)
  await page.goto('./#/magasins/Annecy%20Test')
  await expect(page.getByRole('button', { name: 'Montrer au franchisé' })).toBeVisible()
  await context.setOffline(true)
  // Note créée en réserve
  await page.getByRole('main').getByRole('button', { name: 'Ajouter', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Note', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Note', { exact: true }).or(page.getByRole('dialog').getByRole('textbox', { name: /Note|Texte/ })).first().fill('Vitrine refaite, à revoir en décembre')
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Note gardée sur l’appareil : elle partira seule au retour du réseau.')).toBeVisible()
  // Tâche créée aussi
  await page.getByRole('main').getByRole('button', { name: 'Ajouter', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Tâche', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Tâche', { exact: true }).fill('Commander les présentoirs de Noël')
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Tâche gardée sur l’appareil : elle partira seule au retour du réseau.')).toBeVisible()
  const compteur = page.getByRole('button', { name: /^2 en attente d’envoi/ })
  await expect(compteur).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-sans-reseau.png` })
  expect(envois).toEqual([])
  // Retour du réseau : tout part seul, dans l'ordre de saisie
  await context.setOffline(false)
  await expect(compteur).toHaveCount(0)
  await expect.poll(() => envois.some((e) => e.includes('Vitrine refaite'))).toBe(true)
  await expect.poll(() => envois.some((e) => e.includes('Commander les présentoirs de Noël'))).toBe(true)
  void isMobile
})
