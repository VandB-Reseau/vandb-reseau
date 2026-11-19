import { expect, test, type Page } from '@playwright/test'
import { chiffresFictifs } from '../donnees-fictives'
import { COMPTE, seConnecter as connecterReseau, simulerSupabase, textesTropPetits, type Ecriture, type OptionsSimulation } from '../supabase-simule'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter as connecterPilotage, type QuadrimestreSimule, type VenteSimulee } from './ecrans/outils'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type OptionsSimulation as OptionsPilotage } from './supabase-simule'

// Boîte à outils du coach (vague 9, choix 138 à 147, Joseph 14/11/2026). Données fictives uniquement.
const NOM = 'Annecy Test'
const magasins: MagasinSimule[] = [{ magasin: NOM, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }]
const franchise: OptionsSimulation = { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: [NOM] } }
const reperes = {
  tauxRedevance: 0.02, tauxPublicite: 0.01,
  simulateurs: {
    coutHoraire: 20, exterieur: { prixKm: 0.6, dureeTireuse: 5, entretienTireuse: 0, co2ParFut: 0.76 }, donMecenat: false,
    pression: { cibleMarge: 0.68, joursFraicheur: 21 }, majorations: { dimanche: 0.5, ferie: 1 },
    productivite: [{ partBar: 0.55, cible: 100 }, { partBar: 0.45, cible: 105 }, { partBar: 0.35, cible: 110 }, { partBar: 0.3, cible: 120 }, { partBar: 0, cible: 130 }],
  },
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

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('138 et 141 : contrat extérieur rentable, don avec reçu Cerfa, gardé', async ({ page, isMobile }, info) => {
  const ecritures = await connecter(page, franchise, { role: 'franchise' })
  await simulateur(page, 'exterieur')
  await expect(page.getByRole('navigation', { name: 'Choisir un simulateur' }).getByRole('button')).toHaveCount(19)
  await expect(page.getByRole('heading', { name: 'Contrat extérieur' })).toBeVisible()
  // Exemple de la fiche : 69 € HT (facturé à l'organisateur, tout en HT), achat 41,34 € HT ; CO2 0,76 €, 0,60 €/km et 20 €/h viennent des repères du siège
  await page.getByLabel('Prix de vente du fût HT').fill('69')
  await page.getByLabel('Prix d’achat du fût HT').fill('41,34')
  // Livraison : 30 km × 0,60 = 18 € + 1,5 h × 20 € = 30 €, 48 € ; × 10 = 480 € par an
  await expect(page.getByText(/Une livraison coûte 48,00\s€ HT : 18,00\s€ d’indemnités kilométriques .* et 30,00\s€ de temps \(1,5 h à 20,00\s€\)\./)).toBeVisible()
  // Blocs dans l'ordre recettes → coûts → résultat, chacun avec son sous-total (Joseph, 15/11/2026)
  // Gaz vendu à la bouteille (Joseph, 19/11/2026) : 2 bouteilles (1 tireuse + 1) à 40 € TTC = 66,67 € HT ; plus de CO2 par fût
  await expect(page.getByRole('region', { name: '1. Recettes' }).locator('.sous-total')).toHaveText(/CA HT de l’année\s*2\s827\s€/)
  await expect(page.getByRole('region', { name: '2. Fûts' }).locator('.sous-total')).toHaveText(/− 1\s654\s€/)
  await expect(page.getByRole('region', { name: '5. Livraisons' }).locator('.sous-total')).toHaveText(/Par an\s*− 480\s€/)
  // Contrat de 3 ans dans l'exemple, tireuse de 5 ans : 1 500 ÷ 3 = 500 € par an au lieu de 300 € ; 600 € non amortis à la fin
  await expect(page.getByLabel('Durée du contrat')).toHaveValue('3')
  await expect(page.getByRole('region', { name: '4. Tireuses et gaz' })).toContainText(/une tireuse de 5 ans : payée sur le contrat, 500\s€ par an au lieu de 300\s€\. Si le client part à la fin, il reste 600\s€ non amortis\./)
  const compte = page.getByRole('table', { name: 'Compte de l’année' })
  // Gobelets réutilisables du contrat (Joseph, 16/11/2026) : 500 × 0,25 € = 125 € de coût fixe
  await expect(page.getByRole('region', { name: '6. Matériel, gobelets et astreinte' }).locator('.sous-total')).toHaveText(/Par an\s*− 125\s€/)
  // CO2 : 66,67 € de CA, 40 € d'achat (marge de 40 % sur le HT) ; redevance et publicité 2 826,67 × 3 % = 84,80 €
  await expect(compte.getByRole('row')).toHaveText([/Recettes.*\+ 2\s827\s€/, /Fûts.*− 1\s654\s€/, /Bouteilles de CO2.*− 40\s€/, /Redevance et publicité.*− 85\s€/, /Tireuse.*− 500\s€/, /Livraisons.*− 480\s€/, /Matériel, gobelets et astreinte.*− 125\s€/, /Perte de l’année.*57\s€/])
  // 25,59 € nets par fût ; 1 105 € de coûts fixes ; CO2 net 66,67 × 0,97 − 40 = 24,67 € ; équilibre (1 105 − 24,67) ÷ 25,59 = 42,2,
  // 43 fûts ; 40 × 25,59 + 24,67 − 1 105 = − 56,73 € ; si la tireuse ressert : 880,33 ÷ 25,59 = 34,4, 35 fûts.
  // Consignes : 4 fûts d'une livraison × 60 € + 2 bouteilles × 85 € = 410 € bloqués au plus fort
  await expect(page.getByRole('status')).toContainText(/25,59\s€ nets par fût, 1\s105\s€ de coûts fixes, équilibre à 43 fûts ; perte de 57\s€ au volume prévu\. Tireuse payée sur les 3 ans du contrat : 600\s€ non amortis si le client part, équilibre à 35 fûts si elle ressert ailleurs\. Consignes : 410\s€ de trésorerie bloqués au plus fort\./)
  await expect(page.getByText('Perte sur la durée du contrat')).toBeVisible()
  // Contrat de 5 ans : on revient à l'amortissement sur la durée de vie : 905 € ; 1 048,27 − 905 = 143 €
  await page.getByLabel('Durée du contrat').fill('5')
  await expect(page.getByRole('status')).toContainText(/905\s€ de coûts fixes, équilibre à 35 fûts ; gain de 143\s€ au volume prévu\. Consignes : 410\s€ de trésorerie bloqués au plus fort\.$/)
  await expect(page.getByText('Reste non amorti en fin de contrat')).toHaveCount(0)
  await page.getByLabel('Durée du contrat').fill('3')
  // Don de 1 000 € avec reçu Cerfa : 400 € de coût réel ; case Cerfa proposée sur chaque contrat (Joseph, 16/11/2026)
  await page.getByRole('group', { name: 'Don' }).getByRole('button', { name: 'En argent' }).click()
  await page.getByLabel('Montant du don').fill('1000')
  await expect(page.getByLabel('Reçu Cerfa demandé')).toBeChecked()
  await expect(page.getByText('Coût réel du don', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: '7. Don ou sponsoring à l’association' })).toContainText(/Coût réel du don : 400\s€ \(1\s000\s€ moins 600\s€ de réduction d’impôt grâce au reçu Cerfa\)\./)
  // 1 105 + 400 = 1 505 € ; (1 505 − 24,67) ÷ 25,59 = 57,8, 58 fûts ; 1 048,27 − 1 505 = − 456,73 €
  await expect(page.getByRole('status')).toContainText(/1\s505\s€ de coûts fixes, équilibre à 58 fûts ; perte de 457\s€/)
  await page.getByLabel('Reçu Cerfa demandé').uncheck()
  await expect(page.getByRole('status')).toContainText(/2\s105\s€ de coûts fixes/)
  await expect(page.getByRole('region', { name: '7. Don ou sponsoring à l’association' })).toContainText(/sans reçu Cerfa, pas de réduction d’impôt \(600\s€ perdus\)/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-simulateur-exterieur.png`, fullPage: true })
  // PDF : seule la carte du simulateur part à l'impression
  await page.evaluate(() => { (window as unknown as { imprime: number }).imprime = 0; window.print = () => { (window as unknown as { imprime: number }).imprime++ } })
  await page.getByRole('button', { name: 'PDF', exact: true }).click()
  expect(await page.evaluate(() => [(window as unknown as { imprime: number }).imprime, document.body.classList.contains('simulation-seule')])).toEqual([1, true])
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('navigation', { name: 'Choisir un simulateur' })).toBeHidden()
  await expect(page.locator('#carte-simulation')).toContainText(`Contrat extérieur · ${NOM}`)
  await page.emulateMedia({ media: 'screen' })
  await page.getByRole('button', { name: 'Garder', exact: true }).click()
  await expect(page.getByText('Simulation gardée.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'simulations' && e.methode === 'POST')?.corps).toMatchObject({ type: 'exterieur', donnees: { prixVente: 69, don: 'argent', montantDon: 1_000, cerfa: false } })
})

test('Contrat extérieur : la remise se saisit en prix facturé, le CA suit', async ({ page }) => {
  await connecter(page, franchise, { role: 'franchise' })
  await simulateur(page, 'exterieur')
  // Joseph, 17/11/2026 : 70 € et 68 € saisis donnaient 80 × 2 € = 160 € de CA (68 € lus comme remise)
  await page.getByLabel('Fûts vendus par an').fill('80')
  await page.getByLabel('Prix de vente du fût HT').fill('70')
  // La remise est dans son bloc « Remise ou fûts offerts » (Joseph, 19/11/2026)
  await page.getByRole('group', { name: 'Geste commercial' }).getByRole('button', { name: 'Remise' }).click()
  await expect(page.getByLabel('Prix facturé après remise HT')).toHaveValue('70')
  await page.getByLabel('Prix facturé après remise HT').fill('68')
  const recettes = page.getByRole('region', { name: '1. Recettes' })
  // 5 440 € de fûts + 66,67 € de CO2
  await expect(recettes.locator('.sous-total')).toHaveText(/CA HT de l’année\s*5\s507\s€/)
  await expect(recettes).toContainText(/80 fûts à 68,00\s€ \(remise de 2,00\s€ par fût, soit 2,9\s%\) : 5\s440\s€, CO2 : 67\s€\./)
  // Un prix facturé au-dessus du prix de vente ne crée pas de remise négative
  await page.getByLabel('Prix facturé après remise HT').fill('75')
  await expect(recettes.locator('.sous-total')).toHaveText(/CA HT de l’année\s*5\s667\s€/)
})

test('Contrat extérieur : fûts offerts, bouteilles de CO2, consignes et trésorerie', async ({ page, isMobile }) => {
  await connecter(page, franchise, { role: 'franchise' })
  await simulateur(page, 'exterieur')
  await page.getByLabel('Prix de vente du fût HT').fill('69')
  await page.getByLabel('Prix d’achat du fût HT').fill('41,34')
  // Bouteilles de CO2 : une de plus que de tireuses par défaut, puis saisies à part
  await expect(page.getByLabel('Bouteilles de CO2 en place')).toHaveValue('2')
  await page.getByLabel('Nombre de tireuses').fill('2')
  await expect(page.getByLabel('Bouteilles de CO2 en place')).toHaveValue('3')
  await expect(page.getByLabel('Bouteilles de CO2 vendues par an')).toHaveValue('3')
  await expect(page.getByLabel('Prix d’une bouteille de CO2 TTC')).toHaveValue('40')
  // 3 × 40 ÷ 1,2 = 100 € HT, achat 60 €, marge 40 €
  const gaz = page.getByRole('region', { name: '4. Tireuses et gaz' })
  await expect(gaz).toContainText(/3 bouteilles de CO2 à 40,00\s€ TTC, soit 33,33\s€ HT : 100\s€ de CA HT, 60\s€ d’achat, 40\s€ de marge/)
  // Deux tireuses sur un contrat de 3 ans : 2 × 1 500 ÷ 3 = 1 000 € ; moins 40 € de marge du gaz : − 960 €, en rouge
  await expect(gaz.locator('.sous-total')).toHaveText(/Par an\s*− 960\s€/)
  // Consignes : 40 × 60 + 3 × 85 = 2 655 € ; au plus fort 4 fûts × 60 + 255 = 495 €
  const consignes = page.getByRole('region', { name: '8. Consignes (trésorerie)' })
  await expect(consignes.locator('.sous-total')).toHaveText(/Bloqué au plus fort\s*− 495\s€/)
  await expect(consignes.getByRole('table', { name: 'Consignes de l’année' }).getByRole('row')).toHaveText([/Sorties.*− 2\s655\s€/, /Rentrées.*\+ 2\s655\s€/, /Bloqué au plus fort.*− 495\s€/])
  await consignes.getByLabel('Consignes payées par le client').check()
  await expect(consignes).toContainText(/Le client avance les consignes \(495\s€ au plus fort\)/)
  await expect(consignes.locator('.sous-total')).toHaveText(/Bloqué au plus fort\s*0\s€/)
  // Deux fûts offerts : 2 × 41,34 = 82,68 € ; marge 1 106,40 − 82,68 = 1 023,72 €
  const geste = page.getByRole('region', { name: '3. Remise ou fûts offerts' })
  await geste.getByRole('group', { name: 'Geste commercial' }).getByRole('button', { name: 'Fûts offerts' }).click()
  await geste.getByLabel('Fûts offerts par an').fill('2')
  await expect(geste.locator('.sous-total')).toHaveText(/Coût du geste\s*− 83\s€/)
  await expect(geste).toContainText(/Marge des fûts : 1\s024\s€ \(37,1\s%\) au lieu de 1\s106\s€ \(40,1\s%\) sans geste, 2 fûts offerts à 41,34\s€ d’achat\. Le gain de l’année baisse de 83\s€\./)
  await expect(page.getByRole('table', { name: 'Compte de l’année' })).toContainText(/Fûts offerts.*− 83\s€/)
  // Remise de 10 % : 6,90 € par fût, prix facturé 62,10 € ; 40 × 6,90 × 0,97 = 267,72 €
  await geste.getByRole('group', { name: 'Geste commercial' }).getByRole('button', { name: 'Remise', exact: true }).click()
  await geste.getByLabel('Remise', { exact: true }).fill('10')
  await expect(geste.getByLabel('Prix facturé après remise HT')).toHaveValue('62,1')
  await expect(geste.locator('.sous-total')).toHaveText(/Coût du geste\s*− 268\s€/)
  await expect(page.getByRole('table', { name: 'Compte de l’année' })).not.toContainText('Fûts offerts')
  // Frais en négatif, en rouge : coûts fixes de l'année
  const couts = page.getByText('Coûts fixes de l’année', { exact: true }).locator('xpath=ancestor::*[contains(@class,"MuiCard-root")][1]').locator('p').nth(1)
  await expect(couts).toHaveText(/^− /)
  expect(await couts.evaluate((n) => getComputedStyle(n).color)).not.toBe(await page.locator('body').evaluate((n) => getComputedStyle(n).color))
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('139 : parc de tireuses, racheter quand les refus coûtent plus qu’une tireuse neuve', async ({ page }) => {
  await connecter(page, franchise, { role: 'franchise' })
  await simulateur(page, 'tireuses')
  await page.getByLabel('Prix de vente du fût TTC').fill('82,8')
  await page.getByLabel('Prix d’achat du fût HT').fill('41,34')
  await page.getByLabel('Fûts par week-end loué').fill('3')
  await page.getByLabel('Week-ends refusés faute de tireuse').fill('12')
  // 12 × 3 fûts × 24,83 € = 894 € perdus, face à 1 500 ÷ 5 = 300 € par an (vague 10 : compté en week-ends)
  await expect(page.getByText(/894\s€ de marge perdue sur 12 week-ends refusés/)).toBeVisible()
  await expect(page.getByRole('status')).toContainText(/12 week-ends refusés : racheter une tireuse\./)
  await page.getByRole('button', { name: 'Ajouter une tireuse' }).click()
  await page.getByLabel('Réparations de la tireuse 1').fill('450')
  await expect(page.getByRole('status')).toContainText('Remplacer Tireuse 1')
})

test('142 : carte pression, le bec à revoir et le projet de nouveau bec', async ({ page, isMobile }, info) => {
  await connecter(page, franchise, { role: 'franchise' })
  await simulateur(page, 'pression')
  await page.getByLabel('Demis par semaine, bec 1').fill('100')
  await page.getByLabel('Pintes par semaine, bec 1').fill('40')
  await page.getByRole('button', { name: 'Ajouter un bec' }).click()
  await page.getByLabel('Bière, bec 2').fill('IPA')
  await page.getByLabel('Prix du fût HT, bec 2').fill('120')
  await page.getByLabel('Litres du fût, bec 2').fill('20')
  await page.getByLabel('Prix du demi TTC, bec 2').fill('4,80')
  await page.getByLabel('Prix de la pinte TTC, bec 2').fill('9')
  await page.getByLabel('Demis par semaine, bec 2').fill('10')
  await page.getByLabel('Pintes par semaine, bec 2').fill('5')
  // IPA : 44 € de marge par semaine à 57 %, 25 jours pour vider un fût (seuil du siège : 21) ; prix du bec × 1,344 (demi à 6,45 €) pour 68 % formats confondus
  await expect(page.getByRole('status')).toHaveText(/^Le bec 2 \(IPA\) rapporte 44\s€ par semaine à 57\s% de marge et met 25 jours à vider un fût : monte ses prix de 34,4\s% \(demi à 6,45\s€\), ou remplace-le\.$/)
  await expect(page.getByRole('table', { name: 'Becs de la carte pression' }).getByRole('row')).toHaveCount(3)
  // Marge du bec, tous formats confondus (Joseph, 15/11/2026) : plus de colonne au demi
  await expect(page.getByRole('table', { name: 'Becs de la carte pression' }).getByRole('columnheader')).toHaveText(['Bec', 'CA HT par semaine', 'Marge par semaine', 'Taux de marge', 'Coût du litre servi', 'Jours pour vider un fût', 'Fûts par mois'])
  await expect(page.getByRole('table', { name: 'Becs de la carte pression' }).getByRole('row').nth(2)).toContainText(/IPA.*78\s€.*44\s€.*57\s%/)
  await page.getByLabel('Projet : ajouter ou remplacer un bec').check()
  await expect(page.getByText('Gain du projet')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-simulateur-pression.png`, fullPage: true })
})

