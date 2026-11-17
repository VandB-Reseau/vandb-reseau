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

test('bar : remise en euros par produit ou par panier, paliers sur les venues de la société', async ({ page, isMobile }) => {
  await connecter(page)
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=simulateurs&partie=simulateurs&sim=remises_b2b`)
  await expect(page.getByRole('heading', { name: 'Remises entreprise par paliers' })).toBeVisible()
  await page.getByRole('button', { name: 'Bar, des venues' }).click()
  const statut = page.locator('#carte-simulation').getByRole('status')
  // Panier d'une venue : 0,5 food à 12 € (10 %), 0,5 soft à 4 € (10 %), 1,5 alcool à 6,50 € (20 %) = 15,40 € HT, achats 3,63 €.
  // 30 venues par semaine, palier 1 : 0,50 € TTC par produit = 1,08 € HT par venue ; 30 × 14,32 = 430 € HT, marge 321 € (74,7 %)
  await expect(statut).toContainText(/30 venues par semaine, palier 1 à 0,50\s€ par produit, 430\s€ HT, marge 321\s€ soit 74,7\s?%/)
  // Reste par venue 11,31 € sans remise, 10,26 € avec : 31,41 € par semaine, 1 634 € par an, 4 venues de plus pour la payer
  await expect(statut).toContainText(/La remise coûte 1\s634\s€ par an ; 4 venues de plus par semaine la paient\./)
  await expect(statut).toContainText(/Encore 10 venues pour passer au palier 2 \(1,00\s€\)/)
  await expect(page.getByRole('table', { name: 'Remises par palier au bar' }).getByRole('row')).toHaveCount(4)
  await expect(page.getByRole('table', { name: 'Détail du panier' })).toContainText('Softs et boissons sans alcool')
  // Par panier : 0,50 € × 15,40 HT ÷ 17,75 TTC = 0,43 € HT par venue, 30 × 14,96 = 449 € HT
  await page.getByRole('button', { name: 'Par panier' }).click()
  await expect(statut).toContainText(/0,50\s€ par panier, 449\s€ HT/)
  // Plus de venues : palier 2
  await page.getByRole('textbox', { name: 'Venues par semaine' }).fill('45')
  await expect(statut).toContainText(/45 venues par semaine, palier 2 à 1,00\s€ par panier/)
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
