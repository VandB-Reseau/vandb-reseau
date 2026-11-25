import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// 413 à 420 (Joseph, 24/11/2026) : la fiche d'un Coach ou d'un RR dans le style des écrans à graphes
test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('413-416 : Vue d’ensemble du Coach en phrase, cartes, 4 tons et jauge de rythme', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/equipe/coach/No%C3%A9%20MODELE')
  await expect(page.locator('[data-lecture]')).toContainText(/^\d+ magasins? : .*\.$/)
  const portefeuille = page.getByRole('region', { name: 'Portefeuille' })
  for (const l of ['En Décroche', 'Évolution du CA', 'Note d’audit moyenne', 'Nine box à surveiller']) await expect(portefeuille.getByRole('group', { name: l })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Santé des magasins' }).getByRole('img', { name: /Répartition des magasins : Prioritaires \d+, À suivre \d+, Solides \d+, Non classés \d+/ })).toBeVisible()
  const rythme = page.getByRole('region', { name: /^Rythme de visite 2026/ })
  await expect(rythme.getByRole('meter', { name: 'Rythme de visite de l’année' })).toBeVisible()
  await expect(rythme.locator('[data-attendu]')).toHaveCount(1)
  await expect(rythme).toContainText(/À date : \d+ attendue/)
  expect(await textesTropPetits(page)).toEqual([])
})

test('417 : magasins du Coach en tableau de couleurs avec médiane (PC), liste sur téléphone', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/equipe/coach/No%C3%A9%20MODELE?vue=magasins')
  const liste = page.getByRole('region', { name: 'Liste des magasins' })
  await expect(liste.getByRole('link', { name: /^Lyon Test/ })).toBeVisible()
  if (isMobile) {
    await expect(page.getByRole('table', { name: 'Tableau des magasins du portefeuille' })).toHaveCount(0)
    return
  }
  const tableau = page.getByRole('table', { name: 'Tableau des magasins du portefeuille' })
  await expect(tableau.locator('[data-mediane]')).toContainText('Médiane de ses magasins')
  await expect(tableau.getByRole('columnheader', { name: /Face à la médiane/ })).toBeVisible()
  const couleurs = page.getByRole('button', { name: 'Couleurs du tableau' })
  await expect(couleurs).toHaveAttribute('aria-pressed', 'true')
  const fonds = async () => tableau.locator('tbody td').evaluateAll((tds) => tds.filter((td) => getComputedStyle(td).backgroundColor.startsWith('rgba(48, 118, 114') || getComputedStyle(td).backgroundColor.startsWith('rgba(194, 65, 25')).length)
  expect(await fonds()).toBeGreaterThan(0)
  await couleurs.click()
  expect(await fonds()).toBe(0)
  expect(await textesTropPetits(page)).toEqual([])
})

test('419-420 : activité du Coach en cartes, graphe des visites qui filtre, pas vus avec barre de retard', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/equipe/coach/No%C3%A9%20MODELE?vue=activite')
  const cartes = page.getByRole('group', { name: 'Tâches en chiffres' })
  for (const l of ['À faire', 'En retard', 'Faites ce mois', 'Avancement 2026']) await expect(cartes.getByRole('group', { name: l })).toBeVisible()
  const graphe = page.getByRole('region', { name: /Visites des (12|6) derniers mois/ })
  await expect(graphe).toBeVisible()
  const mois = graphe.getByRole('button', { name: /octobre 2026 : \d+ visites/ })
  await mois.click()
  await expect(mois).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/^\d+ visites? en octobre 2026$/)).toBeVisible()
  await page.getByRole('button', { name: 'Tous les mois' }).last().click()
  await expect(page.getByText(/^\d+ visites? en octobre 2026$/)).toHaveCount(0)
  await expect(mois).toHaveAttribute('aria-pressed', 'false')
  if (isMobile) expect((await mois.boundingBox())!.width).toBeGreaterThanOrEqual(40)
  const pasVus = page.getByRole('list', { name: 'Magasins pas vus dans le délai' })
  if (await pasVus.count()) await expect(pasVus.getByRole('img').first()).toHaveAttribute('aria-label', /Jamais visité|jours au-delà du délai/)
  expect(await textesTropPetits(page)).toEqual([])
})

test('418 : Coachs du RR avec jauges de charge et de rythme ; revue du mois colorée avec jauges', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/equipe/rr/rr2?vue=magasins')
  const coachs = page.getByRole('list', { name: 'Coachs rattachés' })
  await expect(coachs.getByRole('link', { name: 'Noé MODELE' })).toBeVisible()
  await expect(coachs.getByRole('meter', { name: 'Charge de Noé MODELE' })).toBeVisible()
  await expect(coachs.getByRole('meter', { name: 'Visites de Noé MODELE' })).toBeVisible()
  if (!isMobile) await expect(page.getByRole('table', { name: 'Tableau des magasins du portefeuille' }).getByRole('columnheader', { name: /Coach/ })).toBeVisible()
  await page.goto('./#/equipe/rr/rr2?vue=revue&mois=2026-09')
  await expect(page.getByRole('region', { name: 'Visites par Coach' }).getByRole('meter', { name: /Visites du mois de Noé MODELE/ })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
})
