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
  // Refonte vague 2 (14A, 15A) : plus d'onglets sous Budgets pour le Directeur ; le suivi est dans Performance, les
  // réglages dans Paramètres
  await expect(page.getByRole('navigation', { name: 'Pages des budgets' })).toHaveCount(0)
  await expect(page.getByText('Annecy Test').first()).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-budgets.png`, fullPage: true })

  await page.goto('./#/budgets/suivi')
  await expect(page).toHaveURL(/#\/performance\?vue=budget/)
  await expect(page.getByRole('heading', { level: 1, name: 'Performance' })).toBeVisible()
  await page.goto('./#/budgets/parametres')
  await expect(page).toHaveURL(/#\/parametres\/reglages\?rubrique=budget/)
})

// Refonte (Joseph, 09/11/2026, 3A) : le suivi et les saisies dans l'onglet Chiffres, les étapes du budget dans l'onglet Budget
test('la fiche du magasin a ses onglets Chiffres et Budget : suivi, saisies et budget, sans quitter la fiche', async ({ page, isMobile }, info) => {
  await connecter(page, {}, {})
  await page.getByRole('heading', { level: 1, name: /^Accueil$|Bonjour|Bonsoir/ }).waitFor()
  await page.goto(`./#/magasins/${encodeURIComponent('Annecy Test')}`)
  await ouvrirOnglet(page, 'Chiffres')
  const pagesMagasin = page.getByRole('navigation', { name: 'Pages du magasin' })
  await expect(pagesMagasin.getByRole('tab', { name: 'Vue d’ensemble' })).toBeVisible()
  await pagesMagasin.getByRole('tab', { name: /^Clôture du mois/ }).click()
  await expect(page).toHaveURL(/#\/magasins\/Annecy%20Test\?vue=chiffres&partie=/)
  await expect(page.getByRole('region', { name: 'Clôture du mois' }).getByRole('button', { name: 'Réel du mois' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-budget.png`, fullPage: true })
  await ouvrirOnglet(page, 'Budget')
  await expect(page).toHaveURL(/vue=budget/)
  await expect(pagesMagasin.getByRole('tablist', { name: /^Étapes du budget/ })).toBeVisible()
})

test('le franchisé d’un seul magasin arrive par « Mon budget » sur l’onglet Budget de sa fiche', async ({ page, isMobile }) => {
  await connecter(page, { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] } }, { role: 'franchise', magasins: [magasins[0]] })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Accueil')
  // Depuis son menu : « Mon budget » sur PC, « Budget » dans la barre du téléphone
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: isMobile ? 'Budget' : 'Mon budget', exact: true }).click()
  // Le suivi du budget face au réel, dans l'onglet Chiffres de sa fiche (refonte 09/11/2026)
  await expect(page).toHaveURL(/#\/magasins\/Annecy%20Test\?vue=chiffres/)
  await expect(page.getByRole('heading', { level: 1, name: 'Annecy Test' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Pages du magasin' }).getByRole('tab', { name: 'Vue d’ensemble' })).toBeVisible()
  // Rien du réseau : ni suivi, ni hypothèses, ni paramètres
  await expect(page.getByRole('navigation', { name: 'Pages des budgets' })).toHaveCount(0)
})

test('le franchisé de plusieurs magasins voit la liste de ses budgets, sans les pages du réseau', async ({ page }) => {
  await connecter(page, { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Lyon Test'] } }, { role: 'franchise', magasins })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Accueil')
  await page.goto('./#/budgets')
  await expect(page.getByRole('heading', { level: 1, name: /^Budgets \d{4}$/ })).toBeVisible()
  await expect(page.getByText('Lyon Test').first()).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Pages des budgets' })).toHaveCount(0)
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
