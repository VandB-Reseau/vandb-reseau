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
  // L'exemple, heure chargée saisie à 20 € : contrat de 3 ans, 60 fûts par an à 42 € et 5 € reversés, 2 tireuses à 750 € sur
  // 3 ans (500 €), 6 livraisons de 40 km à 0,60 € (144 €) et 25 h (500 €), 1 150 € d'autres coûts, don 1 000 € avec Cerfa (400 €)
  await page.getByRole('group', { name: 'Coût horaire' }).getByRole('button', { name: 'Montant libre' }).click()
  await page.getByLabel('Coût d’une heure chargée').fill('20')
  await expect(phrase(page)).toContainText(/Festival d’été, 60 fûts par an : fût à 112,07\s€ HT \(134,49\s€ TTC\), dont 5,00\s€ reversés au client, pour couvrir 2\s694\s€ de coûts par an et dégager 1\s009\s€ de masse de marge par an \(15\s%.*du CA HT\), 3\s026\s€ sur les 3 ans du contrat ; prix plancher 94,74\s€, perte sous 44 fûts vendus\. Consignes : 855\s€ de trésorerie bloqués au plus fort\./)
  await expect(page.getByRole('region', { name: '3. Livraisons et équipe' }).locator('.sous-total')).toHaveText(/Par an\s*− 644\s€/)
  await expect(page.getByRole('region', { name: '2. Tireuses achetées pour le marché' })).toContainText(/600\s€ resteraient à amortir/)
  await expect(page.getByRole('table', { name: 'Compte du marché sur un an' }).getByRole('row')).toHaveText([/Recettes.*\+ 6\s724\s€/, /Fûts.*− 2\s520\s€/, /Reversement au client.*− 300\s€/, /Tireuses.*− 500\s€/, /Livraisons et équipe.*− 644\s€/, /Autres coûts annexes.*− 1\s150\s€/, /Don.*− 400\s€/, /Redevance et publicité.*− 202\s€/, /Masse de marge.*1\s009\s€/])
  await expect(page.getByRole('table', { name: 'Masse de marge selon les fûts vendus' })).toContainText(/44, équilibre/)
  // Consignes payées par le client : plus rien de bloqué
  await page.getByLabel('Consignes payées par le client').check()
  await expect(page.getByRole('region', { name: '7. Consignes (trésorerie)' })).toContainText(/Le client avance les consignes \(855\s€ au plus fort\)/)
  // Un coût de plus (sécurité 150 €), marge de 20 € par fût : (47 + (2 844 + 1 200) ÷ 60) ÷ 0,97 = 117,94 €
  await page.getByRole('button', { name: 'Ajouter un coût' }).click()
  await page.getByLabel('Coût 5', { exact: true }).fill('Sécurité')
  await page.getByLabel('Montant HT du coût 5').fill('150')
  await page.getByRole('group', { name: 'Marge souhaitée' }).getByRole('button', { name: 'En € par fût' }).click()
  await page.getByLabel('Marge par fût HT').fill('20')
  await expect(phrase(page)).toContainText(/fût à 117,94\s€ HT .* dégager 1\s200\s€ de masse de marge par an/)
  // Sponsoring : charge pleine, sans reçu Cerfa
  await page.getByRole('group', { name: 'Billet d’entrée' }).getByRole('button', { name: 'Sponsoring' }).click()
  await expect(page.getByLabel('Reçu Cerfa demandé')).toHaveCount(0)
  await expect(page.getByRole('region', { name: '5. Billet d’entrée' }).locator('.sous-total')).toHaveText(/Coût réel\s*− 1\s000\s€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.getByRole('button', { name: 'Garder', exact: true }).click()
  await expect(page.getByText('Simulation gardée.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'simulations' && e.methode === 'POST')?.corps).toMatchObject({ type: 'prix_fut' })
  expect(erreurs).toEqual([])
})
