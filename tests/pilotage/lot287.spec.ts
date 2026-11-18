import { expect, test, type Page } from '@playwright/test'
import { COMPTE, simulerSupabase, textesTropPetits, type OptionsSimulation } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type OptionsSimulation as OptionsPilotage } from './supabase-simule'

// Simulateurs Me rémunérer, Mon loyer, Mix Cave et Bar (choix 287, 291, 292, Joseph 18/11/2026). Données fictives,
// résultats vérifiés à la main (tests/pilotage/moteur/lot287.spec.ts).
const NOM = 'Annecy Test'
const magasins: MagasinSimule[] = [{ magasin: NOM, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }]
const franchise: OptionsSimulation = { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: [NOM] } }
const reperes = {
  tauxRedevance: 0.02, tauxPublicite: 0.01,
  simulateurs: { coutHoraire: 20, productivite: [{ partBar: 0.53, cible: 95 }, { partBar: 0.46, cible: 102 }, { partBar: 0, cible: 117 }] },
}

async function connecter(page: Page, reseau: OptionsSimulation, pilotage: OptionsPilotage) {
  await simulerSupabase(page, reseau)
  const ecritures = await simulerPilotage(page, { magasins, parametres: reperes, ...pilotage })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  return ecritures
}
const simulateur = (page: Page, sim: string) => page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=chiffres&partie=simulateurs&sim=${sim}`)
const phrase = (page: Page) => page.getByRole('status').first()

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('287 : salaire ou dividendes, ce que je garde par mois et ce qui part en impôts', async ({ page, isMobile }) => {
  const ecritures = await connecter(page, franchise, { role: 'franchise' })
  await simulateur(page, 'remuneration')
  await expect(page.getByRole('heading', { name: 'Me rémunérer' }).first()).toBeVisible()
  await page.getByLabel('Bénéfice avant ma rémunération et l’impôt').fill('60000')
  await page.getByLabel('Capital, primes et comptes courants').fill('10000')
  await page.getByLabel('Rémunération nette par mois').fill('2000')
  await page.getByLabel('Part du résultat versée en dividendes').fill('50')
  await page.getByLabel('Taux de prélèvement à la source du foyer').fill('10')
  // Je garde 26 383,62 ÷ 12 = 2 199 € ; impôts et cotisations 22 906,38 ÷ 12 = 1 909 € ; 10 710 € dans la société ;
  // tout en rémunération 37 241,38 ÷ 12 = 3 103 € ; tout en dividendes 20 650,29 ÷ 12 = 1 721 €
  await expect(phrase(page)).toContainText(/je garde 2\s199\s€ par mois après impôts, 1\s909\s€ par mois partent en impôts et cotisations, 10\s710\s€ restent dans la société\. Tout en rémunération : 3\s103\s€ par mois ; tout en dividendes : 1\s721\s€/)
  const tableau = page.getByRole('table', { name: 'Salaire ou dividendes' })
  await expect(tableau.getByRole('row', { name: /Sort de la trésorerie de la société/ })).toContainText(/49\s290\s€/)
  // Président de SAS : plus de capital à saisir, dividendes sans cotisations
  await page.getByRole('group', { name: 'Je suis' }).getByRole('button', { name: 'Président de SAS' }).click()
  await expect(page.getByLabel('Capital, primes et comptes courants')).toHaveCount(0)
  await expect(tableau.getByRole('row', { name: /^Je garde après impôts, par an/ })).toContainText(/33\s786\s€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  // Le franchisé garde sa simulation (type remuneration, migration 0034)
  await page.getByRole('button', { name: 'Garder', exact: true }).click()
  await expect(page.getByText('Simulation gardée.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'simulations' && e.methode === 'POST')?.corps).toMatchObject({ type: 'remuneration' })
})

test('291 et 292 : hausse du loyer, déplacement de CA vers le bar', async ({ page, isMobile }) => {
  await connecter(page, { appMetadata: { role: 'coach', coach: 'Hugo FICTIF' } }, { role: 'coach' })
  await simulateur(page, 'loyer')
  await page.getByLabel('CA HT de l’année').fill('400000')
  await page.getByLabel('Taux de marge').fill('45')
  await page.getByLabel('EBE de l’année').fill('40000')
  await page.getByLabel('Loyer HT par an').fill('30000')
  await page.getByLabel('Charges locatives HT par an').fill('3000')
  await page.getByLabel('Hausse du loyer').fill('10')
  await page.getByLabel('Années restantes au bail').fill('3')
  // 33 000 € de loyer : + 250 € par mois, EBE − 3 000 € par an, − 9 000 € sur le bail, 3 000 ÷ 42 % = 7 143 € de CA
  await expect(phrase(page)).toContainText(/Loyer à 2\s750\s€ par mois/)
  await expect(phrase(page)).toContainText(/[−-]\s?3\s000\s€ par an, [−-]\s?9\s000\s€ sur le reste du bail\. Il faut 7\s143\s€ de CA HT en plus par an pour l’absorber/)
  await page.getByRole('group', { name: 'Je simule' }).getByRole('button', { name: 'Un nouveau loyer' }).click()
  await expect(page.getByLabel('Nouveau loyer HT par mois')).toHaveValue(/2\s?750/)

  await page.getByRole('navigation', { name: 'Choisir un simulateur' }).getByRole('button', { name: /Mix Cave et Bar/ }).click()
  await page.getByLabel('CA HT de la cave').fill('200000')
  await page.getByLabel('Marge de la cave').fill('35')
  await page.getByLabel('CA HT du bar').fill('200000')
  await page.getByLabel('Marge du bar').fill('70')
  await page.getByLabel('Part du CA déplacée').fill('5')
  // Grille du siège : 102 puis 95 € par heure, 5,6 h par semaine à 20 € ; marge + 7 000 €, EBE + 1 221 €
  await expect(phrase(page)).toContainText(/5\s%\sdu CA de la cave vers le bar \(20\s000\s€ HT\) : marge \+\s?7\s000\s€, 5,6 heures de plus par semaine, EBE \+\s?1\s221\s€ par an/)
  await page.getByRole('group', { name: 'Heures en plus' }).getByRole('button', { name: 'Je les saisis' }).click()
  await page.getByLabel('Heures en plus par semaine').fill('2')
  // 2 h × 52 × 20 € = 2 080 € ; EBE + 4 920 €
  await expect(phrase(page)).toContainText(/EBE \+\s?4\s920\s€ par an/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('Directeur : règles de « Me rémunérer » et repère du loyer dans Paramètres', async ({ page }) => {
  const ecritures = await connecter(page, {}, { parametres: { tauxRedevance: 0.02, tauxPublicite: 0.01 } })
  await page.goto('./#/parametres/reglages?rubrique=budget')
  await page.getByRole('tab', { name: 'Simulateurs' }).click()
  // Règles 2026 proposées d'office : prélèvements sociaux 18,6 %, impôt forfaitaire 12,8 %
  await expect(page.getByLabel('Prélèvements sociaux des dividendes')).toHaveValue('18,6')
  await expect(page.getByLabel('Impôt forfaitaire des dividendes')).toHaveValue('12,8')
  await page.getByLabel('Repère du loyer').fill('8')
  await page.getByRole('region', { name: 'Simulateurs' }).getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Repères des simulateurs \d{4} enregistrés\./)).toBeVisible()
  const p = ecritures.filter((e) => e.table === 'parametres_reseau').at(-1)?.corps as { valeur: { simulateurs: Record<string, unknown> } }
  expect(p.valeur.simulateurs).toMatchObject({ loyerRepere: 0.08, remuneration: { prelevementsSociaux: 0.186, cotisationsTNS: 0.45 } })
})
