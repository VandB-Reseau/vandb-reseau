import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type CommunicationSimulee } from './supabase-simule'

// Sprint 22, A5 : engagement du franchisé sur 90 jours, montré à l'équipe seule (Équipe > Franchisés et sa fiche)

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const jour = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const communications = (): CommunicationSimulee[] => [1, 2].map((id) => ({
  id, titre: `Annonce ${id}`, texte: 'Texte.', magasins: null, auteur: 'autre', auteur_nom: 'Dominique DIRECTION', auteur_role: 'directeur',
  cree_le: `${jour(-5)}T09:00:00Z`, lus: ['Franchisé 4'], non_lus: ['Franchisé 2'],
}))
const actions = {
  'Nantes Test': [{ id: 'l1', action: 'Refaire la vitrine', porteur: 'Franchisé 2', echeance: jour(-10), creeLe: jour(-30) }],
  'Bordeaux Test': [{ id: 'l2', action: 'Commander les coffrets', porteur: 'Franchisé 4', echeance: jour(-10), creeLe: jour(-30), faite: jour(-12) }],
}
const messagerie = { messages: [{ id: 1, store: 'Bordeaux Test', auteur: 'f4', auteur_nom: 'Franchisé 4', auteur_role: 'franchise', auteur_cle: 'franchise:Franchisé 4', texte: 'Bien reçu', mentions: [], cree_le: `${jour(-1)}T10:00:00Z` }] }

test('le Directeur voit les repères de chaque franchisé et filtre les peu engagés', async ({ page, isMobile }, info) => {
  await seConnecter(page, { communications: communications(), config: { actions }, messagerie })
  await page.goto('./#/equipe?vue=franchises')
  const liste = page.getByRole('region', { name: 'Franchisés' })
  const f2 = liste.getByRole('link', { name: 'Franchisé 2', exact: true })
  await expect(f2).toContainText('Lu 0 sur 2 · Tâches tenues 0 sur 1 · Aucun message')
  await expect(liste.getByRole('link', { name: 'Franchisé 4', exact: true })).toContainText('Lu 2 sur 2 · Tâches tenues 1 sur 1 · Écrit hier')
  if (isMobile && await page.getByRole('button', { name: 'Filtres' }).isVisible()) await page.getByRole('button', { name: 'Filtres' }).click()
  const filtre = page.getByRole('button', { name: /^Peu engagés \(\d+\)$/ })
  expect((await filtre.boundingBox())!.height).toBeGreaterThanOrEqual(isMobile ? 48 : 36)
  await filtre.click()
  await expect(page).toHaveURL(/engagement=faible/)
  await expect(f2).toBeVisible()
  await expect(liste.getByRole('link', { name: 'Franchisé 4', exact: true })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-franchises-peu-engages.png`, fullPage: !isMobile })

  await f2.click()
  const section = page.getByRole('heading', { name: 'Engagement · 90 jours' }).locator('xpath=ancestor::div[contains(@class,"MuiCard-root")]')
  await expect(section).toContainText('Communications lues0 sur 2 · en retrait')
  await expect(section).toContainText('Tâches tenues dans les délais0 sur 1 · en retrait')
  await expect(section).toContainText('Dernier message écritAucun message · en retrait')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-franchise-engagement.png`, fullPage: !isMobile })
})

test('le Coach voit tâches et messages, sans les lectures des communications', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' }, communications: communications(), config: { actions }, messagerie })
  await page.goto('./#/equipe/franchise/Franchis%C3%A9%207')
  await expect(page.getByRole('heading', { name: 'Engagement · 90 jours' })).toBeVisible()
  await expect(page.getByText('Communications lues')).toHaveCount(0)
  await expect(page.getByText('Aucune tâche arrivée à échéance')).toBeVisible()
})

test('le franchisé ne voit jamais ses repères', async ({ page }) => {
  await seConnecter(page, { acces: { role: 'franchise', franchise: 'Franchisé 2', magasins: ['Nantes Test'] } })
  await page.goto('./#/')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expect(page.getByText(/Engagement · 90 jours|Peu engagés/)).toHaveCount(0)
})
