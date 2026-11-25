import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

// Accès « Direction » (Joseph, 24/11/2026, lot 2 après le carnet) : un DG ou un autre accès donné par le Directeur lit
// tout le réseau, carnets compris, et n'écrit que dans le carnet. Données fictives uniquement.

const DORA = { role: 'direction', direction: 'Dora GENERALE' }
const notes = { 'Lyon Test': [{ id: 'na', date: '2026-10-24', quand: '2026-10-24T17:12:00.000Z', texte: 'Visite tendue : il remet en cause la redevance.', par: 'Noé MODELE', ton: 'alerte', themes: ['posture'] }] }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le Directeur ouvre et coupe un accès Direction depuis l’Équipe', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, accesDirection: [] })
  await page.goto('./#/equipe')
  const section = page.getByRole('region', { name: 'Accès Direction' })
  await expect(section).toBeVisible()
  await section.getByRole('textbox', { name: 'Nom' }).fill('Dora GENERALE')
  await section.getByRole('textbox', { name: 'Email du compte' }).fill('dg@exemple.test')
  await section.getByRole('button', { name: 'Ouvrir l’accès' }).click()
  await expect(page.getByText('Accès Direction ouvert pour Dora GENERALE.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'rpc/ouvrir_acces_direction')?.corps).toEqual({ p_email: 'dg@exemple.test', p_nom: 'Dora GENERALE' })
  const liste = section.getByRole('list', { name: 'Accès Direction ouverts' })
  await expect(liste).toContainText('Dora GENERALE')
  expect(await textesTropPetits(page)).toEqual([])
  // Zones tactiles de la section seulement (le reste de la page Équipe a ses propres tests)
  if (isMobile) for (const b of await section.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await liste.getByRole('button', { name: 'Couper l’accès de Dora GENERALE' }).click()
  await page.getByRole('dialog', { name: 'Couper l’accès de Dora GENERALE ?' }).getByRole('button', { name: 'Couper l’accès' }).click()
  await expect(page.getByText('Accès de Dora GENERALE coupé.')).toBeVisible()
  await expect(section.getByRole('list', { name: 'Accès Direction ouverts' })).toHaveCount(0)
})

test('un compte Direction lit tout le réseau, sans réglages ni « + », et écrit dans le carnet à son nom', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { acces: DORA, config: { notes_magasins: notes }, persister: true, ecritures })
  await page.goto('./#/magasins?vue=liste')
  await expect(page.getByRole('heading', { level: 1, name: 'Magasins' })).toBeVisible()
  await expect(page.getByText('Lyon Test').first()).toBeVisible()
  await expect(page.locator('.MuiFab-root[aria-label="Ajouter"]')).toHaveCount(0)
  if (!isMobile) await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Paramètres', exact: true })).toHaveCount(0)
  // Le carnet du magasin : il lit l'alerte et répond à son nom
  await page.goto('./#/magasins/Lyon%20Test?vue=carnet')
  const fil = page.getByRole('list', { name: 'Carnet de Lyon Test' })
  const alerte = fil.getByRole('article', { name: /^Note alerte du 24 oct\. 2026 par Noé MODELE/ })
  await expect(alerte).toContainText('remet en cause la redevance')
  await alerte.getByRole('button', { name: 'Répondre' }).click()
  await alerte.getByRole('textbox', { name: 'Ta réponse' }).fill('Je l’appelle lundi.')
  await alerte.getByRole('button', { name: 'Répondre' }).click()
  await expect(alerte.getByRole('list', { name: 'Réponses' })).toContainText('Dora GENERALE')
  expect(JSON.stringify(ecritures.filter((e) => JSON.stringify(e.corps).includes('Je l’appelle lundi')).at(-1)?.corps)).toContain('Dora GENERALE')
  expect(await textesTropPetits(page)).toEqual([])
})
