import { expect, test } from '@playwright/test'
import { seConnecter } from './supabase-simule'

// Écrans encore peu visuels (Joseph, 24/11/2026, choix 406 à 412) : Tâches, Visites, Santé du parc, Agenda.
// Données fictives uniquement. Simulateurs et Paramètres du budget : tests/pilotage/visuel-406.spec.ts

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('406 Tâches : quatre cartes chiffrées en tête de liste', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/taches')
  const cartes = page.getByRole('group', { name: 'Tâches en chiffres' })
  await expect(cartes).toBeVisible()
  for (const nom of ['À faire', 'En retard', 'Bloquées', 'Faites sur 30 jours']) await expect(cartes.getByRole('group', { name: nom, exact: true })).toBeVisible()
})

test('406 Tâches : par magasin, une barre d’avancement par groupe', async ({ page, isMobile }) => {
  test.skip(isMobile, 'regroupement réservé au PC')
  await seConnecter(page)
  await page.goto('./#/taches')
  await page.getByRole('button', { name: 'Par magasin' }).click()
  await expect(page.getByTestId('avancement-groupe').first()).toBeVisible()
  await expect(page.getByTestId('avancement-groupe').first()).toHaveAttribute('aria-label', /^\d+ faites? sur \d+$/)
})

test('407 Visites : graphe des derniers mois, un clic limite la liste au mois', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/visites?vue=historique')
  const graphe = page.getByRole('region', { name: isMobile ? 'Visites des 6 derniers mois' : 'Visites des 12 derniers mois' })
  await expect(graphe).toBeVisible()
  const colonnes = graphe.getByRole('button', { name: /visites$/ })
  await expect(colonnes).toHaveCount(isMobile ? 6 : 12)
  // Le mois en cours (octobre 2026, date figée) : un clic filtre, un second relâche
  const mois = colonnes.last()
  await mois.click()
  await expect(mois).toHaveAttribute('aria-pressed', 'true')
  await expect(graphe).toContainText('Liste limitée à')
  await graphe.getByRole('button', { name: 'Tous les mois' }).click()
  await expect(mois).toHaveAttribute('aria-pressed', 'false')
  if (isMobile) {
    const r = (await mois.boundingBox())!
    expect(r.width).toBeGreaterThanOrEqual(44)
    expect(r.height).toBeGreaterThanOrEqual(48)
  }
})

test('408 Santé du parc : répartition en 4 tons et évolution sur 6 mois', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/plus/sante')
  const repartition = page.getByRole('region', { name: 'Répartition du parc' })
  await expect(repartition).toBeVisible()
  await expect(repartition.getByRole('img')).toHaveAttribute('aria-label', /Prioritaires \d+, À suivre \d+, Solides \d+, Non classés \d+/)
  await expect(repartition).toContainText(/En 6 mois : /)
  await expect(page.getByRole('region', { name: 'Évolution sur 6 mois' }).getByRole('img')).toBeVisible()
})

test('411 Agenda : la charge du jour en pastille', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/plus/agenda?vue=mois')
  if (isMobile) {
    await expect(page.getByRole('group', { name: 'Jours du mois' })).toBeVisible()
    return
  }
  await expect(page.getByRole('grid', { name: 'Calendrier du mois' })).toBeVisible()
  const pastille = page.getByRole('grid', { name: 'Calendrier du mois' }).locator('[data-charge]').first()
  await expect(pastille).toHaveAttribute('aria-label', /^\d+ rendez-vous/)
})
