import { expect, test, type Page } from '@playwright/test'
import { COMPTE, ouvrirOnglet, simulerSupabase, textesTropPetits } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type TicketsSimules, type VenteSimulee } from './supabase-simule'

// Refonte façon SaaS, vague 2, côté budgets (Joseph, 09/11/2026) : clôture du mois dans la fiche et vue du réseau avec
// relance (12A), cases à cocher et actions en masse sur les budgets (16A), volet Activité du budget (20A).
// Données fictives uniquement.

const M = 'Annecy Test'
const magasins: MagasinSimule[] = [{ magasin: M, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }]
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const reel: VenteSimulee[] = []
const tickets: TicketsSimules[] = []
for (const a of [2025, 2026]) for (let m = 1; m <= (a === 2026 ? 9 : 12); m++) {
  reel.push({ store_name: M, mois: mois(a, m), univers: 'cave', famille: 'Vin', ca_ht: 30_000 + m * 1_000, ca_ttc: 36_000 + m * 1_200, marge_ht: 11_000 + m * 300 })
  tickets.push({ store_name: M, mois: mois(a, m), univers: 'cave', tickets: 1_500 + m * 10 })
}
const messages = [{ id: 1, store_name: M, annee: 2027, texte: 'Le loyer augmente de 4 % en avril.', auteur: 'x', auteur_role: 'franchise', auteur_nom: 'Hugo FICTIF', cree_le: '2026-11-08T09:00:00Z', ancre: 'theme/fraisBudget', ancre_libelle: 'Frais', parent: null }]

