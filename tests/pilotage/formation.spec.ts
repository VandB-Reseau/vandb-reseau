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
  // Coût 1 609,64 €, OPCO 420 € (14 h × 30 €), reste 1 189,64 €, 594,82 € par jour, 2 832,48 € de CA HT
  await expect(phrase(page)).toContainText(/Formation de 2 jours : coût 1\s610\s€, pris en charge 420\s€, reste 1\s190\s€ au magasin \(595\s€ par jour\)\. Il faut 2\s832\s€ de CA HT pour le payer\./)
  await expect(page.getByRole('table', { name: 'Coût de la formation' })).toContainText(/Indemnités kilométriques/)
  // CPF : 600 € de droits ; il reste 100 € pour l'OPCO ; forfait de 150 € pour le collaborateur
  await page.getByLabel('Droits CPF mobilisés par le collaborateur').fill('600')
  await expect(phrase(page)).toContainText(/pris en charge 700\s€, reste 910\s€ au magasin/)
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
