import { expect, test, type Page } from '@playwright/test'
import { COMPTE, simulerSupabase, textesTropPetits, type OptionsSimulation } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Prix du fût d’un gros marché extérieur (Joseph, 20/11/2026). Données fictives, vérifiées à la main (tests/pilotage/moteur/prixFutMarche.spec.ts).
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

test('Prix du fût d’un gros marché : coûts annexes, billet d’entrée, marge souhaitée', async ({ page, isMobile }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  const ecritures = await connecter(page)
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=chiffres&partie=simulateurs&sim=prix_fut`)
  await expect(page.getByRole('heading', { name: 'Prix du fût d’un gros marché' }).first()).toBeVisible()
  // L'exemple : 60 fûts à 42 €, 2 450 € de coûts annexes, don de 1 000 € avec reçu Cerfa (400 €), 15 % du CA visés
  await expect(phrase(page)).toContainText(/Festival d’été, 60 fûts : fût à 109,15\s€ HT \(130,98\s€ TTC\) pour couvrir 2\s850\s€ de coûts annexes et billet d’entrée et dégager 982\s€ de masse de marge \(15\s%.*du CA HT\) ; prix plancher 92,27\s€, perte sous 45 fûts vendus\./)
  await expect(page.getByRole('region', { name: '2. Coûts annexes du marché' }).locator('.sous-total')).toHaveText(/Total HT\s*− 2\s450\s€/)
  await expect(page.getByRole('table', { name: 'Compte du marché' }).getByRole('row')).toHaveText([/Recettes.*\+ 6\s549\s€/, /Fûts.*− 2\s520\s€/, /Coûts annexes.*− 2\s450\s€/, /Don.*− 400\s€/, /Redevance et publicité.*− 196\s€/, /Masse de marge.*982\s€/])
  await expect(page.getByRole('table', { name: 'Masse de marge selon les fûts vendus' })).toContainText(/30.*− 934\s€/)
  // Un coût de plus (sécurité 150 €), marge de 20 € par fût : (42 + (3 000 + 1 200) ÷ 60) ÷ 0,97 = 115,46 €
  await page.getByRole('button', { name: 'Ajouter un coût' }).click()
  await page.getByLabel('Coût 7', { exact: true }).fill('Sécurité')
  await page.getByLabel('Montant HT du coût 7').fill('150')
  await page.getByRole('group', { name: 'Marge souhaitée' }).getByRole('button', { name: 'En € par fût' }).click()
  await page.getByLabel('Marge par fût HT').fill('20')
  await expect(phrase(page)).toContainText(/fût à 115,46\s€ HT .* dégager 1\s200\s€ de masse de marge/)
  // Sponsoring : charge pleine, sans reçu Cerfa
  await page.getByRole('group', { name: 'Billet d’entrée' }).getByRole('button', { name: 'Sponsoring' }).click()
  await expect(page.getByLabel('Reçu Cerfa demandé')).toHaveCount(0)
  await expect(page.getByRole('region', { name: '3. Billet d’entrée' }).locator('.sous-total')).toHaveText(/Coût réel\s*− 1\s000\s€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.getByRole('button', { name: 'Garder', exact: true }).click()
  await expect(page.getByText('Simulation gardée.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'simulations' && e.methode === 'POST')?.corps).toMatchObject({ type: 'prix_fut' })
  expect(erreurs).toEqual([])
})
