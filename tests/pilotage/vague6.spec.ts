import { expect, test, type Page } from '@playwright/test'
import { COMPTE, ouvrirOnglet, simulerSupabase, textesTropPetits } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type TicketsSimules, type VenteSimulee } from './supabase-simule'

// Refonte façon SaaS, vague 6, côté budgets (Joseph, 10/11/2026) : chiffres en cinq puces et « Clôturer » (76A), causes
// des écarts du mois (77A). Données fictives uniquement.

const M = 'Annecy Test'
const magasins: MagasinSimule[] = [{ magasin: M, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }]
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const reel: VenteSimulee[] = []
const tickets: TicketsSimules[] = []
// Septembre 2026 : 39 000 € de CA, 12 000 € de marge (30,8 %) contre 13 700 € l'an dernier (35,1 %) : −4,4 points
for (const a of [2025, 2026]) for (let m = 1; m <= (a === 2026 ? 9 : 12); m++) {
  reel.push({ store_name: M, mois: mois(a, m), univers: 'cave', famille: 'Vin', ca_ht: 30_000 + m * 1_000, ca_ttc: 36_000 + m * 1_200, marge_ht: a === 2026 && m === 9 ? 12_000 : 11_000 + m * 300 })
  tickets.push({ store_name: M, mois: mois(a, m), univers: 'cave', tickets: 1_500 + m * 10 })
}

async function connecter(page: Page, role?: string) {
  await simulerSupabase(page, {})
  const ecritures = await simulerPilotage(page, { magasins, reel, tickets, messages: [], ...(role ? { role } : {}) })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  return ecritures
}

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('chiffres en cinq puces ; « Clôturer septembre » demande la cause de l’écart de marge', async ({ page, isMobile }, info) => {
  const ecritures = await connecter(page)
  await page.goto(`./#/magasins/${encodeURIComponent(M)}`)
  await ouvrirOnglet(page, 'Chiffres')
  const pages = page.getByRole('navigation', { name: 'Pages du magasin' })
  await expect(pages.getByRole('tablist', { name: 'Parties des chiffres' }).getByRole('tab')).toHaveText(['Vue d’ensemble', 'Mois par mois', 'Comptes et trésorerie', /^Atterrissage/, 'Analyse'])
  // Le stock est dans les comptes
  await pages.getByRole('tab', { name: 'Comptes et trésorerie' }).click()
  await expect(page.getByRole('heading', { name: 'Stock', level: 2 }).first()).toBeVisible()
  // La clôture est une action
  await pages.getByRole('button', { name: /^Clôturer septembre/ }).click()
  await expect(page.getByRole('region', { name: 'Clôture du mois' })).toBeVisible()
  const ecarts = page.getByRole('region', { name: 'Écarts du mois à expliquer' })
  await expect(ecarts).toContainText('Taux de marge sous l’an dernier')
  const ligne = ecarts.getByRole('listitem', { name: 'Taux de marge sous l’an dernier' })
  await ligne.getByRole('radio', { name: 'Rupture' }).click()
  await ligne.getByLabel('En une phrase (facultatif)').fill('Rouges du Rhône manquants trois semaines.')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-vague6-ecarts.png`, fullPage: true })
  await ligne.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(ecarts).toContainText('Rupture : Rouges du Rhône manquants trois semaines.')
  const ecrit = ecritures.filter((e) => e.table === 'echanges_budget' && e.methode === 'POST').map((e) => e.corps as { ancre: string }).find((c) => c.ancre === 'ecart/2026-09/marge') as { ancre: string; texte: string; annee: number }
  expect(ecrit).toMatchObject({ ancre: 'ecart/2026-09/marge', texte: 'Rupture : Rouges du Rhône manquants trois semaines.', annee: 2026 })
  // La vue d'ensemble reprend la cause
  await pages.getByRole('tab', { name: 'Vue d’ensemble' }).click()
  await expect(page.getByRole('region', { name: 'Écarts expliqués' })).toContainText('septembre · Marge · Rupture')
})