async function connecter(page: Page, compteParMois = false) {
  await simulerSupabase(page, {})
  await simulerPilotage(page, { magasins, reel, tickets, messages, compteParMois })
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

test('la clôture du mois guide les saisies du magasin, étape par étape', async ({ page, isMobile }, info) => {
  await connecter(page)
  await page.goto(`./#/magasins/${encodeURIComponent(M)}`)
  await ouvrirOnglet(page, 'Chiffres')
  await page.getByRole('navigation', { name: 'Pages du magasin' }).getByRole('button', { name: /^Clôturer / }).click()
  const cloture = page.getByRole('region', { name: 'Clôture du mois' })
  // Au 27/10/2026, le dernier mois clos est septembre ; le réel de septembre est arrivé
  await expect(cloture.getByRole('heading', { level: 2 })).toHaveText('Septembre 2026')
  await expect(cloture.getByRole('button', { name: 'Réel du mois' })).toContainText('Voir')
  await expect(cloture.getByRole('button', { name: 'Stock de fin de mois' })).toContainText('Saisir')
  await expect(cloture.getByRole('button', { name: 'Comptes du quadrimestre' })).toHaveCount(0)
  // Août ferme le 2e quadrimestre : ses comptes s'ajoutent à la liste
  await cloture.getByRole('button', { name: 'Mois précédent' }).click()
  await expect(cloture.getByRole('heading', { level: 2 })).toHaveText('Août 2026')
  await expect(cloture.getByRole('button', { name: 'Comptes du quadrimestre' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-cloture-mois.png`, fullPage: true })
  // Une étape ouvre sa saisie, le retour ramène à la clôture
  await cloture.getByRole('button', { name: 'Stock de fin de mois' }).click()
  await expect(cloture).toHaveCount(0)
  await page.getByRole('button', { name: 'Clôture du mois' }).click()
  await expect(page.getByRole('region', { name: 'Clôture du mois' })).toBeVisible()
})

test('les clôtures du réseau se lisent dans Performance et se relancent en masse', async ({ page, isMobile }, info) => {
  await connecter(page)
  await page.goto('./#/performance?vue=clotures')
  const vue = page.getByRole('region', { name: 'Clôtures du mois' })
  await expect(vue.getByRole('heading', { level: 2 })).toHaveText('Septembre 2026')
  const tableau = vue.getByRole('table', { name: 'Clôtures de septembre 2026' })
  await expect(tableau.getByRole('row').filter({ hasText: M })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-clotures-reseau.png`, fullPage: !isMobile })
  await tableau.getByRole('checkbox', { name: `Sélectionner ${M}` }).check()
  const barre = page.getByRole('toolbar', { name: 'Actions sur la sélection' })
  await expect(barre).toContainText('1 magasin')
  await barre.getByRole('button', { name: 'Relancer les franchisés' }).click()
  await expect(page.getByText(/relance envoyée|n’ont pas pu partir/)).toBeVisible()
})

test('PC : les budgets se cochent pour proposer ou relancer en une fois', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Cases du tableau des budgets, sur PC')
  await connecter(page)
  await page.goto('./#/budgets')
  const tableau = page.getByRole('table', { name: /^Budgets 2027 par magasin/ })
  await tableau.getByRole('checkbox', { name: `Sélectionner ${M}` }).check()
  const barre = page.getByRole('toolbar', { name: 'Actions sur la sélection' })
  await expect(barre).toContainText('1 budget')
  await expect(barre.getByRole('button', { name: 'Proposer le budget' })).toBeVisible()
  await expect(barre.getByRole('button', { name: 'Relancer les franchisés' })).toBeVisible()
  await barre.getByRole('button', { name: 'Désélectionner' }).click()
  await expect(barre).toBeHidden()
})

test('le volet du budget montre aussi l’activité : commentaires et enregistrements', async ({ page, isMobile }, info) => {
  await connecter(page)
  await page.goto(`./#/magasins/${encodeURIComponent(M)}?vue=budget&partie=budget`)
  await page.getByRole('button', { name: /^Commentaires( \(|$)/ }).click()
  const volet = page.getByRole('complementary', { name: 'Volet des commentaires' })
  await volet.getByRole('button', { name: 'Tout' }).click()
  const activite = volet.getByRole('list', { name: 'Activité du budget' })
  await expect(activite.getByRole('listitem').filter({ hasText: 'a commenté : Frais' })).toContainText('Le loyer augmente de 4 % en avril.')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-activite-budget.png` })
  await volet.getByRole('button', { name: 'Commentaires seuls' }).click()
  await expect(volet.getByRole('region', { name: 'Commentaires', exact: true })).toContainText('Le loyer augmente')
})

test('PC : le détail d’une carte du budget s’ouvre à droite, les cartes restent visibles', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Panneau de détail sur grand écran')
  await connecter(page)
  await page.goto(`./#/magasins/${encodeURIComponent(M)}?vue=budget&partie=budget`)
  const cartes = page.getByRole('region', { name: 'Hypothèses 2027 en cartes' })
  await cartes.getByRole('link', { name: /^Frais : / }).click()
  const detail = page.getByRole('region', { name: 'Détail : Frais 2027' })
  await expect(detail).toBeVisible()
  await expect(cartes).toBeVisible()
  const [c, d] = await Promise.all([cartes, detail].map(async (l) => (await l.boundingBox())!))
  expect(d.x).toBeGreaterThanOrEqual(c.x + c.width)
  // Les étapes du budget restent cliquables, panneau ouvert
  await expect(page.getByRole('navigation', { name: 'Pages du magasin' }).getByRole('tab', { name: /^2 · Visualiser/ })).toBeInViewport()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-budget-panneau-detail.png` })
  // Une autre carte remplace le détail ; Échap ferme
  await cartes.getByRole('link', { name: /^Investissements & Financements : / }).click()
  await expect(page.getByRole('region', { name: 'Détail : Investissements & Financements 2027' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: /^Détail : / })).toHaveCount(0)
  await expect(cartes).toBeVisible()
})

test('téléphone : le compte de résultat se lit mois par mois, les indicateurs défilent en bande', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'Lecture sur téléphone')
  await connecter(page, true)
  await page.goto(`./#/magasins/${encodeURIComponent(M)}?vue=budget&partie=visualiser`)
  const mois = page.getByRole('group', { name: 'Mois affiché' }).first()
  await expect(mois.getByRole('button')).toHaveCount(13)
  await mois.getByRole('button', { name: 'Mars' }).click()
  await expect(mois.getByRole('button', { name: 'Mars' })).toHaveAttribute('aria-pressed', 'true')
  const liste = page.getByRole('list', { name: /mois par mois, Mars$/i }).first()
  await expect(liste.getByRole('listitem').filter({ hasText: 'Chiffre d’affaires HT' })).toContainText('k€')
  for (const b of await mois.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  // Bande des indicateurs : défile de côté, sans déborder de la page
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(largeur).toBeLessThanOrEqual(0)
  expect(await textesTropPetits(page)).toEqual([])
  expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-budget-mois-par-mois.png`, fullPage: true })
  // Le tableau complet reste à portée, et le choix est gardé
  await page.getByRole('button', { name: 'Tableau' }).first().click()
  await expect(page.getByRole('table', { name: /mois par mois/ }).first()).toBeVisible()
  await page.reload()
  await expect(page.getByRole('table', { name: /mois par mois/ }).first()).toBeVisible()
})
