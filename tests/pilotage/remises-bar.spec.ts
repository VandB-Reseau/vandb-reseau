import { expect, test, type Page } from '@playwright/test'
import { COMPTE, simulerSupabase, textesTropPetits, type OptionsSimulation } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type SimulationSimulee } from './supabase-simule'

// Remises entreprise au bar (Joseph, 17/11/2026) : remise en euros par produit ou par panier, paliers sur les venues. Données fictives.
const NOM = 'Annecy Test'
const AUTRE = 'Toulouse Test' // autre magasin du Coach Hugo FICTIF
const magasins: MagasinSimule[] = [
  { magasin: NOM, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' },
  { magasin: AUTRE, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' },
]
const coach: OptionsSimulation = { appMetadata: { role: 'coach', coach: 'Hugo FICTIF' } }

async function connecter(page: Page, simulations: SimulationSimulee[] = []) {
  await simulerSupabase(page, coach)
  await simulerPilotage(page, { magasins, role: 'coach', simulations })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
}

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('bar : on part des venues habituelles, chaque remise dit combien de venues en plus la compensent', async ({ page, isMobile }) => {
  await connecter(page)
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=simulateurs&partie=simulateurs&sim=remises_b2b`)
  await expect(page.getByRole('heading', { name: 'Remises entreprise par paliers' })).toBeVisible()
  await page.getByRole('button', { name: 'Bar, des venues' }).click()
  const statut = page.locator('#carte-simulation').getByRole('status')
  // Panier d'une venue : 0,5 food à 12 € (10 %), 0,5 soft à 4 € (10 %), 1,5 alcool à 6,50 € (20 %) = 15,40 € HT, achats 3,63 €,
  // marge 11,77 € par venue. Aujourd'hui : 30 venues par semaine sans remise, 30 × 11,77 = 353 € de marge par semaine.
  await expect(statut).toContainText(/Comité d’entreprise vient 30 fois par semaine sans remise : marge 353\s€ par semaine\./)
  // 0,50 € par produit : marge 10,69 € par venue ; 353,18 ÷ 10,69 = 33,03 : 34 venues, 4 de plus
  await expect(statut).toContainText(/À 0,50\s€ par produit, il faut 4 venues de plus par semaine \(34 au lieu de 30\) pour garder la même marge\./)
  // 1 € par produit : marge 9,61 € ; 353,18 ÷ 9,61 = 36,7 : 37 venues, 7 de plus
  await expect(statut).toContainText(/À 1,00\s€ par produit, il faut 7 venues de plus par semaine \(37 au lieu de 30\)/)
  await expect(statut).toContainText('En théorie : on espère plus de venues, rien ne les garantit.')
  const paliers = page.getByRole('table', { name: 'Remises par palier au bar' })
  await expect(paliers.getByRole('row')).toHaveCount(4) // en-tête, aujourd'hui, 2 remises
  await expect(paliers.getByRole('row').nth(1)).toContainText('Aujourd’hui')
  await expect(paliers.getByRole('row').nth(2)).toContainText('+ 4 venues')
  await expect(page.getByRole('table', { name: 'Détail du panier' })).toContainText('Softs et boissons sans alcool')
  // Par panier : 0,50 € × 15,40 HT ÷ 17,75 TTC = 0,43 € HT, marge 11,34 € ; 32 venues, 2 de plus
  await page.getByRole('button', { name: 'Par panier' }).click()
  await expect(statut).toContainText(/À 0,50\s€ par panier, il faut 2 venues de plus par semaine \(32 au lieu de 30\)/)
  // 20 venues habituelles : 1 de plus à 0,50 € par panier ; une 3e remise à 1,50 €
  await page.getByRole('textbox', { name: 'Venues habituelles par semaine' }).fill('20')
  await expect(statut).toContainText(/vient 20 fois par semaine sans remise/)
  await expect(statut).toContainText(/À 0,50\s€ par panier, il faut 1 venue de plus par semaine \(21 au lieu de 20\)/)
  await page.getByRole('button', { name: 'Ajouter une remise' }).click()
  await expect(page.getByRole('textbox', { name: 'Remise TTC, palier 3' })).toHaveValue(/1,5/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  // Loi Évin : un panier sans food ni boisson sans alcool est signalé
  await page.getByRole('textbox', { name: 'Produits par venue, Food' }).fill('0')
  await page.getByRole('textbox', { name: 'Produits par venue, Softs et boissons sans alcool' }).fill('0')
  await expect(page.getByRole('alert').filter({ hasText: 'loi Évin' })).toBeVisible()
  // Retour en cave : la commande d'exemple est intacte (en haut de page, la carte du résultat reste collée au défilement)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.getByRole('button', { name: 'Cave, une commande' }).click()
  await expect(statut).toContainText(/100 unités, palier 2 à 8\s?%/)
})
