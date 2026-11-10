import { expect, test, type Page } from '@playwright/test'
import { COMPTE, ouvrirOnglet, simulerSupabase, textesTropPetits } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type TicketsSimules, type VenteSimulee } from './supabase-simule'

// Budget sur ordinateur (Joseph, 09/11/2026) : le Suivi en puces, plus de liste du plan d'action (elle est dans les tâches
// du magasin), les commentaires dans un volet à la demande, les éléments collants sous les onglets de la fiche, les
// échéances des prêts dans le tableau, le compte de résultat en k€ d'office. Données fictives uniquement.

const M = 'Annecy Test'
const magasins: MagasinSimule[] = [{ magasin: M, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }]
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const reel: VenteSimulee[] = []
const tickets: TicketsSimules[] = []
for (const a of [2025, 2026]) for (let m = 1; m <= (a === 2026 ? 9 : 12); m++) {
  reel.push({ store_name: M, mois: mois(a, m), univers: 'cave', famille: 'Vin', ca_ht: 30_000 + m * 1_000, ca_ttc: 36_000 + m * 1_200, marge_ht: 11_000 + m * 300 })
  reel.push({ store_name: M, mois: mois(a, m), univers: 'bar', famille: 'Fût', ca_ht: 15_000 + m * 500, ca_ttc: 18_000, marge_ht: 11_000 })
  tickets.push({ store_name: M, mois: mois(a, m), univers: 'cave', tickets: 1_500 + m * 10 }, { store_name: M, mois: mois(a, m), univers: 'bar', tickets: 1_000 })
}
// 60 000 € sur 7 ans à 4 %, 1re échéance en mars 2025 : dernière en février 2032
const prets = [{ id: 1, store_name: M, libelle: 'Prêt travaux', mode: 'initial' as const, montant: 60_000, taux: 0.04, duree: 7, debut: '2025-03', differe: 0, mensualite: null }]
const messages = [{ id: 1, store_name: M, annee: 2027, texte: 'Le loyer augmente de 4 % en avril.', auteur: 'x', auteur_role: 'franchise', auteur_nom: 'Hugo FICTIF', cree_le: '2026-11-08T09:00:00Z', ancre: 'theme/fraisBudget', ancre_libelle: 'Frais', parent: null }]

