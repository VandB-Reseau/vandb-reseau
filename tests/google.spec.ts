import { expect, test } from '@playwright/test'
import { lieuGoogleFictif, seConnecter, textesTropPetits } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('la fiche magasin affiche la note et les horaires Google', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  const appels: string[] = []
  page.on('request', (r) => { if (r.url().startsWith('https://places.googleapis.com/')) appels.push(`${r.method()} ${new URL(r.url()).pathname}`) })
  await page.goto('./#/magasins/Lyon%20Test')
  const google = page.locator('.MuiCard-root', { has: page.getByRole('heading', { name: 'Google', exact: true }) })
  await expect(google.getByText('4,6')).toBeVisible()
  await expect(google.getByText('sur 5 · 213 avis')).toBeVisible()
  await expect(google.getByText('Ouvert en ce moment')).toBeVisible()
  const horaires = google.getByRole('list', { name: 'Horaires d’ouverture' })
  await expect(horaires.getByRole('listitem')).toHaveCount(7)
  await expect(horaires.getByRole('listitem').first()).toContainText('14:00 – 20:00')
  await expect(google.getByRole('link', { name: 'Google Maps' })).toHaveAttribute('href', lieuGoogleFictif.googleMapsUri)
  expect(await textesTropPetits(page)).toEqual([])
  const lien = await google.getByRole('link', { name: 'Google Maps' }).boundingBox()
  expect(lien!.height).toBeGreaterThanOrEqual(48)
  await google.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `captures/${info.project.name}-fiche-google.png`, fullPage: !isMobile })
  // Première fois : recherche ; ensuite l'identifiant Google retenu suffit
  expect(appels).toEqual(['POST /v1/places:searchText'])
  await page.reload()
  await expect(google.getByText('sur 5 · 213 avis')).toBeVisible()
  expect(appels).toEqual(['POST /v1/places:searchText', 'GET /v1/places/lieu-test'])
})

test('magasin absent de Google ou Google indisponible', async ({ page }) => {
  await seConnecter(page)
  await page.route('https://places.googleapis.com/**', (r) => r.fulfill({ json: { places: [{ id: 'x', displayName: { text: 'Cave voisine' } }] } }))
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByText('Aucune fiche Google trouvée pour ce magasin.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Chercher sur Google Maps' })).toBeVisible()
  await page.route('https://places.googleapis.com/**', (r) => r.fulfill({ status: 403, json: { error: { message: 'API key not valid' } } }))
  await page.goto('./#/magasins')
  await page.goto('./#/magasins/Lyon%20Test')
  await page.reload()
  await expect(page.getByText('Google ne répond pas pour le moment.', { exact: false })).toBeVisible()
  await expect(page.getByText('API key')).toHaveCount(0)
})
