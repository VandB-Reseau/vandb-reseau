import { expect, test } from '@playwright/test'
import { seConnecter, type Ecriture } from './supabase-simule'

// 370 (Joseph, 23/11/2026) : après un enregistrement, seules les tables écrites sont relues, et pour le suivi des
// magasins seulement la rubrique touchée ; le résultat à l'écran reste celui d'un rechargement complet
test('ajouter une tâche ne relit que les tâches, pas tout le réseau', async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, persister: true })
  await page.goto('./#/magasins/Brest%20Test?vue=taches')
  const liste = page.getByRole('list', { name: 'Tâches en cours de Brest Test' })
  await expect(liste.getByRole('listitem')).toHaveCount(2)

  const lues: string[] = []
  page.on('request', (r) => { if (r.method() === 'GET' && r.url().includes('/rest/v1/')) lues.push(decodeURIComponent(r.url().split('/rest/v1/')[1])) })
  await page.getByRole('main').getByRole('button', { name: 'Ajouter', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Tâche' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une tâche' })
  await d.getByLabel('Tâche', { exact: true }).fill('Relancer la commande de coffrets')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Tâche ajoutée.')).toBeVisible()
  // La nouvelle tâche est à l'écran, relue depuis la base
  await expect(liste.getByRole('listitem')).toHaveCount(3)
  await expect(liste).toContainText('Relancer la commande de coffrets')

  const relues = lues.map((u) => u.split('?')[0])
  expect(lues.some((u) => u.startsWith('suivi_magasins?') && u.includes('cle=in.(actions)'))).toBe(true)
  for (const t of ['visits', 'events', 'reassigns', 'cs_overrides', 'recruits', 'store_overrides', 'fiches_personnes']) expect(relues).not.toContain(t)
  expect(erreurs).toEqual([])
})
