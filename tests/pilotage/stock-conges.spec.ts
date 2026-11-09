import { expect, test, type Page } from '@playwright/test'
import { COMPTE, simulerSupabase, textesTropPetits } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { ongletParametres, ouvrir, simulerPilotage, zonesTropPetites, type MagasinSimule, type OptionsSimulation as OptionsPilotage, type PersonneSimulee, type VenteSimulee } from './supabase-simule'

// Stock cible de l'Extérieur et provision des congés payés (Joseph, 04/11/2026). Données fictives uniquement.

const N = new Date().getFullYear()
const NOM = 'Annecy Test'
const magasins: MagasinSimule[] = [{ magasin: NOM, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }]

// Mois tous identiques, l'an dernier comme cette année (janvier à septembre) : Cave 50 000 € de CA HT à 40 % de marge
// (30 000 € d'achats des ventes), Bar 10 000 € à 75 % (2 500 €), Extérieur 8 000 € à 40 % (4 800 €)
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const ventes = (a: number, jusqua: number): VenteSimulee[] => Array.from({ length: jusqua }, (_, i) => [
  { store_name: NOM, mois: mois(a, i + 1), univers: 'cave', famille: 'Bière', ca_ht: 50_000, ca_ttc: 60_000, marge_ht: 20_000 },
  { store_name: NOM, mois: mois(a, i + 1), univers: 'bar', famille: 'Fût', ca_ht: 10_000, ca_ttc: 11_000, marge_ht: 7_500 },
  { store_name: NOM, mois: mois(a, i + 1), univers: 'exterieur', famille: 'Factures', ca_ht: 8_000, ca_ttc: 9_600, marge_ht: 3_200 },
]).flat()
const reel = [...ventes(N - 1, 12), ...ventes(N, 9)]
const ligne = (page: Page, nom: string) =>
  page.getByRole('table', { name: `Stock ${N} par mois` }).getByRole('row').filter({ has: page.getByRole('cell', { name: nom, exact: true }) })

async function connecter(page: Page, pilotage: OptionsPilotage) {
  await simulerSupabase(page, {})
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

test('stock de l’Extérieur : cible d’un mois d’achats à venir, saisi avec la Cave et le Bar', async ({ page, isMobile }, info) => {
  const ecritures = await connecter(page, { reel, parametres: null })
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=budget`)
  await ouvrir(page, 'Stock')
  // Cible fin septembre : Cave 2,5 × 30 000 + Bar 1 × 2 500 + Extérieur 1 × 4 800 = 82 300 €
  const chiffres = page.getByRole('region', { name: `Stock ${N} en chiffres` })
  await expect(chiffres).toContainText(/Cible fin septembre82\s300\s€Cave 2,5 mois, Bar 1 mois, Extérieur 1 mois/)
  await expect(ligne(page, 'Cible')).toContainText(/82\s300/)

  await page.getByRole('button', { name: 'Saisir le stock d’un mois' }).click()
  await page.getByRole('combobox', { name: 'Mois' }).click()
  await page.getByRole('option', { name: `Fin septembre ${N}` }).click()
  await page.getByLabel('Stock de la Cave').fill('75000')
  await page.getByLabel('Stock du Bar').fill('2500')
  await page.getByLabel('Stock de l’Extérieur').fill('-1')
  await page.getByRole('button', { name: 'Enregistrer le stock' }).click()
  await expect(page.getByText('Saisis des montants en euros, sans signe moins')).toBeVisible()
  await page.getByLabel('Stock de l’Extérieur').fill('4000')
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.getByRole('button', { name: 'Enregistrer le stock' }).click()
  await expect(page.getByText(`Stock de fin septembre ${N} enregistré.`)).toBeVisible()
  expect(ecritures.find((e) => e.table === 'stocks' && e.methode === 'POST')?.corps).toEqual({ store_name: NOM, annee: N, mois: 9, cave: 75_000, bar: 2_500, exterieur: 4_000 })

  // 81 500 € pour 82 300 € : dans la fourchette ; Extérieur 4 000 ÷ 4 800 = 0,8 mois
  await expect(chiffres).toContainText(/81\s500\s€/)
  await expect(chiffres).toContainText('Extérieur 4 k€')
  await expect(chiffres).toContainText('Dans la cible')
  await expect(ligne(page, 'Stock Extérieur')).toContainText(/4\s000/)
  await expect(ligne(page, 'Stock total')).toContainText(/81\s500/)
  await expect(ligne(page, 'Couverture Extérieur')).toContainText('0,8 mois')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-stock-exterieur.png`, fullPage: true })
})

