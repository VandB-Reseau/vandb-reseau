import { expect, test } from '@playwright/test'
import { MAGASINS } from '../donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type TicketsSimules, type VenteSimulee } from './outils'

// Écrans à graphes rendus visuels comme Pilotage (Joseph, 24/11/2026, choix 393 à 405). Données fictives uniquement.
// Budget du magasin fictif : 48 000 € de CA en janvier et en février (tests/pilotage/donnees-fictives.ts).

const N = new Date().getFullYear()
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const vente = (magasin: string, a: number, m: number, univers: string, famille: string, ca: number, marge: number | null): VenteSimulee =>
  ({ store_name: magasin, mois: mois(a, m), univers, famille, ca_ht: ca, ca_ttc: ca * 1.2, marge_ht: marge })
const reel: VenteSimulee[] = [
  vente(MAGASINS[0], N, 1, 'cave', 'Bière', 30_000, 11_000), vente(MAGASINS[0], N, 1, 'bar', 'Fût', 20_000, 15_000),
  vente(MAGASINS[0], N, 2, 'cave', 'Bière', 20_000, 7_000), vente(MAGASINS[0], N, 2, 'bar', 'Fût', 24_000, 16_000),
  vente(MAGASINS[0], N - 1, 1, 'cave', 'Bière', 40_000, null), vente(MAGASINS[0], N - 1, 2, 'cave', 'Bière', 40_000, null),
  vente(MAGASINS[1], N, 1, 'cave', 'Vin', 30_000, 15_000),
  vente(MAGASINS[2], N, 1, 'cave', 'Vin', 26_000, 12_000),
]
const tickets: TicketsSimules[] = [{ store_name: MAGASINS[0], mois: mois(N, 1), univers: 'cave', tickets: 2_000 }]
const coachs = { [MAGASINS[0]]: 'Coach Nord', [MAGASINS[1]]: 'Coach Sud', [MAGASINS[2]]: 'Coach Sud' }
const rrs = { [MAGASINS[0]]: ['RR Est'], [MAGASINS[1]]: ['RR Ouest'], [MAGASINS[2]]: ['RR Ouest'] }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('Face au budget : phrase, couleurs, écarts de marge, par RR puis par Coach, carte et présentation', async ({ page, isMobile }) => {
  await seConnecter(page, { reel, tickets, coachs, rrs })
  await page.goto('./#/performance?vue=budget')
  const tableau = page.getByRole('table', { name: `Réel ${N} par magasin` })
  await expect(tableau).toBeVisible()
  // 394 : CA à date face au budget, combien sont au niveau, en tête et en retrait
  await expect(page.locator('[data-lecture]')).toHaveText(/^CA HT à fin février : [-−][\d,]+\s%\ssur le budget\. 0 magasin sur 2 est au niveau ou mieux.*En tête : .* ; le plus en retrait : .*\.$/)
  // 393 : cellules colorées, interrupteur « Couleurs »
  await expect(tableau.locator('td[data-fond]').first()).toBeVisible()
  await page.getByRole('button', { name: 'Couleurs du tableau' }).click()
  await expect(tableau.locator('td[data-fond]')).toHaveCount(0)
  expect(page.url()).toContain('couleurs=non')
  await page.getByRole('button', { name: 'Couleurs du tableau' }).click()
  // 397 : vue « Face au budget », marge, EBE et % FP en points
  await page.getByRole('group', { name: 'Vue du classement' }).getByRole('button', { name: 'Face au budget' }).click()
  await expect(tableau.getByRole('columnheader', { name: /Marge face au budget/ })).toBeVisible()
  await expect(tableau.getByRole('row').filter({ hasText: MAGASINS[0] })).toContainText(/[-−+][\d,]+\spt/)
  // 398 : par Responsable Régional, un clic descend aux Coachs, puis aux magasins ; « Revenir » remonte
  const regrouper = page.getByRole('group', { name: 'Regrouper' })
  await regrouper.getByRole('button', { name: 'Par RR' }).click()
  await expect(tableau.locator('tr[data-groupe]')).toHaveCount(2)
  await tableau.getByRole('button', { name: 'RR Ouest' }).click()
  await expect(regrouper.getByRole('button', { name: 'Par Coach' })).toHaveAttribute('aria-pressed', 'true')
  await expect(tableau.locator('tr[data-groupe]')).toHaveCount(1)
  await tableau.getByRole('button', { name: 'Coach Sud' }).click()
  await expect(tableau.getByRole('link', { name: MAGASINS[1] })).toBeVisible()
  await expect(tableau.getByRole('link', { name: MAGASINS[0] })).toHaveCount(0)
  await page.getByRole('button', { name: 'Revenir aux Coachs' }).click()
  await page.getByRole('button', { name: 'Revenir aux Responsables Régionaux' }).click()
  await expect(tableau.locator('tr[data-groupe]')).toHaveCount(2)
  await regrouper.getByRole('button', { name: 'Magasins' }).click()
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  expect(await textesTropPetits(page)).toEqual([])
  // 399 : affichage Carte, un rond par magasin
  await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Carte' }).click()
  await expect(page.getByRole('list', { name: 'Magasins sur la carte' }).getByRole('listitem')).toHaveCount(3)
  await expect(page.getByRole('list', { name: 'Magasins sur la carte' })).toContainText(`${MAGASINS[0]} : `)
  // 400 : présentation plein écran, la phrase en grand
  await page.getByRole('button', { name: 'Présenter' }).click()
  const presentation = page.getByRole('dialog', { name: 'Face au budget' })
  await expect(presentation).toContainText('CA HT à fin février')
  await presentation.getByRole('button', { name: 'Quitter la présentation' }).click()
  await expect(presentation).toBeHidden()
})

