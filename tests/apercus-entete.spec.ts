import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type MessageSimule } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const DIRECTEUR = 'Dominique DIRECTION'
const AUTRE = '00000000-0000-0000-0000-0000000000aa'
const ilYa = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const prive = (id: number, cle: string, nom: string, texte: string, minutes: number): MessageSimule =>
  ({ id, store: null, auteur: AUTRE, auteur_nom: nom, auteur_role: cle.split(':')[0], auteur_cle: cle, destinataire: 'directeur', texte, mentions: ['directeur'], cree_le: ilYa(minutes), magasins: [] })

test('icône Tâches : aperçu des tâches à faire, la plus urgente d’abord, puis toute la liste', async ({ page }, info) => {
  const actions = { 'Brest Test': [
    { id: 'l1', action: 'Préparer la soirée dégustation', porteur: DIRECTEUR, echeance: '2099-02-01', creeLe: '2026-09-25' },
    { id: 'l2', action: 'Commander la nouvelle PLV', porteur: DIRECTEUR, echeance: '2026-10-01', creeLe: '2026-09-25' },
    { id: 'l3', action: 'Relancer le fournisseur', porteur: 'Noé MODELE', echeance: '', creeLe: '2026-09-25' },
    { id: 'l4', action: 'Déjà faite', porteur: DIRECTEUR, echeance: '', creeLe: '2026-09-20', faite: '2026-09-21' },
  ] }
  await seConnecter(page, { config: { actions } })
  await page.getByRole('button', { name: 'Tâches : 2 à faire' }).click()
  const menu = page.getByRole('menu', { name: /^Tâches à faire/ })
  await expect(menu).toContainText('Tâches à faire · 2')
  // Seulement les siennes, à faire, la plus en retard en tête
  await expect(menu.getByRole('button').filter({ hasNotText: 'Toutes les tâches' })).toHaveText([/Commander la nouvelle PLV.*Brest Test.*En retard/, /Préparer la soirée dégustation.*Pour le/])
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-apercu-taches.png` })
  await menu.getByRole('button', { name: /Commander la nouvelle PLV/ }).click()
  await expect(page).toHaveURL(/#\/taches$/)
  await expect(menu).toBeHidden()

  await page.goto('./#/')
  await page.getByRole('button', { name: 'Tâches : 2 à faire' }).click()
  await page.getByRole('button', { name: 'Toutes les tâches' }).click()
  await expect(page).toHaveURL(/#\/taches$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes tâches')
})

test('icône Tâches sans tâche : un aperçu vide, le lien vers la liste reste', async ({ page }) => {
  await seConnecter(page, { config: { actions: {} } })
  await page.getByRole('button', { name: 'Tâches', exact: true }).click()
  const menu = page.getByRole('menu', { name: 'Tâches à faire' })
  await expect(menu).toContainText('Aucune tâche à faire.')
  await menu.getByRole('button', { name: 'Toutes les tâches' }).click()
  await expect(page).toHaveURL(/#\/taches$/)
})

test('icône Messages : aperçu des dernières conversations, puis tous les messages', async ({ page }, info) => {
  await seConnecter(page, { messagerie: { messages: [
    prive(1, 'coach:Camille TESTARD', 'Camille TESTARD', 'Merci pour la visite.', 60 * 24),
    prive(2, 'franchise:Paul MULTI', 'Paul MULTI', 'Le devis est arrivé.', 20),
  ], lus: { 'personne:coach:Camille TESTARD|messages': ilYa(10) } } })
  await page.getByRole('button', { name: 'Messages : 1 non lu' }).click()
  const menu = page.getByRole('menu', { name: 'Messages' })
  // La plus récente d'abord ; seulement les conversations commencées
  await expect(menu.getByRole('button').filter({ hasNotText: 'Tous les messages' })).toHaveText([/Paul MULTI.*Le devis est arrivé\./, /Camille TESTARD.*Merci pour la visite\./])
  await expect(menu.getByRole('button', { name: 'Paul MULTI : 1 message non lu' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (info.project.name === 'telephone') for (const b of await menu.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await page.screenshot({ path: `captures/${info.project.name}-apercu-messages.png` })
  await menu.getByRole('button', { name: /^Paul MULTI/ }).click()
  await expect(page).toHaveURL(/#\/messages\/personne\/franchise%3APaul%20MULTI$/)
  await expect(page.getByRole('list', { name: 'Messages de Paul MULTI' })).toContainText('Le devis est arrivé.')

  await page.locator('button[aria-label^="Messages"]').click()
  await page.getByRole('button', { name: 'Tous les messages' }).click()
  await expect(page).toHaveURL(/#\/messages/)
  await expect(page.getByRole('list', { name: 'Conversations' })).toBeVisible()
})

test('icône Messages sans conversation : un aperçu vide', async ({ page }) => {
  await seConnecter(page, { messagerie: { messages: [] } })
  await page.locator('button[aria-label^="Messages"]').click()
  await expect(page.getByRole('menu', { name: 'Messages' })).toContainText('Aucune conversation pour le moment.')
})