test('stock : paramètres déjà enregistrés sans l’Extérieur, rien ne change tant qu’il n’est pas réglé', async ({ page }) => {
  await connecter(page, { reel, parametres: { tresorerie: { stock: { mois: { cave: 2.5, bar: 1, exterieur: 0 }, tolerance: 0.1 } } } })
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=budget`)
  await ouvrir(page, 'Stock')
  await expect(page.getByRole('region', { name: `Stock ${N} en chiffres` })).toContainText(/Cible fin septembre77\s500\s€/)
  await expect(ligne(page, 'Stock Extérieur')).toHaveCount(0)
})

test('paramètres réseau : stock cible de l’Extérieur et provision des congés payés', async ({ page, isMobile }, info) => {
  const ecritures = await connecter(page, { parametres: null })
  await page.goto('./#/budgets/parametres')
  await ongletParametres(page, 'Trésorerie')
  const treso = page.getByRole('region', { name: 'Trésorerie' })
  await expect(page.getByLabel('Stock cible de l’Extérieur en mois')).toHaveValue('1')
  await page.getByLabel('Stock cible de l’Extérieur en mois').fill('13')
  await expect(treso.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await page.getByLabel('Stock cible de l’Extérieur en mois').fill('1,5')
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await treso.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Paramètres de trésorerie \d{4} enregistrés\./)).toBeVisible()
  const stock = (ecritures.find((e) => e.table === 'parametres_reseau')?.corps as { valeur: { tresorerie: { stock: unknown } } }).valeur.tresorerie.stock
  expect(stock).toEqual({ mois: { cave: 2.5, bar: 1, exterieur: 1.5 }, tolerance: 0.1 })

  await ongletParametres(page, 'Équipe')
  const charges = page.getByRole('region', { name: 'Charges sociales' })
  await expect(charges.getByLabel('Provision des congés payés')).toHaveValue('10')
  await charges.getByLabel('Provision des congés payés').fill('12')
  await charges.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Charges sociales \d{4} enregistrées\./)).toBeVisible()
  const valeur = (ecritures.filter((e) => e.table === 'parametres_reseau').at(-1)?.corps as { valeur: { charges: { congesPayes: number } } }).valeur
  expect(valeur.charges.congesPayes).toBe(0.12)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-parametres-conges.png`, fullPage: true })
})

// Vendeur au SMIC (1 823,03 € × 12 = 21 876,36 €) : charges effectives 1,23 % ; provision 21 876,36 × 10 % × 1,0123 =
// 2 214,54 € ; gérant TNS sans provision
const equipe: PersonneSimulee[] = [
  { id: 1, store_name: NOM, poste: 'Vendeur 1', categorie: 'employe', heures_hebdo: 35, brut_mensuel: 1823.03, primes: [], entree: null, sortie: null },
  { id: 2, store_name: NOM, poste: 'Gérant', categorie: 'gerant_tns', heures_hebdo: 45, brut_mensuel: 3000, primes: [], entree: null, sortie: null },
]

test('équipe : la provision des congés payés s’ajoute à la masse salariale chargée', async ({ page, isMobile }, info) => {
  await connecter(page, { equipe, parametres: null })
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=budget`)
  await ouvrir(page, 'Équipe')
  const tableau = page.getByRole('table', { name: 'Postes et coût chargé' })
  const cp = tableau.getByRole('row').filter({ hasText: 'dont congés payés' })
  await expect(cp).toContainText(/Provision de 10(,0)?\s%\sdu salaire de base, chargée/)
  await expect(cp).toContainText(/2\s21[45]/)
  // Total : 21 876,36 × 1,0123 × 1,1 + 3 000 × 12 × 1,33 = 24 359,93 + 47 880 = 72 240 €
  await expect(tableau.getByRole('row').filter({ hasText: /^Total/ })).toContainText(/72\s240/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-equipe-conges.png`, fullPage: true })
})

test('équipe : paramètres enregistrés sans congés payés, pas de provision', async ({ page }) => {
  await connecter(page, { equipe, parametres: { charges: { taux: {}, reduction: {} } } })
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=budget`)
  await ouvrir(page, 'Équipe')
  const tableau = page.getByRole('table', { name: 'Postes et coût chargé' })
  await expect(tableau.getByRole('row').filter({ hasText: /^Total/ })).toContainText(/70\s025/)   // 22 145,44 + 47 880
  await expect(tableau.getByRole('row').filter({ hasText: 'dont congés payés' })).toHaveCount(0)
})
