import { expect, test, type Page } from '@playwright/test'
import { COMPTE, seConnecter, simulerSupabase, textesTropPetits } from './supabase-simule'
import { magasinFictif, MAGASINS } from './pilotage/donnees-fictives'
import { ouvrir, seConnecter as connecterPilotage } from './pilotage/ecrans/outils'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type VenteSimulee } from './pilotage/supabase-simule'

// Harmonisation des tableaux (Joseph, 10/11/2026) : toutes les listes en tableau prennent le rendu de la liste des
// magasins — titres collés en haut, première colonne figée, chaque colonne triée d'un clic sur son titre et filtrée
// par son entonnoir. Les tableaux financiers gardent l'ordre de leurs lignes. Données fictives uniquement.

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const positionPremiere = (page: Page, nom: string) => page.getByRole('table', { name: nom }).locator('tbody tr').first().locator('td').first()
  .evaluate((td) => getComputedStyle(td).position)

test('Magasins : chaque colonne se trie et se filtre, la colonne Magasin reste figée', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Tableau du PC')
  await seConnecter(page)
  await page.goto('./#/magasins?vue=liste')
  const tableau = page.getByRole('table', { name: 'Tableau des magasins' })
  const lignes = tableau.locator('tbody tr').filter({ has: page.getByRole('link') })
  await expect(lignes.first()).toBeVisible()
  const avant = await lignes.count()
  expect(await tableau.locator('tbody tr').first().locator('td').nth(1).evaluate((td) => getComputedStyle(td).position)).toBe('sticky')

  // Tri sur une colonne qui ne se triait pas : Coach, de A à Z puis de Z à A
  await tableau.getByRole('button', { name: 'Trier par Coach' }).click()
  await expect(tableau.getByRole('columnheader', { name: /^Trier par Coach/ })).toHaveAttribute('aria-sort', 'ascending')
  await tableau.getByRole('button', { name: 'Trier par Coach' }).click()
  await expect(tableau.getByRole('columnheader', { name: /^Trier par Coach/ })).toHaveAttribute('aria-sort', 'descending')

  // Filtre en nombre : au plus −10 % face à l'an dernier
  await tableau.getByRole('button', { name: 'Filtrer évolution du CA' }).click()
  await page.getByRole('textbox', { name: 'Au plus' }).fill('-10')
  await page.keyboard.press('Escape')
  await expect(lignes.filter({ hasText: 'Lyon Test' })).toHaveCount(1)
  await expect.poll(() => lignes.count()).toBeLessThan(avant)
  await expect(tableau).toContainText(/\d+ sur \d+ magasins/)
  await page.screenshot({ path: `captures/${info.project.name}-tableaux-magasins-filtre.png` })

  // Filtre en liste, combiné : plus aucun magasin, puis tout réafficher
  await tableau.getByRole('button', { name: 'Filtrer nine box' }).click()
  await page.getByRole('menuitem', { name: /^Non classé/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Aucun magasin ne correspond à ces filtres.')).toBeVisible()
  await page.getByRole('button', { name: 'Effacer les filtres' }).click()
  await expect.poll(() => lignes.count()).toBe(avant)
  expect(await textesTropPetits(page)).toEqual([])
})

test('Visites, Demandes, Charge : même tableau, colonnes triables et filtrables', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Tableaux du PC')
  await seConnecter(page)
  await page.goto('./#/visites')
  await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Tableau' }).last().click()
  const rythme = page.getByRole('table', { name: 'Rythme de visite par magasin' })
  await expect(rythme).toBeVisible()
  expect(await positionPremiere(page, 'Rythme de visite par magasin')).toBe('sticky')
  await rythme.getByRole('button', { name: 'Trier par Magasin' }).click()
  const noms = await rythme.locator('tbody tr td:first-child').allInnerTexts()
  expect(noms).toEqual([...noms].sort((a, b) => a.localeCompare(b, 'fr')))
  await rythme.getByRole('button', { name: 'Filtrer Coach' }).click()
  await expect(page.getByRole('menuitem').first()).toBeVisible()
  await page.keyboard.press('Escape')
  expect(await textesTropPetits(page)).toEqual([])
})

// Clôture du mois (Performance) : le réseau des budgets, avec un magasin fictif
const M = 'Annecy Test'
const magasins: MagasinSimule[] = [{ magasin: M, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }]
const reel: VenteSimulee[] = []
for (const a of [2025, 2026]) for (let m = 1; m <= (a === 2026 ? 9 : 12); m++) {
  reel.push({ store_name: M, mois: `${a}-${String(m).padStart(2, '0')}-01`, univers: 'cave', famille: 'Vin', ca_ht: 30_000 + m * 1_000, ca_ttc: 36_000 + m * 1_200, marge_ht: 11_000 + m * 300 })
}

test('Clôture du mois : trier et filtrer étape par étape, sur PC et téléphone', async ({ page, isMobile }, info) => {
  await simulerSupabase(page, {})
  await simulerPilotage(page, { magasins, reel })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  await page.goto('./#/performance?vue=clotures')
  const tableau = page.getByRole('table', { name: 'Clôtures de septembre 2026' })
  await expect(tableau.getByRole('row').filter({ hasText: M })).toBeVisible()
  // Case à cocher et Magasin figées ensemble
  expect(await tableau.locator('tbody tr').first().locator('td').nth(1).evaluate((td) => getComputedStyle(td).position)).toBe('sticky')
  await tableau.getByRole('button', { name: 'Trier par Magasin' }).click()
  await expect(tableau.getByRole('columnheader', { name: /^Trier par Magasin/ })).toHaveAttribute('aria-sort', 'ascending')
  const colonne = isMobile ? 'Fait' : 'Stock de fin de mois'
  await tableau.getByRole('button', { name: `Filtrer ${colonne}` }).click()
  const options = page.getByRole('menuitem')
  await expect(options.first()).toBeVisible()
  // La valeur du magasin (compte non nul) : il reste affiché, l'entonnoir reste allumé
  await options.filter({ hasText: /[1-9]$/ }).first().click()
  await page.keyboard.press('Escape')
  await expect(tableau.getByRole('row').filter({ hasText: M })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect((await zonesTropPetites(page)).join(' | ')).toBe('')
  await page.screenshot({ path: `captures/${info.project.name}-tableaux-clotures.png`, fullPage: !isMobile })
})

test('les tableaux financiers gardent l’ordre de leurs lignes : pas de tri ni de filtre', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Tableau du PC')
  await connecterPilotage(page)
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Résultat et trésorerie')
  const compte = page.getByRole('table', { name: /^Budget \d+ mois par mois$/ })
  await expect(compte).toBeVisible()
  await expect(compte.getByRole('button', { name: /^Trier par|^Filtrer/ })).toHaveCount(0)
})