test('143 et 146 : calculette prix et marge, ouverture un dimanche', async ({ page }) => {
  await connecter(page, { appMetadata: { role: 'coach', coach: 'Hugo FICTIF' } }, { role: 'coach' })
  await simulateur(page, 'calculette')
  // Planche : 3 + 2,50 = 5,50 € de coût, 70 % de marge, TVA 10 % : 18,33 € HT, 20,17 € TTC
  await expect(page.getByRole('status')).toContainText(/vendu 20,17\s€ TTC \(18,33\s€ HT\), marge 12,83\s€ soit 70\s%, coefficient 3,67/)
  await page.getByRole('group', { name: 'Je cherche' }).getByRole('button', { name: 'La marge', exact: true }).click()
  await page.getByLabel('Prix de vente TTC').fill('22')
  // 22 € TTC = 20 € HT : 14,50 € de marge, 72,5 %
  await expect(page.getByRole('status')).toContainText(/marge 14,50\s€ soit 72,5\s%/)

  await page.getByRole('navigation', { name: 'Choisir un simulateur' }).getByRole('button', { name: /Dimanche ou jour férié/ }).click()
  await page.getByLabel('Marge du bar').fill('70')
  await page.getByLabel('Marge de la cave').fill('35')
  await page.getByLabel('CA HT attendu au bar').fill('1200')
  await page.getByLabel('CA HT attendu en cave').fill('800')
  await page.getByLabel('Part qui serait venue un autre jour').fill('25')
  await page.getByLabel('Heures payées').fill('16')
  await page.getByLabel('Frais du jour HT').fill('50')
  // Majoration du dimanche 50 % (siège) : 16 h × 20 € × 1,5 = 480 € ; gain 840 − 45 − 480 − 50 = 265 €
  await expect(page.getByRole('status')).toContainText(/gain de 265\s€, rentable à partir de 1\s333\s€ de CA HT dans la journée/)
  // Coût horaire (Joseph, 14/11/2026) : moyenne de l'équipe par défaut, repère du siège quand l'équipe n'est pas saisie
  await expect(page.getByText('20,00 € l’heure chargée, repère du siège (équipe pas saisie)')).toBeVisible()
  const cout = page.getByRole('group', { name: 'Coût horaire' })
  await cout.getByRole('button', { name: 'Montant libre' }).click()
  await page.getByLabel('Coût d’une heure chargée').fill('25')
  // 16 h × 25 € × 1,5 = 600 € ; gain 840 − 45 − 600 − 50 = 145 €
  await expect(page.getByRole('status')).toContainText(/gain de 145\s€/)
  await cout.getByRole('button', { name: 'En part du SMIC' }).click()
  await expect(page.getByLabel('Part du SMIC brut')).toHaveValue('120')
  await expect(page.getByText(/€ l’heure chargée$/)).toBeVisible()
})

