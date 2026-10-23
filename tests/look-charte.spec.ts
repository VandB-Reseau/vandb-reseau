import { expect, test } from '@playwright/test'
import { actionFiche, seConnecter, simulerSupabase, textesTropPetits, type Ecriture } from './supabase-simule'

// Look V and B selon la charte graphique officielle (Joseph, 23/10/2026) : palette en duos sans bleu, Lato et
// Alegreya (proche de Coline), filet en aplats, intitulés en cartouche, illustrations de la charte dans les états vides,
// blasons de ville à la place des initiales des magasins, bulles vides sur la carte, compte rendu au format lettre

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('écran de connexion jaune, polices et ton de la charte', async ({ page }, info) => {
  await simulerSupabase(page)
  await page.goto('./')
  await expect(page.getByText('Content de te revoir. Ton réseau t’attend.')).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.body.firstElementChild!.firstElementChild!).backgroundColor)).toBe('rgb(248, 187, 9)')
  await page.screenshot({ path: `captures/${info.project.name}-look-connexion.png` })
  await seConnecter(page)
  const titre = page.getByRole('heading', { level: 1, name: 'Accueil' })
  expect(await titre.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/^"?Alegreya/)
  expect(await titre.evaluate((e) => getComputedStyle(e).textTransform)).toBe('uppercase')
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/^"?Lato/)
  // Les deux polices sont embarquées (aucune ressource externe)
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => document.fonts.check('800 20px Alegreya') && document.fonts.check('700 16px Lato'))).toBe(true)
  expect(await textesTropPetits(page)).toEqual([])
})

test('filet en aplats jaune-or et vert canard, intitulés en cartouche noir', async ({ page }, info) => {
  await seConnecter(page)
  const filet = await page.locator('header [aria-hidden]').last().evaluate((e) => getComputedStyle(e).backgroundImage)
  expect(filet).toContain('rgb(248, 187, 9)')
  expect(filet).toContain('rgb(58, 143, 141)')
  expect(filet).not.toContain('27, 111, 206')
  const actualites = page.getByRole('heading', { level: 2, name: /^Actualités$/i })
  await expect(actualites).toBeVisible()
  expect(await actualites.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(29, 29, 27)')
  expect(await actualites.evaluate((e) => getComputedStyle(e).color)).toBe('rgb(255, 255, 255)')
  await page.screenshot({ path: `captures/${info.project.name}-look-accueil.png` })
})

test('les magasins ont leur blason de ville, à la place et à la taille du rond à initiales', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  const ligne = (nom: string) => page.getByRole('link', { name: new RegExp(`^${nom}`) }).first()
  await expect(ligne('Nantes Test').locator('[data-blason="littoral"]')).toBeAttached()
  await expect(ligne('Annecy Test').locator('[data-blason="montagne"]')).toBeAttached()
  await expect(ligne('Lyon Test').locator('[data-blason="terres"]')).toBeAttached()
  const boite = (await ligne('Lyon Test').locator('[data-blason]').boundingBox())!
  expect(Math.round(boite.width)).toBe(44)
  expect(Math.round(boite.height)).toBe(44)
  await page.screenshot({ path: `captures/${info.project.name}-look-blasons.png` })
})

test('la forme du blason se choisit dans la fiche du magasin', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Lyon%20Test')
  await actionFiche(page, 'Modifier la fiche')
  const d = page.getByRole('dialog', { name: 'Modifier Lyon Test' })
  await expect(d.getByLabel('Forme du blason')).toContainText('Selon le département (terres)')
  await d.getByLabel('Forme du blason').click()
  await page.getByRole('option', { name: 'Montagne' }).click()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  expect(ecritures).toContainEqual(expect.objectContaining({ table: 'store_overrides', corps: expect.objectContaining({ topographie: 'montagne' }) }))
})

test('chaque blason porte une figure locale au centre, proposée selon le département', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  const blason = (nom: string) => page.getByRole('link', { name: new RegExp(`^${nom}`) }).first().locator('[data-blason]')
  await expect(blason('Nantes Test')).toHaveAttribute('data-figure', 'voile')
  await expect(blason('Annecy Test')).toHaveAttribute('data-figure', 'sommet')
  await expect(blason('Lyon Test')).toHaveAttribute('data-figure', 'clocher')
  // La figure reste dans le blason
  const b = (await blason('Lyon Test').boundingBox())!
  const f = (await blason('Lyon Test').locator('svg').boundingBox())!
  expect(f.x).toBeGreaterThanOrEqual(b.x)
  expect(f.x + f.width).toBeLessThanOrEqual(b.x + b.width)
  expect(f.y + f.height).toBeLessThanOrEqual(b.y + b.height)
  await page.screenshot({ path: `captures/${info.project.name}-look-figures.png` })
})

test('la figure du blason se choisit dans la fiche du magasin', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Lyon%20Test')
  await actionFiche(page, 'Modifier la fiche')
  const d = page.getByRole('dialog', { name: 'Modifier Lyon Test' })
  await expect(d.getByLabel('Figure du blason')).toContainText('Selon le département (clocher)')
  await d.getByLabel('Figure du blason').click()
  await expect(page.getByRole('option')).toHaveCount(21)
  await page.screenshot({ path: `captures/${info.project.name}-look-choix-figure.png` })
  await page.getByRole('option', { name: 'Pont' }).click()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  expect(ecritures).toContainEqual(expect.objectContaining({ table: 'store_overrides', corps: expect.objectContaining({ figure: 'pont' }) }))
})

test('état vide illustré par un pictogramme de la charte', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  await page.getByLabel('Rechercher dans les magasins').fill('zzzz')
  await expect(page.getByText('Personne à cette adresse')).toBeVisible()
  const image = page.locator('main img[src*="magasins"], main img[src^="data:image/png"]').first()
  await expect(image).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-look-vide.png` })
})

test('carte : un repère en bulle vide par magasin placé', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins?vue=carte')
  await expect(page.locator('.picto-magasin')).toHaveCount(30)
  await expect(page.locator('.picto-magasin').first()).not.toContainText(/\S/)
  await page.locator('.picto-magasin[title="Lyon Test"]').dispatchEvent('click')
  await expect(page.locator('.leaflet-popup')).toContainText('Lyon Test')
  await page.screenshot({ path: `captures/${info.project.name}-look-carte.png` })
})

test('le compte rendu suit la mise en page « lettre » de la charte', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/visites/compte-rendu/1')
  const feuille = page.locator('.feuille')
  await expect(feuille.getByText('Objet : compte rendu de visite contractuelle')).toBeVisible()
  await expect(feuille.getByRole('heading', { level: 1, name: 'Lyon Test' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-look-compte-rendu.png`, fullPage: true })
})
