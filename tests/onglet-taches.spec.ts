import { expect, test, type Page } from '@playwright/test'
import { seConnecter } from './supabase-simule'

// Onglet Tâches séparé des Messages (Joseph, 22/10/2026) : son picto compte les tâches en retard
// et celles qu'on m'a confiées depuis ma dernière ouverture de l'onglet, chacune une fois

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const DIRECTEUR = 'Dominique DIRECTION'
const iso = (jours: number) => { const d = new Date(); d.setDate(d.getDate() + jours); return d.toISOString().slice(0, 10) }
const actions = { 'Brest Test': [
  { id: 'l1', action: 'Commander la nouvelle PLV', porteur: DIRECTEUR, echeance: iso(-3), creeLe: iso(-10), auteur: 'Noé MODELE' },
  { id: 'l2', action: 'Valider le planning', porteur: DIRECTEUR, echeance: iso(10), creeLe: iso(-1), auteur: 'Noé MODELE' },
  { id: 'l3', action: 'Préparer le séminaire', porteur: DIRECTEUR, echeance: iso(20), creeLe: iso(-1), auteur: DIRECTEUR },
  { id: 'l4', action: 'Relancer le fournisseur', porteur: 'Noé MODELE', echeance: iso(-5), creeLe: iso(-1), auteur: DIRECTEUR },
] }

// Appareil où l'onglet a déjà été ouvert, avant l'arrivée des tâches
async function dejaOuvert(page: Page) {
  await page.addInitScript(() => { if (!sessionStorage.getItem('pose')) { localStorage.setItem('vandb-taches-vues', '[]'); sessionStorage.setItem('pose', '1') } })
}
const picto = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: /^Tâches/ })

test('le picto compte la tâche en retard et la tâche confiée pas encore vue, puis seulement le retard', async ({ page }, info) => {
  await dejaOuvert(page)
  await seConnecter(page, { config: { actions } })
  // l1 en retard, l2 confiée par Noé ; l3 créée par moi, l4 portée par un autre : pas comptées
  await expect(picto(page)).toHaveAccessibleName('Tâches : 2 en retard ou nouvelles')
  await expect(picto(page)).toContainText('2')
  await page.screenshot({ path: `captures/${info.project.name}-onglet-taches-compteur.png` })
  await picto(page).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tâches')
  await expect(page.getByRole('list', { name: 'Tâches à faire' }).getByRole('listitem')).toHaveCount(3)
  // Vue : seule la tâche en retard reste comptée
  await expect(picto(page)).toHaveAccessibleName('Tâches : 1 en retard ou nouvelle')
  await page.reload()
  await expect(picto(page)).toHaveAccessibleName('Tâches : 1 en retard ou nouvelle')
})

test('première ouverture sur un appareil : seules les tâches en retard sont comptées', async ({ page }) => {
  await seConnecter(page, { config: { actions } })
  await expect(picto(page)).toHaveAccessibleName('Tâches : 1 en retard ou nouvelle')
})

test('ouvrir la liste d’un autre porteur ne marque pas mes tâches comme vues', async ({ page }) => {
  await dejaOuvert(page)
  await seConnecter(page, { config: { actions } })
  await page.goto('./#/taches?de=No%C3%A9%20MODELE')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tâches de Noé MODELE')
  await expect(picto(page)).toHaveAccessibleName('Tâches : 2 en retard ou nouvelles')
})

test('téléphone : Magasins quitte la barre du bas et reste dans le menu du compte', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Barre du bas du téléphone')
  await seConnecter(page)
  const barre = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(barre.getByRole('button')).toHaveText(['Accueil', 'Visites', /Messages$/, /Tâches$/, 'Santé'])
  await page.getByRole('button', { name: 'Mon compte' }).click()
  await page.getByRole('menu').getByRole('menuitem', { name: 'Magasins', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Magasins' })).toBeVisible()
})