async function connecter(page: Page) {
  await simulerSupabase(page, {})
  await simulerPilotage(page, { magasins, reel, tickets, prets, messages })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
}
const partie = (p: string) => `./#/magasins/${encodeURIComponent(M)}?vue=budget&partie=${p}`

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le Suivi se lit en puces, une partie à la fois, sans liste du plan d’action', async ({ page, isMobile }, info) => {
  await connecter(page)
  await page.goto(`./#/magasins/${encodeURIComponent(M)}`)
  // Refonte (09/11/2026, 3A) : le suivi est dans l'onglet Chiffres, avec la santé et les saisies
  await ouvrirOnglet(page, 'Chiffres')
  const puces = page.getByRole('tablist', { name: 'Parties des chiffres' })
  await expect(puces.getByRole('tab')).toHaveText(['Vue d’ensemble', 'Mois par mois', 'Comptes et trésorerie', 'Atterrissage 2026', 'Analyse'])
  await expect(puces.getByRole('tab', { name: 'Vue d’ensemble' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'Santé du magasin à fin septembre' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Plan d’action' })).toHaveCount(0)
  await expect(page.getByText('Pour aller plus loin')).toHaveCount(0)
  // Ce qui manque tient sur un seul bandeau
  await expect(page.getByRole('alert').filter({ hasText: 'Équipe non renseignée' })).toContainText('Frais non renseignés')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-suivi-puces.png`, fullPage: true })

  await puces.getByRole('tab', { name: 'Mois par mois' }).click()
  await expect(page).toHaveURL(/partie=mois$/)
  await expect(page.getByRole('table', { name: 'Réel face au budget 2026 mois par mois' })).toBeVisible()
  await puces.getByRole('tab', { name: 'Comptes et trésorerie' }).click()
  await expect(page.getByRole('heading', { name: 'Comptes du quadrimestre' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Trésorerie', exact: true })).toBeVisible()
  await puces.getByRole('tab', { name: 'Analyse' }).click()
  await expect(page.getByRole('region', { name: 'Chiffre d’affaires 2026' })).toBeVisible()
  // Les anciennes adresses mènent à leur puce
  await page.goto(partie('tresorerie'))
  await expect(page).toHaveURL(/partie=comptes$/)
  await page.goto(partie('atterrissage'))
  await expect(puces.getByRole('tab', { name: 'Atterrissage 2026' })).toHaveAttribute('aria-selected', 'true')
})

test('les commentaires s’ouvrent dans un volet, à la demande, et le compte de résultat garde toute la largeur', async ({ page, isMobile }, info) => {
  await connecter(page)
  await page.goto(partie('visualiser'))
  const tableau = page.getByRole('table', { name: 'Budget 2027 mois par mois' })
  await expect(tableau).toBeVisible()
  await expect(page.getByRole('region', { name: 'Commentaires', exact: true })).toHaveCount(0)
  // En k€ d'office : les douze mois, le total et la part du CA se lisent sans défiler sur ordinateur
  await expect(tableau.getByRole('columnheader', { name: 'En k€' })).toBeVisible()
  if (!isMobile) {
    const total = await tableau.getByRole('columnheader', { name: '% du CA' }).boundingBox()
    expect(total!.x + total!.width).toBeLessThanOrEqual(1440)
  }
  const bouton = page.getByRole('button', { name: 'Commentaires (1 ouvert)' })
  await bouton.click()
  const volet = page.getByRole('complementary', { name: 'Volet des commentaires' })
  await expect(volet.getByRole('region', { name: 'Commentaires', exact: true })).toBeVisible()
  await expect(volet.getByText('Le loyer augmente de 4 % en avril.')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-commentaires-volet.png` })
  await volet.getByRole('button', { name: 'Fermer les commentaires' }).click()
  await expect(volet).toBeHidden()
  // La bulle d'un point ouvre le volet sur ce point, le champ prêt à écrire
  await page.getByRole('button', { name: `Commenter : Résultat et trésorerie 2027` }).click()
  await expect(volet.getByRole('textbox', { name: 'Commenter : Résultat et trésorerie 2027' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(volet).toBeHidden()
})

test('l’Impact et la bande de résultat restent sous les onglets de la fiche, jamais par-dessus', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'sur téléphone, l’Impact est en bas d’écran')
  await connecter(page)
  await page.goto(partie('budget'))
  const impact = page.getByRole('complementary', { name: 'Impact des changements' })
  await expect(impact).toBeVisible()
  // Refonte vague 2 (11A) : statut, étapes du budget, commentaires, export et impression sur une seule ligne
  const etapes = await page.getByRole('tablist', { name: 'Étapes du budget 2027' }).boundingBox()
  const exporter = await page.getByRole('button', { name: 'Exporter en Excel' }).boundingBox()
  expect(exporter!.y).toBeLessThan(etapes!.y + etapes!.height)
  expect(exporter!.y + exporter!.height).toBeGreaterThan(etapes!.y)
  await page.mouse.wheel(0, 900)
  await page.waitForTimeout(300)
  const bande = await page.locator('.onglets-fiche').boundingBox()
  const haut = await impact.boundingBox()
  expect(haut!.y).toBeGreaterThanOrEqual(bande!.y + bande!.height)
  await page.screenshot({ path: `captures/${info.project.name}-impact-sous-onglets.png` })
  await page.goto(partie('echanges'))
  await page.mouse.wheel(0, 900)
  await page.waitForTimeout(300)
  const resultat = await page.getByRole('region', { name: 'Indicateurs clés' }).boundingBox()
  const bande2 = await page.locator('.onglets-fiche').boundingBox()
  if (resultat!.y < 300) expect(resultat!.y).toBeGreaterThanOrEqual(bande2!.y + bande2!.height)
})

test('le tableau des prêts montre la 1re et la dernière échéance', async ({ page, isMobile }, info) => {
  await connecter(page)
  await page.goto(partie('investissements'))
  const table = page.getByRole('table', { name: 'Prêts du magasin en 2027' })
  await expect(table.getByRole('columnheader', { name: 'Échéances' })).toBeVisible()
  const ligne = table.getByRole('row', { name: /Prêt travaux/ })
  await expect(ligne).toContainText('1re : mars 2025')
  await expect(ligne).toContainText('Dernière : février 2032')
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.getByRole('region', { name: 'Prêts du magasin' }).screenshot({ path: `captures/${info.project.name}-prets-echeances.png` })
})
