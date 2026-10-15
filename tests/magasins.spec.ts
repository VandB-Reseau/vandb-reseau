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
  if (isMobile) await page.getByRole('button', { name: 'Filtres' }).click()
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
  await page.goto('./#/magasins?vue=liste')
  if (isMobile) await page.getByRole('heading', { name: 'Lyon Test' }).click()
  else await page.getByRole('row', { name: /Lyon Test/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Lyon Test' })).toBeVisible()
  await expect(page.getByText('Noé MODELE').first()).toBeVisible()
  await expect(page.getByText('Sam SUD')).toBeVisible()
  await expect(page.getByText('Intégré')).toBeVisible()
  await expect(page.getByText('Réaffectation')).toBeVisible()
  const carte = page.locator('iframe[title="Carte Google de Lyon Test"]')
  await carte.scrollIntoViewIfNeeded()
  await expect(carte).toBeVisible()
  const src = new URL((await carte.getAttribute('src'))!)
  expect(src.origin + src.pathname).toBe('https://www.google.com/maps')
  expect(src.searchParams.get('output')).toBe('embed')
  expect(src.searchParams.get('q')).toMatch(/^V and B .*Lyon/)
  expect((await carte.boundingBox())!.height).toBeGreaterThanOrEqual(290)
  await expect(page.frameLocator('iframe[title="Carte Google de Lyon Test"]').getByText('Carte simulée')).toBeVisible()
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
  await page.goto('./#/magasins?vue=carte')
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

test('la carte passe en plein écran et le titre ne bouge pas entre Liste et Carte', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  const titre = page.getByRole('heading', { name: 'Magasins', level: 1 })
  const recherche = page.getByRole('textbox').first()
  const avant = [await titre.boundingBox(), await recherche.boundingBox()]
  await page.getByRole('tab', { name: 'Carte' }).click()
  await expect(page.locator('.leaflet-container')).toBeVisible()
  expect([await titre.boundingBox(), await recherche.boundingBox()]).toEqual(avant)
  await page.getByRole('button', { name: 'Carte en plein écran' }).click()
  const vp = page.viewportSize()!
  await expect.poll(async () => (await page.locator('.leaflet-container').boundingBox())!.height).toBeGreaterThan(vp.height - 4)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Carte en plein écran' })).toBeVisible()
})

test('sur téléphone, les filtres des magasins et de la carte se replient derrière un bouton', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'Spécifique au téléphone')
  await seConnecter(page)
  await page.goto('./#/magasins?vue=carte')
  await expect(page.getByRole('button', { name: 'Statut' })).toHaveCount(0)
  await page.screenshot({ path: `captures/${info.project.name}-carte-filtres.png` })
  await page.getByRole('button', { name: 'Filtres' }).click()
  await expect(page.getByRole('button', { name: 'Statut' })).toBeVisible()
})

test('« Tous » coche toutes les options d’un filtre, puis on en exclut une', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  if (isMobile) await page.getByRole('button', { name: 'Filtres' }).click()
  await page.getByLabel('Filtre Type').click()
  await page.getByRole('menuitem', { name: 'Tous' }).click()
  await expect(page.getByText(/^30 (sur 30 )?magasins/)).toBeVisible()
  await page.getByRole('menuitem', { name: /Intégré/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText('25 sur 30 magasins')).toBeVisible()
})

test('après une mise en ligne, la carte se recharge au lieu de laisser une page blanche', async ({ page }) => {
  await seConnecter(page)
  // Ancien fichier de la carte introuvable une fois : la page se recharge et la carte s'affiche
  let refus = 0
  await page.route(/assets\/CarteMagasins-[^/]*\.js$/, (r) => (refus++ === 0 ? r.fulfill({ status: 404, body: '' }) : r.continue()))
  await page.goto('./#/magasins?vue=carte')
  await expect(page.locator('.leaflet-container')).toBeVisible()
  expect(refus).toBeGreaterThanOrEqual(2)
})

test('si la carte reste introuvable, un message propose de recharger', async ({ page }) => {
  await seConnecter(page)
  await page.route(/assets\/CarteMagasins-[^/]*\.js$/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.goto('./#/magasins?vue=carte')
  await expect(page.getByText('Cette page n’a pas pu s’afficher')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Recharger' })).toBeVisible()
  // Le menu reste utilisable
  await page.goto('./#/')
  await expect(page.getByRole('heading', { level: 1, name: /Bonjour|Bonsoir/ })).toBeVisible()
})
