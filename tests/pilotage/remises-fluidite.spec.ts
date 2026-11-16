import { expect, test, type Page } from '@playwright/test'
import { COMPTE, simulerSupabase, textesTropPetits, type OptionsSimulation } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type SimulationSimulee } from './supabase-simule'

// Lot du 16/11/2026 (Joseph) : 228 remises entreprise par paliers, 232 recherche rapide des pages et simulateurs,
// 234 l'app rouvre là où on s'est arrêté, 235 copier une simulation gardée vers un autre magasin. Données fictives.
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

test('228 : remises entreprise par paliers, par famille puis produit par produit', async ({ page, isMobile }) => {
  await connecter(page)
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=simulateurs&partie=simulateurs&sim=remises_b2b`)
  await expect(page.getByRole('heading', { name: 'Remises entreprise par paliers' })).toBeVisible()
  const statut = page.locator('#carte-simulation').getByRole('status')
  // Exemple du fichier : 100 unités, palier 2 à 8 % ; CA HT 1 838,33 € − 8 % = 1 691 € ; achats 1 223,60 € ; marge 468 € (27,7 %)
  await expect(statut).toContainText(/100 unités, palier 2 à 8\s?%/)
  await expect(statut).toContainText(/1\s691\s€ HT/)
  await expect(statut).toContainText(/marge 468\s€/)
  await expect(statut).toContainText(/Encore 100 unités pour passer au palier 3 \(10\s?%\)/)
  await expect(page.getByRole('table', { name: 'Remises par palier' }).getByRole('row')).toHaveCount(7)
  await expect(page.getByRole('table', { name: 'Détail par famille' })).toContainText('Spiritueux')
  await expect(page.getByRole('table', { name: 'Compte de la commande' })).toContainText('Redevance et publicité')
  // Le plancher se règle dans la simulation : à 30 %, la commande passe dessous
  await page.getByRole('textbox', { name: 'Marge plancher' }).fill('30')
  await expect(statut).toContainText('Sous le plancher de 30')
  // Produit par produit : 80 unités, palier 1 à 5 %
  await page.getByRole('button', { name: 'Produit par produit' }).click()
  await expect(statut).toContainText(/80 unités, palier 1 à 5\s?%/)
  await expect(page.getByRole('table', { name: 'Détail par produit' })).toContainText('Champagne brut 75 cl')
  // Plus de 100 unités : on passe au palier 2
  await page.getByRole('textbox', { name: 'Unités, Côtes du Rhône rouge 75 cl' }).fill('60')
  await expect(statut).toContainText(/110 unités, palier 2 à 8\s?%/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  // Effacer : les paliers et le plancher restent, les quantités partent
  await page.getByRole('button', { name: 'Effacer' }).click()
  await expect(page.getByRole('textbox', { name: 'Remise, palier 2' })).toHaveValue('8')
  await expect(page.getByRole('textbox', { name: 'Marge plancher' })).toHaveValue('30')
})

test('235 : copier une simulation gardée vers un autre magasin', async ({ page }) => {
  const gardee: SimulationSimulee = {
    id: 1, store_name: NOM, type: 'remises_b2b', nom: 'Comité d’entreprise, 100 unités', resume: 'Palier 2 à 8 %', auteur: 'autre', auteur_role: 'coach', auteur_nom: 'Hugo FICTIF', cree_le: '2026-10-21T08:00:00Z',
    donnees: { client: 'Comité d’entreprise', mode: 'famille', plancher: 0.25 },
  }
  await connecter(page, [gardee])
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=simulateurs&partie=simulateurs`)
  const gardees = page.getByRole('region', { name: 'Simulations gardées' })
  await gardees.getByRole('button', { name: `Copier ${gardee.nom} vers un autre magasin` }).click()
  const fenetre = page.getByRole('dialog', { name: 'Copier vers un autre magasin' })
  await expect(fenetre.getByRole('button', { name: 'Copier', exact: true })).toBeDisabled()
  await fenetre.getByRole('combobox', { name: 'Magasin de destination' }).fill('Toul')
  await page.getByRole('option', { name: AUTRE }).click()
  await fenetre.getByRole('button', { name: 'Copier', exact: true }).click()
  await expect(fenetre).toHaveCount(0)
  await expect(gardees.getByRole('status')).toContainText(`dans les simulations gardées de ${AUTRE}`)
  // La copie est dans les simulations gardées de l'autre magasin
  await page.goto(`./#/magasins/${encodeURIComponent(AUTRE)}?vue=simulateurs&partie=simulateurs`)
  await expect(page.getByRole('region', { name: 'Simulations gardées' })).toContainText(gardee.nom)
})

test('232 et 234 : recherche des pages et des simulateurs, réouverture là où on s’est arrêté', async ({ page, isMobile }) => {
  await connecter(page)
  // 232 : un simulateur en deux touches (Ctrl K sur PC, la loupe du haut sur téléphone)
  const recherche = page.getByRole('combobox', { name: 'Recherche globale' })
  await expect(recherche).toBeVisible()
  if (!isMobile) await page.keyboard.press('Control+k')
  else await recherche.click()
  await expect(recherche).toBeFocused()
  await recherche.fill('remises entre')
  await page.getByRole('option', { name: /Remises entreprise par paliers/ }).click()
  await expect(page.getByRole('heading', { name: 'Remises entreprise par paliers' })).toBeVisible()
  // Une page du menu
  if (!isMobile) await page.keyboard.press('Control+k')
  else await recherche.click()
  await recherche.fill('budget prév')
  await page.getByRole('option', { name: /Budget prévisionnel/ }).click()
  await expect(page).toHaveURL(/#\/budgets/)
  // Un magasin trouvé : « Simuler pour… »
  if (!isMobile) await page.keyboard.press('Control+k')
  else await recherche.click()
  await recherche.fill('Annecy')
  await page.getByRole('option', { name: `Simuler pour ${NOM}` }).click()
  await expect(page).toHaveURL(/vue=simulateurs/)
  await expect(page.getByRole('navigation', { name: 'Choisir un simulateur' })).toBeVisible()

  // 234 : l'app rouverte (nouvel onglet) revient sur la dernière page
  await page.evaluate(() => sessionStorage.clear())
  await page.goto('./')
  await expect(page).toHaveURL(/#\/magasins\/Annecy%20Test\?vue=simulateurs/)
  // Dans le même onglet, l'Accueil reste l'Accueil
  await page.goto('./')
  await page.waitForTimeout(300)
  await expect(page).not.toHaveURL(/magasins/)
})
