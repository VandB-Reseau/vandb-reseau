import { expect, test, type Page } from '@playwright/test'
import { COMPTE, simulerSupabase, textesTropPetits, type OptionsSimulation } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type OptionsSimulation as OptionsPilotage } from './supabase-simule'

// Lot 241, 242 et grille de productivité (Joseph, 16/11/2026), d'après ses fiches Excel. Données fictives uniquement.
const NOM = 'Annecy Test'
const magasins: MagasinSimule[] = [{ magasin: NOM, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }]
const franchise: OptionsSimulation = { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: [NOM] } }

async function connecter(page: Page, reseau: OptionsSimulation, pilotage: OptionsPilotage) {
  await simulerSupabase(page, reseau)
  const ecritures = await simulerPilotage(page, { magasins, ...pilotage })
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

test('241 : soirée animée sans billet, CA du bar à viser, mise au budget', async ({ page, isMobile }) => {
  const ecritures = await connecter(page, franchise, { role: 'franchise' })
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=chiffres&partie=simulateurs&sim=soiree`)
  await page.getByRole('group', { name: 'Formule' }).getByRole('button', { name: 'Soirée animée sans billet' }).click()
  await expect(page.getByLabel('Prix par participant TTC')).toHaveCount(0)
  await page.getByLabel('Nom de l’événement').fill('Soirée DJ')
  await page.getByLabel('CA HT du bar un soir normal').fill('2000')
  await page.getByLabel('CA HT du bar attendu ce soir-là').fill('4200')
  await page.getByLabel('Taux de marge du bar').fill('72')
  // Coûts d'office : 50 € de décoration, 150 € d'animation et 150 € d'extras = 350 €
  // 2 200 € en plus × (72 % − 3 %) − 350 = 1 168 € ; à viser : 2 000 + 350 ÷ 0,69 = 2 507 €
  await expect(page.getByRole('status')).toContainText(/2\s200\s€ de CA HT en plus d’un soir normal : gain de 1\s168\s€\. Pour ne rien perdre, viser 2\s507\s€ de CA HT au bar\./)
  await expect(page.getByRole('table', { name: 'Compte de la soirée' }).getByRole('row')).toHaveText([/Marge sur le CA en plus.*\+ 1\s584\s€/, /Redevance et publicité.*− 66\s€/, /Coûts de l’événement.*− 350\s€/, /Gain.*1\s168\s€/])
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.getByRole('button', { name: 'Mettre dans mon budget 2027' }).click()
  await expect(page.getByText(/Ajouté au budget 2027\./)).toBeVisible()
  const budget = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { ajustements: { tempsForts: unknown[] } }
  expect(budget.ajustements.tempsForts).toEqual([{ nom: 'Soirée DJ', type: 'soiree', mois: 12, univers: 'bar', caAnPasse: 0, ca: 2_200, autresCharges: 200, moisAchats: 11 }])
})

test('242 : heures sup dans Embaucher', async ({ page, isMobile }) => {
  await connecter(page, franchise, { role: 'franchise' })
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=chiffres&partie=simulateurs&sim=embauche`)
  await page.getByRole('group', { name: 'Mouvement' }).getByRole('button', { name: 'Heures sup', exact: true }).click()
  await page.getByRole('group', { name: 'Coût horaire' }).getByRole('button', { name: 'Montant libre' }).click()
  await page.getByLabel('Coût d’une heure chargée').fill('20')
  await page.getByLabel('Heures payées du mois').fill('600')
  await page.getByLabel('Dont heures sup').fill('30')
  // 30 h × 20 € × 1,25 = 750 € par mois, dont 150 € de majoration
  await expect(page.getByRole('status')).toContainText(/30 heures sup sur 600 heures payées \(5\s%\) : 750\s€ par mois chargés, dont 150\s€ de majoration/)
  await expect(page.getByText('Part des heures sup')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('Directeur : grille de productivité préparée en 3 paliers', async ({ page }) => {
  const ecritures = await connecter(page, {}, {})
  await page.goto('./#/parametres/reglages?rubrique=budget')
  await page.getByRole('tab', { name: 'Simulateurs' }).click()
  await page.getByRole('button', { name: 'Préparer 3 paliers (46 % et 53 % de bar)' }).click()
  await page.getByLabel('CA par heure visé, palier 1').fill('95')
  await page.getByLabel('CA par heure visé, palier 2').fill('102')
  await page.getByLabel('CA par heure visé, palier 3').fill('117')
  await page.getByRole('region', { name: 'Simulateurs' }).getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Repères des simulateurs \d{4} enregistrés\./)).toBeVisible()
  const p = ecritures.filter((e) => e.table === 'parametres_reseau').at(-1)?.corps as { valeur: { simulateurs: { productivite: unknown } } }
  expect(p.valeur.simulateurs.productivite).toEqual([{ partBar: 0.53, cible: 95 }, { partBar: 0.46, cible: 102 }, { partBar: 0, cible: 117 }])
})
