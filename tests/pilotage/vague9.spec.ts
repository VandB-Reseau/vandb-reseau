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
    coutHoraire: 20, exterieur: { prixKm: 0.6, dureeTireuse: 5, entretienTireuse: 0, co2ParFut: 0.76 }, donMecenat: true,
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
  await expect(page.getByRole('navigation', { name: 'Choisir un simulateur' }).getByRole('button')).toHaveCount(13)
  await expect(page.getByRole('heading', { name: 'Contrat extérieur' })).toBeVisible()
  // Exemple de la fiche : 69 € HT (facturé à l'organisateur, tout en HT), achat 41,34 € HT ; CO2 0,76 €, 0,60 €/km et 20 €/h viennent des repères du siège
  await page.getByLabel('Prix de vente du fût HT').fill('69')
  await page.getByLabel('Prix d’achat du fût HT').fill('41,34')
  // Livraison : 30 km × 0,60 = 18 € + 1,5 h × 20 € = 30 €, 48 € ; × 10 = 480 € par an
  await expect(page.getByText(/Une livraison coûte 48,00\s€ HT : 18,00\s€ d’indemnités kilométriques .* et 30,00\s€ de temps .*Sur 10 livraisons : 480\s€ par an/)).toBeVisible()
  // 24,83 € nets par fût ; 300 € de tireuse + 10 × 48 € de livraisons = 780 € ; équilibre à 32 fûts ; 213 € de gain à 40 fûts
  await expect(page.getByRole('status')).toContainText(/24,83\s€ nets par fût, 780\s€ de coûts fixes, équilibre à 32 fûts ; gain de 213\s€/)
  // Don de 1 000 € avec reçu Cerfa : 400 € de coût réel (réduction mécénat réglée par le siège)
  await page.getByRole('group', { name: 'Don' }).getByRole('button', { name: 'En argent' }).click()
  await page.getByLabel('Montant du don').fill('1000')
  await expect(page.getByLabel('Reçu Cerfa demandé')).toBeChecked()
  await expect(page.getByText('Coût réel du don')).toBeVisible()
  await expect(page.getByRole('status')).toContainText(/1\s180\s€ de coûts fixes, équilibre à 48 fûts ; perte de 187\s€/)
  await page.getByLabel('Reçu Cerfa demandé').uncheck()
  await expect(page.getByRole('status')).toContainText(/1\s780\s€ de coûts fixes/)
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
  // IPA : 44 € de marge par semaine à 57 %, 25 jours pour vider un fût (seuil du siège : 21) ; demi à 6,25 € pour 68 %
  await expect(page.getByRole('status')).toHaveText(/^Le bec 2 \(IPA\) rapporte 44\s€ par semaine à 57\s% de marge et met 25 jours à vider un fût : monte le demi à 6,25\s€, ou remplace-le\.$/)
  await expect(page.getByRole('table', { name: 'Becs de la carte pression' }).getByRole('row')).toHaveCount(3)
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

test('Directeur : les nouveaux repères dans Paramètres, don traité comme un don', async ({ page }) => {
  const ecritures = await connecter(page, {}, { parametres: { tauxRedevance: 0.02, tauxPublicite: 0.01 } })
  await page.goto('./#/parametres/reglages?rubrique=budget')
  await page.getByRole('tab', { name: 'Simulateurs' }).click()
  await page.getByLabel('Prix du kilomètre').fill('0,6')
  await page.getByLabel('Don traité comme un don').check()
  // Perte standard des fûts : 7 % d'office (Joseph, 14/11/2026), réglable
  await expect(page.getByLabel('Perte standard des fûts')).toHaveValue('7')
  await page.getByLabel('Perte standard des fûts').fill('6')
  await page.getByRole('button', { name: 'Ajouter un palier', exact: true }).click()
  await page.getByLabel('Part du bar, palier 1').fill('55')
  await page.getByLabel('CA par heure visé, palier 1').fill('100')
  await page.getByRole('region', { name: 'Simulateurs' }).getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Repères des simulateurs \d{4} enregistrés\./)).toBeVisible()
  const p = ecritures.filter((e) => e.table === 'parametres_reseau').at(-1)?.corps as { valeur: { simulateurs: Record<string, unknown> } }
  expect(p.valeur.simulateurs).toMatchObject({ donMecenat: true, exterieur: { prixKm: 0.6 }, productivite: [{ partBar: 0.55, cible: 100 }], tva: { normale: 0.2, intermediaire: 0.1, reduite: 0.055 }, pression: { perteStandard: 0.06 } })
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
