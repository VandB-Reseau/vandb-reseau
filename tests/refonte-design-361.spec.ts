import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Refonte design 361-368 (Joseph, 23/11/2026, « tableaux type SaaS » et tableau de bord) : cartes chiffrées avec
// évolution fléchée, anneau et barres en tête des Chiffres et de la fiche magasin, vues en bac à compteur, statuts en
// badges, colonne Statut, sous-ligne Coach · RR et menu « ⋯ » dans le tableau des magasins.

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('364 : tableau de bord en tête des Chiffres', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/performance')
  const tdb = page.getByRole('region', { name: 'Tableau de bord du réseau' })
  const cartes = tdb.getByRole('group', { name: 'Indicateurs du réseau' })
  await expect(cartes.getByText('CA de septembre 2026')).toBeVisible()
  for (const t of ['Marge moyenne', 'Panier moyen Cave', 'Magasins dans la norme']) await expect(cartes.getByText(t)).toBeVisible()
  // CA à magasins comparables face à l'an dernier, évolution fléchée
  await expect(cartes).toContainText('243 k€')
  await expect(cartes).toContainText('−13,2 %')
  await expect(tdb.getByRole('img', { name: 'Répartition du CA de septembre 2026 par univers' })).toBeVisible()
  await expect(tdb.getByRole('region', { name: 'CA par univers' })).toContainText('Cave')
  await expect(tdb.getByRole('img', { name: /^Chiffre d'affaires des 6 derniers mois/ })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
})

test('365 : la fiche magasin reprend le même tableau de bord', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  const va = page.getByRole('region', { name: 'Comment va le magasin' })
  const cartes = va.getByRole('group', { name: 'Indicateurs du magasin' })
  await expect(cartes.getByText(/^CA 2026 à fin sept/)).toBeVisible()
  await expect(cartes.getByText('Marge moyenne')).toBeVisible()
  await expect(va.getByRole('img', { name: 'Répartition du CA de septembre 2026 par univers' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
})

test('361, 362, 367 : vues à compteur, colonne Statut, sous-ligne et menu « ⋯ » des magasins', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins?vue=liste')
  const vues = page.getByRole('group', { name: 'Vues enregistrées' })
  await expect(vues.getByRole('button', { name: /^Tous : \d+$/ })).toHaveAttribute('aria-pressed', 'true')
  if (isMobile) { expect(await textesTropPetits(page)).toEqual([]); return }
  const tableau = page.getByRole('table', { name: 'Tableau des magasins' })
  const lyon = tableau.getByRole('row').filter({ has: page.getByRole('link', { name: 'Lyon Test', exact: true }) })
  await expect(lyon).toContainText('Noé MODELE · Sam SUD')
  await expect(lyon.getByText('Décroche', { exact: true })).toBeVisible()
  await expect(lyon.getByRole('img', { name: 'CA de Lyon Test sur 6 mois' })).toBeVisible()
  await lyon.getByRole('button', { name: 'Actions pour Lyon Test' }).click()
  await expect(page.getByRole('menuitem', { name: 'Planifier une visite' })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Ouvrir la fiche' }).click()
  await expect(page.getByRole('heading', { name: 'Lyon Test', level: 1 })).toBeVisible()
})

test('366 : sections de l’accueil avec leur compteur en pastille', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Accueil du PC')
  await seConnecter(page)
  const taches = page.getByRole('region', { name: 'Tâches' })
  await expect(taches.getByRole('link', { name: 'Ouvrir' })).toBeVisible()
  await expect(taches.getByRole('heading', { name: 'Tâches' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
})
