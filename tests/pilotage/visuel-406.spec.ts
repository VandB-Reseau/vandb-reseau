import { expect, test, type Page } from '@playwright/test'
import { COMPTE, simulerSupabase, type OptionsSimulation } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { ongletParametres, simulerPilotage, type MagasinSimule, type OptionsSimulation as OptionsPilotage } from './supabase-simule'

// Choix 409 et 412 (Joseph, 24/11/2026) : compte des simulateurs en cascade, état des Paramètres par rubrique.
// Données fictives uniquement.
const NOM = 'Annecy Test'
const magasins: MagasinSimule[] = [{ magasin: NOM, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }]
const franchise: OptionsSimulation = { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: [NOM] } }

async function connecter(page: Page, reseau: OptionsSimulation, pilotage: OptionsPilotage) {
  await simulerSupabase(page, reseau)
  await simulerPilotage(page, { magasins, ...pilotage })
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

test('409 : le compte du simulateur se lit en cascade, zéro marqué', async ({ page }) => {
  await connecter(page, franchise, { role: 'franchise' })
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=chiffres&partie=simulateurs&sim=soiree`)
  await page.getByRole('group', { name: 'Formule' }).getByRole('button', { name: 'Soirée animée sans billet' }).click()
  await page.getByLabel('CA HT du bar un soir normal').fill('2000')
  await page.getByLabel('CA HT du bar attendu ce soir-là').fill('4200')
  await page.getByLabel('Taux de marge du bar').fill('72')
  const compte = page.getByRole('table', { name: 'Compte de la soirée' })
  // Une marche par ligne, gain compris ; les montants restent lus tels quels
  await expect(compte.getByRole('row')).toHaveCount(4)
  await expect(compte.locator('.cascade')).toHaveCount(4)
  await expect(compte.getByRole('row').last()).toHaveText(/Gain.*1\s168\s€/)
  await expect(compte).toContainText('Trait pointillé : 0 €, gain à droite, perte à gauche')
  // La soirée n'a pas de point mort en volume : rien n'est annoncé comme tel (Joseph, 24/11/2026)
  await expect(compte).not.toContainText('Point mort')
  const r = (await compte.boundingBox())!
  expect(r.width).toBeLessThanOrEqual(page.viewportSize()!.width)
})

test('412 : Paramètres, une carte par rubrique avec son état', async ({ page }) => {
  await connecter(page, {}, { parametres: null })
  await page.goto('./#/budgets/parametres')
  const etat = page.getByRole('region', { name: /^État des paramètres \d{4}$/ })
  await expect(etat).toBeVisible()
  // Valeurs par défaut : budget communication à 0 → à régler ; congés payés (10 % proposés) réglés ; un clic ouvre la rubrique
  await expect(etat.getByRole('button', { name: /^Paramètres \d{4} : Par défaut, 2 points à régler$/ })).toBeVisible()
  await expect(etat.getByRole('button', { name: /^Franchise et impôts : À régler, Budget communication$/ })).toBeVisible()
  const equipe = etat.getByRole('button', { name: /^Équipe : Réglé/ })
  await equipe.click()
  await expect(page.getByRole('tablist', { name: 'Rubriques des paramètres' }).getByRole('tab', { name: 'Équipe' })).toHaveAttribute('aria-selected', 'true')
  await expect(equipe).toHaveAttribute('aria-pressed', 'true')
  await ongletParametres(page, 'Trésorerie')
  await expect(etat.getByRole('button', { name: /^Trésorerie : / })).toHaveAttribute('aria-pressed', 'true')
})
