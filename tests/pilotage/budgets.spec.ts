import { expect, test, type Page } from '@playwright/test'
import { COMPTE, ouvrirOnglet, simulerSupabase, textesTropPetits, type OptionsSimulation } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type OptionsSimulation as OptionsPilotage } from './supabase-simule'

// Fusion avec le pilotage (Joseph, 03/11/2026, option A) : une entrée « Budgets » dans le menu, un onglet « Budget »
// dans la fiche du magasin, l'espace du franchisé et celui du contrôle de gestion. Données fictives uniquement.

const N = new Date().getFullYear()
const magasins: MagasinSimule[] = [
  { magasin: 'Annecy Test', statut: 'valide', hypotheses: magasinFictif, maj_le: '2026-10-20T09:30:00Z' },
  { magasin: 'Lyon Test', statut: 'en_discussion', hypotheses: magasinFictif, maj_le: '2026-10-22T16:05:00Z' },
]

async function connecter(page: Page, reseau: OptionsSimulation, pilotage: OptionsPilotage) {
  await simulerSupabase(page, reseau)
  const ecritures = await simulerPilotage(page, { magasins, ...pilotage })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
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

test('le Directeur ouvre les budgets depuis le menu, passe au suivi et aux paramètres', async ({ page, isMobile }, info) => {
  await connecter(page, {}, {})
  await page.getByRole('heading', { level: 1, name: /^Accueil$|Bonjour|Bonsoir/ }).waitFor()
  if (!isMobile) {
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Budgets', exact: true }).click()
  } else {
    await page.goto('./#/budgets')
  }
  await expect(page.getByRole('heading', { level: 1, name: /^Budgets \d{4}$/ })).toBeVisible()
  const pages = page.getByRole('navigation', { name: 'Pages des budgets' })
  for (const nom of [/^Budgets \d{4}$/, /^Suivi \d{4}$/, 'Hypothèses du réseau', 'Imports de caisse', 'Paramètres réseau']) {
    await expect(pages.getByRole('tab', { name: nom })).toBeVisible()
  }
  await expect(page.getByText('Annecy Test').first()).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-budgets.png`, fullPage: true })

  await pages.getByRole('tab', { name: /^Suivi \d{4}$/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: /^Suivi \d{4}$/ })).toBeVisible()
  await pages.getByRole('tab', { name: 'Paramètres réseau' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Paramètres réseau' })).toBeVisible()
})

test('la fiche du magasin a un onglet Budget : suivi, budget et saisies, sans quitter la fiche', async ({ page, isMobile }, info) => {
  await connecter(page, {}, {})
  await page.getByRole('heading', { level: 1, name: /^Accueil$|Bonjour|Bonsoir/ }).waitFor()
  await page.goto(`./#/magasins/${encodeURIComponent('Annecy Test')}`)
  await ouvrirOnglet(page, 'Budget')
  const pagesMagasin = page.getByRole('navigation', { name: 'Pages du magasin' })
  await expect(pagesMagasin.getByRole('tab', { name: `Suivi ${N}` })).toBeVisible()
  await expect(pagesMagasin.getByRole('tab', { name: 'Saisies' })).toBeVisible()
  await pagesMagasin.getByRole('tab', { name: 'Saisies' }).click()
  await expect(page).toHaveURL(/#\/magasins\/Annecy%20Test\?vue=budget&partie=/)
  await expect(page.getByRole('tab', { name: 'Réel du mois' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-budget.png`, fullPage: true })
})

test('le franchisé retrouve son budget dans son espace et dans la fiche de son magasin', async ({ page }) => {
  await connecter(page, { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] } }, { role: 'franchise', magasins: [magasins[0]] })
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  await page.goto('./#/budgets')
  await expect(page.getByRole('heading', { level: 1, name: /^Budgets \d{4}$/ })).toBeVisible({ timeout: 15_000 })
  // Rien du réseau : ni suivi, ni hypothèses, ni paramètres
  await expect(page.getByRole('navigation', { name: 'Pages des budgets' })).toHaveCount(0)
  await expect(page.getByText('Lyon Test')).toHaveCount(0)
  await page.goto(`./#/magasins/${encodeURIComponent('Annecy Test')}?vue=budget`)
  await expect(page.getByRole('navigation', { name: 'Pages du magasin' }).getByRole('tab', { name: `Suivi ${N}` })).toBeVisible()
})

test('le contrôle de gestion, sans rôle dans le réseau, n’a que les budgets', async ({ page }) => {
  await connecter(page, { acces: { role: 'sans_acces' } }, { role: 'aucun', parametreur: true })
  await expect(page.getByText('Contrôle de gestion', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: /^Budgets \d{4}$/ })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Pages des budgets' }).getByRole('tab', { name: 'Paramètres réseau' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Visites' })).toHaveCount(0)
  // Le budget d'un magasin s'ouvre en lecture, sans la fiche de l'app réseau
  await page.goto(`./#/magasins/${encodeURIComponent('Annecy Test')}?vue=budget`)
  await expect(page.getByRole('heading', { level: 1, name: 'Annecy Test' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Pages du magasin' }).getByRole('tab', { name: `Suivi ${N}` })).toBeVisible()
})

test('un compte sans rôle ni contrôle de gestion garde l’accès fermé', async ({ page }) => {
  await connecter(page, { acces: { role: 'sans_acces' } }, { role: 'aucun' })
  await expect(page.getByText('Ton accès n’est pas encore ouvert')).toBeVisible()
})