test('Chiffres des magasins : phrase, place face à la médiane, carte et présentation', async ({ page, isMobile }) => {
  await seConnecter(page, { reel, tickets, coachs })
  await page.goto('./#/performance?vue=magasins')
  await expect(page.locator('[data-lecture]')).toContainText(/magasins? sur \d+/)
  if (!isMobile) {
    await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Tableau' }).click()
    const tableau = page.getByRole('table', { name: 'Chiffres des magasins' })
    await expect(tableau.getByRole('columnheader', { name: /Face à la médiane/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Couleurs du tableau' })).toBeVisible()
  }
  await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Carte' }).click()
  await expect(page.getByRole('list', { name: 'Magasins sur la carte' }).getByRole('listitem').first()).toBeVisible()
  await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Lignes' }).click()
  await page.getByRole('button', { name: 'Présenter' }).click()
  await expect(page.getByRole('dialog', { name: 'Chiffres des magasins' })).toBeVisible()
  await page.getByRole('button', { name: 'Quitter la présentation' }).click()
  // Le champ de recherche (déjà là avant) a sa zone de 48 px sur son cadre, pas sur le texte saisi
  if (isMobile) expect((await zonesTropPetites(page)).filter((z) => !z.startsWith('Rechercher un magasin'))).toEqual([])
})

test('Évolution du parc : phrase de l’année et présentation', async ({ page }) => {
  await seConnecter(page, { reel })
  await page.goto('./#/evolution')
  await expect(page.locator('[data-lecture]')).toContainText(/magasins en fin d’année/)
  await page.getByRole('button', { name: 'Présenter' }).click()
  await expect(page.getByRole('dialog', { name: 'Évolution du parc' })).toContainText('Ouvertures')
  await page.getByRole('button', { name: 'Quitter la présentation' }).click()
})

test('Fiche magasin : médiane sur les courbes, clic sur un mois, Mois par mois en couleurs, place face au réseau', async ({ page, isMobile }) => {
  await seConnecter(page, { reel, tickets, coachs })
  await page.goto(`./#/magasins/${encodeURIComponent(MAGASINS[0])}?vue=chiffres&partie=synthese`)
  // 396 : médiane du réseau en trait jaune sur la courbe de la marge (équipe)
  const sante = page.getByRole('region', { name: /^Santé du magasin à fin/ })
  await expect(sante.getByText(/^Médiane du réseau : /).first()).toBeVisible()
  await expect(sante.locator('line[data-repere]').first()).toBeAttached()
  // 405 : un clic sur un mois du graphe « Évolution du CA » ouvre Mois par mois
  await page.getByRole('button', { name: /^Voir Févr\. dans Mois par mois$/ }).click()
  const tableau = page.getByRole('table', { name: `Réel face au budget ${N} mois par mois` })
  await expect(tableau).toBeVisible()
  // 401 : cases colorées selon l'écart au budget, interrupteur
  await expect(tableau.locator('td[data-fond]').first()).toBeVisible()
  await page.getByRole('button', { name: 'Couleurs du tableau' }).click()
  await expect(tableau.locator('td[data-fond]')).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('Fiche magasin : le franchisé ne voit pas la médiane du réseau', async ({ page }) => {
  await seConnecter(page, { role: 'franchise', reel, tickets })
  await page.goto(`./#/magasins/${encodeURIComponent(MAGASINS[0])}?vue=chiffres&partie=synthese`)
  await expect(page.getByRole('region', { name: /^Santé du magasin à fin/ })).toBeVisible()
  await page.waitForTimeout(500)
  await expect(page.getByText(/^Médiane du réseau/)).toHaveCount(0)
  await expect(page.locator('line[data-repere]')).toHaveCount(0)
})
