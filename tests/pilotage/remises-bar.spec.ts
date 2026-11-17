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

test('bar : on part des venues habituelles, les paliers se construisent au-dessus', async ({ page, isMobile }) => {
  await connecter(page)
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=simulateurs&partie=simulateurs&sim=remises_b2b`)
  await expect(page.getByRole('heading', { name: 'Remises entreprise par paliers' })).toBeVisible()
  await page.getByRole('button', { name: 'Bar, des venues' }).click()
  const statut = page.locator('#carte-simulation').getByRole('status')
  // Panier d'une venue : 0,5 food à 12 € (10 %), 0,5 soft à 4 € (10 %), 1,5 alcool à 6,50 € (20 %) = 15,40 € HT, achats 3,63 €.
  // Aujourd'hui : 30 venues par semaine sans remise, 11,31 € de reste par venue, 30 × 11,31 × 52 = 17 645 € par an
  await expect(statut).toContainText(/Comité d’entreprise vient 30 fois par semaine sans remise : il reste 17\s645\s€ par an au magasin\./)
  // Palier 1, + 10 venues à 0,50 € par produit : 40 × 10,26 − 30 × 11,31 = 71,22 € par semaine, 3 704 € par an ; payée dès 4 venues
  await expect(statut).toContainText(/Au palier 1 \(0,50\s€ par produit\), si elle vient 40 fois, le magasin gagne 3\s704\s€ par an ; la remise est payée dès 4 venues de plus\./)
  // Palier 2, + 25 venues à 1 € : 55 × 9,22 − 339,32 = 167,58 € par semaine, 8 714 € par an ; payée dès 7 venues
  await expect(statut).toContainText(/Au palier 2 \(1,00\s€ par produit\), si elle vient 55 fois, le magasin gagne 8\s714\s€ par an ; la remise est payée dès 7 venues de plus\./)
  await expect(statut).toContainText('En théorie : on espère plus de venues, rien ne les garantit.')
  const paliers = page.getByRole('table', { name: 'Remises par palier au bar' })
  await expect(paliers.getByRole('row')).toHaveCount(4) // en-tête, aujourd'hui, 2 paliers
  await expect(paliers.getByRole('row').nth(1)).toContainText('Aujourd’hui')
  await expect(page.getByRole('table', { name: 'Détail du panier' })).toContainText('Softs et boissons sans alcool')
  // Par panier : 0,50 € × 15,40 HT ÷ 17,75 TTC = 0,43 € HT par venue ; payée dès 2 venues
  await page.getByRole('button', { name: 'Par panier' }).click()
  await expect(statut).toContainText(/Au palier 1 \(0,50\s€ par panier\), si elle vient 40 fois, le magasin gagne 5\s007\s€ par an ; la remise est payée dès 2 venues de plus\./)
  // Habitudes et paliers modifiables : 20 venues habituelles, palier 1 à + 5
  await page.getByRole('textbox', { name: 'Venues habituelles par semaine' }).fill('20')
  await page.getByRole('textbox', { name: 'Venues en plus, palier 1' }).fill('5')
  await expect(statut).toContainText(/vient 20 fois par semaine sans remise/)
  await expect(statut).toContainText(/Au palier 1 \(0,50\s€ par panier\), si elle vient 25 fois/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  // Loi Évin : un panier sans food ni boisson sans alcool est signalé
  await page.getByRole('textbox', { name: 'Produits par venue, Food' }).fill('0')
  await page.getByRole('textbox', { name: 'Produits par venue, Softs et boissons sans alcool' }).fill('0')
  await expect(page.getByRole('alert').filter({ hasText: 'loi Évin' })).toBeVisible()
  // Retour en cave : la commande d'exemple est intacte
  await page.getByRole('button', { name: 'Cave, une commande' }).click()
  await expect(statut).toContainText(/100 unités, palier 2 à 8\s?%/)
})