test('Directeur : les nouveaux repères dans Paramètres', async ({ page }) => {
  const ecritures = await connecter(page, {}, { parametres: { tauxRedevance: 0.02, tauxPublicite: 0.01 } })
  await page.goto('./#/parametres/reglages?rubrique=budget')
  await page.getByRole('tab', { name: 'Simulateurs' }).click()
  await page.getByLabel('Prix du kilomètre').fill('0,6')
  await expect(page.getByLabel('Don traité comme un don')).toHaveCount(0)
  // Perte standard des fûts : 7 % d'office (Joseph, 14/11/2026), réglable
  await expect(page.getByLabel('Perte standard des fûts')).toHaveValue('7')
  await page.getByLabel('Perte standard des fûts').fill('6')
  await page.getByRole('button', { name: 'Ajouter un palier', exact: true }).click()
  await page.getByLabel('Part du bar, palier 1').fill('55')
  await page.getByLabel('CA par heure visé, palier 1').fill('100')
  await page.getByRole('region', { name: 'Simulateurs' }).getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Repères des simulateurs \d{4} enregistrés\./)).toBeVisible()
  const p = ecritures.filter((e) => e.table === 'parametres_reseau').at(-1)?.corps as { valeur: { simulateurs: Record<string, unknown> } }
  expect(p.valeur.simulateurs).toMatchObject({ exterieur: { prixKm: 0.6 }, productivite: [{ partBar: 0.55, cible: 100 }], tva: { normale: 0.2, intermediaire: 0.1, reduite: 0.055 }, pression: { perteStandard: 0.06 } })
})

