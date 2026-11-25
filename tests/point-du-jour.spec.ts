import { expect, test } from '@playwright/test'
import { deplierPoint, seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'
import { zonesTropPetites } from './pilotage/supabase-simule'

// « Mon point du jour » et « Aujourd'hui » recentrés sur l'action terrain (choix 429 à 436, Joseph, 25/11/2026) : ma
// journée, comptes rendus, tâches, carnet, magasins à visiter ; plus de chiffre d'affaires sur l'Accueil.
// Données fictives uniquement (date des tests : 27/10/2026).

const notes = {
  'Lyon Test': [
    { id: 'na', date: '2026-10-24', quand: '2026-10-24T17:12:00.000Z', texte: 'Visite tendue : il remet en cause la redevance devant son équipe.', par: 'Noé MODELE', ton: 'alerte', themes: ['posture'] },
  ],
}
const FAMILLES = ['Comptes rendus', 'Tâches', 'Carnet', 'Magasins à visiter']

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('429, 435 : plus de chiffre d’affaires ni de période, quatre familles de cinq lignes au plus', async ({ page, isMobile }) => {
  await seConnecter(page)
  await deplierPoint(page)
  const traiter = page.getByRole('region', { name: 'À traiter' })
  await expect(traiter).toBeVisible()
  await expect(page.getByRole('region', { name: 'Pilotage' })).toHaveCount(0)
  const zone = isMobile ? page.getByRole('dialog', { name: 'Mon point du jour' }) : page.getByRole('complementary', { name: 'Aujourd’hui' })
  for (const t of ['Décrochent', 'Santé du parc', 'Visites de l’année', 'Contrats', 'Intégration']) await expect(zone.getByText(t, { exact: false })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cumul' })).toHaveCount(0)
  const sections = traiter.getByRole('region')
  const noms = await sections.evaluateAll((s) => s.map((x) => x.getAttribute('aria-label')))
  expect(noms.length).toBeGreaterThan(0)
  for (const n of noms) expect(FAMILLES).toContain(n)
  for (const n of noms) {
    const s = traiter.getByRole('region', { name: n! })
    const lignes = await s.locator(':scope > .MuiCard-root > *').count()
    expect(lignes).toBeLessThanOrEqual(6) // cinq lignes et « Voir les N »
  }
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('436 : le Directeur voit une ligne par Coach pour les magasins pas vus ; le Coach voit chaque magasin', async ({ page }) => {
  await seConnecter(page)
  await deplierPoint(page)
  const directeur = page.getByRole('region', { name: 'Magasins à visiter' })
  await expect(directeur).toBeVisible()
  await expect(directeur).toContainText(/\d+ magasins? pas vus?/)
  await expect(directeur).not.toContainText(/pas vu depuis \d+ j/)
})

test('430, 434 : le Coach a sa journée et ses magasins à visiter, un par un', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' } })
  await deplierPoint(page)
  await expect(page.getByRole('heading', { name: 'Ma journée' })).toBeVisible()
  const visites = page.getByRole('region', { name: 'Magasins à visiter' })
  if (await visites.count()) await expect(visites).not.toContainText(/\d+ magasins? pas vus?$/)
})

test('433 : une alerte du carnet que personne n’a prise, « Je m’en occupe » depuis le point du jour', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { config: { notes_magasins: notes }, persister: true, ecritures })
  await deplierPoint(page)
  const carnet = page.getByRole('region', { name: 'Carnet' })
  await expect(carnet).toContainText('Lyon Test')
  await expect(carnet).toContainText('redevance')
  await carnet.getByRole('button', { name: 'Je m’en occupe : Lyon Test' }).click()
  await expect.poll(() => JSON.stringify(ecritures)).toContain('Dominique DIRECTION')
  await expect.poll(() => JSON.stringify(ecritures)).toContain('prise')
  await expect(page.getByText('C’est noté : tu t’en occupes.')).toBeVisible()
})
