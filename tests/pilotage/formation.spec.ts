import { expect, test, type Page } from '@playwright/test'
import { COMPTE, simulerSupabase, textesTropPetits, type OptionsSimulation } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Former un collaborateur (Joseph, 18/11/2026). Données fictives, résultats vérifiés à la main (tests/pilotage/moteur/formation.spec.ts).
const NOM = 'Annecy Test'
const magasins: MagasinSimule[] = [{ magasin: NOM, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }]
const franchise: OptionsSimulation = { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: [NOM] } }

async function connecter(page: Page) {
  await simulerSupabase(page, franchise)
  const ecritures = await simulerPilotage(page, { magasins, role: 'franchise', parametres: { tauxRedevance: 0.02, tauxPublicite: 0.01 } })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  return ecritures
}
const phrase = (page: Page) => page.getByRole('status').first()

test('Former un collaborateur : coût, OPCO, CPF, apprenti', async ({ page, isMobile }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  const ecritures = await connecter(page)
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=chiffres&partie=simulateurs&sim=formation`)
  await expect(page.getByRole('heading', { name: 'Former un collaborateur' }).first()).toBeVisible()
  // L'exemple : 2 jours à 350 € HT, 240 km en 5 CV, 1 nuit, 4 repas, 14 h remplacées ; heure chargée saisie à 20 €
  await page.getByRole('group', { name: 'Coût horaire' }).getByRole('button', { name: 'Montant libre' }).click()
  await page.getByLabel('Coût d’une heure chargée').fill('20')
  await page.getByLabel('Taux de marge du magasin').fill('45')
  // Coût 1 609,64 €, OPCO 700 € de prix + 182 € de salaire (14 h × 13 €), reste 727,64 €, 363,82 € par jour,
  // 1 732,48 € de CA HT ; budget OPCO de 2 000 € (moins de 11 salariés), il en restera 1 118 €
  await expect(page.getByTestId('budget-opco')).toContainText(/Budget OPCO 2\s000\s€ par an : reste 2\s000\s€, puis 1\s118\s€ après cette formation/)
  await expect(phrase(page)).toContainText(/Formation de 2 jours : coût 1\s610\s€, pris en charge 882\s€, reste 728\s€ au magasin \(364\s€ par jour\)\. Il faut 1\s732\s€ de CA HT pour le payer\. Budget OPCO de l’année : il restera 1\s118\s€\./)
  await expect(page.getByRole('table', { name: 'Coût de la formation' })).toContainText(/Indemnités kilométriques/)
  // Frais en négatif, signe − et rouge (Joseph, 18/11/2026) : 240 km × 0,636 + 30 + 95 + 4 × 18 = 349,64 €
  const frais = page.getByRole('region', { name: '2. Trajet, hôtel et repas' }).locator('.sous-total')
  await expect(frais).toHaveText(/Frais\s*− 350\s€/)
  await expect(frais.locator('span').last()).toHaveCSS('color', /rgb\((1[5-9]\d|2\d\d), \d{1,2}, \d{1,2}\)/)
  // CPF : 600 € de droits ; il reste 100 € de prix pour l'OPCO, plus 182 € de salaire ; forfait de 150 € pour le collaborateur
  await page.getByLabel('Droits CPF mobilisés par le collaborateur').fill('600')
  await expect(phrase(page)).toContainText(/pris en charge 882\s€, reste 728\s€ au magasin/)
  // Apprenti en BTS : CFA par l'OPCO, aide de 4 500 € la 1re année, qui dépasse le coût
  await page.getByRole('group', { name: 'Le collaborateur est' }).getByRole('button', { name: /Apprenti/ }).click()
  await page.getByRole('group', { name: 'Diplôme préparé' }).getByRole('button', { name: 'BTS' }).click()
  await expect(phrase(page)).toContainText(/Formation de 2 jours, apprenti : coût 1\s610\s€, pris en charge 5\s200\s€, les aides dépassent le coût de 3\s590\s€\./)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.getByRole('button', { name: 'Garder', exact: true }).click()
  await expect(page.getByText('Simulation gardée.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'simulations' && e.methode === 'POST')?.corps).toMatchObject({ type: 'formation' })
  expect(erreurs).toEqual([])
})