test('145 : productivité visée dans l’Équipe, selon la part du bar', async ({ page }) => {
  const equipe = [{ id: 1, store_name: MAGASINS[0], poste: 'Vendeur', categorie: 'employe', heures_hebdo: 35, brut_mensuel: 2_000, primes: [], entree: '2020-01', sortie: null }]
  await connecterPilotage(page, { magasins: [{ magasin: MAGASINS[0], statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }], parametres: reperes, equipe })
  await page.goto(`./#/magasins/${encodeURIComponent(MAGASINS[0])}?vue=budget&partie=equipe`)
  await expect(page.getByText(/^Productivité visée 20\d\d$/)).toBeVisible()
  await expect(page.getByText(/ETP visés pour/)).toBeVisible()
})

test('144 : écart de marge au quadrimestre, un point en euros et causes cochées', async ({ page, isMobile }, info) => {
  const N = new Date().getFullYear()
  const reel: VenteSimulee[] = [1, 2, 3, 4].map((m) => ({ store_name: MAGASINS[0], mois: `${N}-0${m}-01`, univers: 'cave', famille: 'Bière', ca_ht: 50_000, ca_ttc: 60_000, marge_ht: 20_000 }))
  const q: QuadrimestreSimule = { store_name: MAGASINS[0], annee: N, quadrimestre: 1, achats: 133_000, variation_stock: 8_000, charges_externes: 30_000, impots_taxes: 3_000, personnel: 35_000, tresorerie: null }
  const ecritures = await connecterPilotage(page, { role: 'franchise', magasins: [{ magasin: MAGASINS[0], statut: null, hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }], reel, quadrimestres: [q] })
  await ouvrir(page, 'Comptes du quadrimestre')
  // Marge réelle 200 000 − 125 000 = 75 000 (37,5 %) face à 40 % : − 2,5 points, 5 000 € ; un point = 2 000 €
  const carte = page.getByRole('region', { name: 'Écart de marge à expliquer' })
  await expect(carte).toContainText(/5\s000\s€ de marge en moins/)
  await expect(carte).toContainText(/2\s000\s€/)
  await carte.getByLabel('Casse').check()
  await carte.getByLabel('Prix pas à jour en caisse').check()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-ecart-marge.png`, fullPage: true })
  await carte.getByRole('button', { name: 'Enregistrer' }).click()
  const envoi = ecritures.find((e) => e.table === 'echanges_budget' && e.methode === 'POST')?.corps as Record<string, unknown>
  expect(envoi).toMatchObject({ ancre: `demarque/${N}/q1`, texte: 'Causes : Casse ; Prix pas à jour en caisse' })
})

test('140 et 147 : Extérieur du magasin et plan de redressement de celui qui décroche', async ({ page, isMobile }, info) => {
  // Lyon décroche en septembre 2026 ; Extérieur de mai à août : 10 000 € par mois en 2026, 8 000 € en 2025
  const ete = chiffresFictifs.filter((l) => l.store_name === 'Lyon Test' && /^(2025|2026)-0[5-8]/.test(l.month))
    .map((l) => ({ ...l, ca_ext: l.month.startsWith('2026') ? 10_000 : 8_000 }))
  const ecritures: Ecriture[] = []
  await connecterReseau(page, { chiffresCaisse: ete, ecritures })
  await page.goto('./#/magasins/Lyon%20Test?vue=chiffres&partie=sante')
  const ext = page.getByRole('heading', { name: 'Marché extérieur · 2026' }).locator('xpath=ancestor::div[contains(@class,"MuiCard-root")][1]')
  // 40 000 € de janvier à septembre, + 25 % sur 32 000 € ; 4,4 % des 910 000 € du magasin
  await expect(ext).toContainText(/40\s000\s€/)
  await expect(ext).toContainText(/\+25,0 % \(32\s000\s€\)/)
  await expect(ext).toContainText('4,4 %')
  await expect(ext.getByRole('link', { name: 'Simuler un contrat' })).toBeVisible()
  // Moins de 5 magasins avec un CA extérieur : pas de rang
  await expect(ext).not.toContainText('Rang parmi')

  const plan = page.getByRole('heading', { name: 'Plan de redressement' }).locator('xpath=ancestor::div[contains(@class,"MuiCard-root")][1]')
  await plan.getByLabel('Poids des charges').check()
  await expect(plan.getByLabel('Trésorerie · Revoir loyer, charges et taxe foncière')).toBeVisible()
  await plan.getByLabel('Trésorerie · Revoir loyer, charges et taxe foncière').check()
  await plan.getByLabel('Trésorerie · Vérifier la masse salariale et la productivité').check()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-redressement.png`, fullPage: true })
  await plan.getByRole('button', { name: 'Créer 2 tâches du Coach' }).click()
  await expect(plan.getByText(/2 tâches du plan créées/)).toBeVisible()
  expect(ecritures.some((e) => JSON.stringify(e.corps).includes('Redressement : Revoir loyer, charges et taxe foncière'))).toBe(true)
  // Annecy ne décroche pas : pas de plan
  await page.goto('./#/magasins/Annecy%20Test?vue=chiffres&partie=sante')
  await expect(page.getByRole('heading', { name: 'Chiffres', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Plan de redressement' })).toHaveCount(0)
})
