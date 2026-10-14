import { expect, test } from '@playwright/test'
import { seConnecter } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('la liste affiche tous les magasins et se filtre', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  await expect(page.getByText('30 magasins dans le réseau')).toBeVisible()
  await page.getByLabel('Rechercher dans les magasins').fill('nantes')
  await expect(page.getByText('1 sur 30 magasins')).toBeVisible()
  await page.getByLabel('Rechercher dans les magasins').fill('')
  await page.getByLabel('Filtre Type').click()
  await page.getByRole('menuitem', { name: /Intégré/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText('5 sur 30 magasins')).toBeVisible()
  await page.getByLabel('Filtre Coach').click()
  await page.getByRole('menuitem', { name: /Camille TESTARD/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText(/sur 30 magasins/)).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-magasins-filtres.png`, fullPage: !isMobile })
  await page.getByRole('button', { name: 'Effacer les filtres' }).click()
  await expect(page.getByText('30 magasins dans le réseau')).toBeVisible()
})

test('les filtres restent dans l’adresse', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins?statut=preouverture')
  await expect(page.getByText('2 sur 30 magasins')).toBeVisible()
})

test('la fiche magasin regroupe équipe, coordonnées et historique', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  if (isMobile) await page.getByRole('heading', { name: 'Lyon Test' }).click()
  else await page.getByRole('row', { name: /Lyon Test/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Lyon Test' })).toBeVisible()
  await expect(page.getByText('Noé MODELE').first()).toBeVisible()
  await expect(page.getByText('Sam SUD')).toBeVisible()
  await expect(page.getByText('Intégré')).toBeVisible()
  await expect(page.getByText('Réaffectation')).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-fiche.png`, fullPage: true })
  await page.getByRole('button', { name: 'Magasins' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Magasins' })).toBeVisible()
})

test('un magasin inconnu affiche un message clair', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Inexistant')
  await expect(page.getByText('Magasin introuvable')).toBeVisible()
})

test('la recherche globale ouvre une fiche magasin ou une fiche Coach', async ({ page, isMobile }) => {
  await seConnecter(page)
  if (isMobile) await page.getByRole('button', { name: 'Rechercher' }).click()
  const champ = page.getByLabel('Recherche globale')
  await champ.fill('bordeaux')
  await page.getByRole('option', { name: /^Bordeaux Test/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Bordeaux Test' })).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: 'Rechercher' }).click()
  await page.getByLabel('Recherche globale').fill('inès')
  await page.getByRole('option', { name: /^Inès EXEMPLE/ }).click()
  await expect(page.getByRole('heading', { name: 'Inès EXEMPLE', level: 1 })).toBeVisible()
})

test('la carte affiche les magasins et leur légende', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/plus/carte')
  await expect(page.getByRole('tab', { name: 'Carte', selected: true })).toBeVisible()
  await expect(page.locator('path.leaflet-interactive:not(.zone-coach):not(.zone-rr)')).toHaveCount(30)
  // Zones des Coachs affichées par défaut, légende par Coach
  await expect(page.getByLabel('Légende de la carte').getByText('Camille TESTARD')).toBeVisible()
  // La carte occupe la hauteur restante : pas de défilement de page, au moins 40 % de l'écran
  const boite = await page.locator('.leaflet-container').boundingBox()
  const ecran = page.viewportSize()!
  expect(boite!.height).toBeGreaterThan(ecran.height * 0.4)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true)
  await page.screenshot({ path: `captures/${info.project.name}-carte.png` })
})

test('une panne de la base affiche un message et un bouton Réessayer', async ({ page }) => {
  await seConnecter(page, { panne: true })
  await page.goto('./#/magasins')
  await expect(page.getByText('Impossible de charger le réseau')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible()
})
