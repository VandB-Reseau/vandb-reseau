import { expect, test } from '@playwright/test'
import { seConnecter, type Ecriture } from './supabase-simule'

// Favoris, vues et canal Réseau suivent le compte (sprint 21, F4 ; table preferences, migration 0021)

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('un appareil neuf retrouve les favoris et les vues du compte', async ({ page }) => {
  await seConnecter(page, { preferences: { suivis: { favoris: ['Nantes Test'], recents: [] }, vues: [{ nom: 'Décrocheurs', adresse: 'alerte=decroche' }] } })
  await page.goto('./#/magasins?vue=liste')
  await expect(page.getByRole('region', { name: 'Favoris' }).getByRole('link', { name: /Nantes Test/ })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Vues enregistrées' }).getByRole('button', { name: /Décrocheurs/ }).first()).toBeVisible()
})

test('un favori ajouté part dans la base, au nom du compte', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, preferences: {} })
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Autres actions' }).click()
  await page.getByRole('menuitem', { name: 'Ajouter aux favoris' }).click()
  await expect.poll(() => ecritures.filter((e) => e.table === 'preferences').length).toBeGreaterThan(0)
  const derniere = ecritures.filter((e) => e.table === 'preferences').at(-1)!
  expect((derniere.corps as { valeur: { suivis: { favoris: string[] } } }).valeur.suivis.favoris).toEqual(['Lyon Test'])
})

test('sans la table, tout reste sur l’appareil, sans erreur', async ({ page }) => {
  await seConnecter(page, { preferences: null })
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Autres actions' }).click()
  await page.getByRole('menuitem', { name: 'Ajouter aux favoris' }).click()
  await page.goto('./#/magasins?vue=liste')
  await expect(page.getByRole('region', { name: 'Favoris' }).getByRole('link', { name: /Lyon Test/ })).toBeVisible()
})
