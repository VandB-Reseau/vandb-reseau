import { expect, test, type Page } from '@playwright/test'
import { MOI, seConnecter, type CommunicationSimulee } from './supabase-simule'

// Sprint 22, F2 : une tâche confiée et une communication mise à la une partent aussi sur le téléphone.
// La fonction Supabase « notifier » est simulée : on vérifie ce que l'app lui demande d'envoyer.

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

async function fonctionSimulee(page: Page) {
  const appels: Record<string, unknown>[] = []
  await page.route('https://supabase.test/functions/v1/notifier', (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, body: 'ok' })
    appels.push(r.request().postDataJSON())
    return r.fulfill({ json: { envoyees: 1 } })
  })
  return appels
}

test('une tâche confiée au Coach lui est envoyée, pas à celui qui l’écrit', async ({ page }) => {
  await seConnecter(page)
  const appels = await fonctionSimulee(page)
  await page.goto('./#/taches')
  await page.getByRole('button', { name: 'Ajouter une tâche' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une tâche' })
  await d.getByLabel('Magasin').click()
  await page.getByRole('option', { name: 'Lyon Test' }).click()
  await d.getByLabel('Tâche', { exact: true }).fill('Préparer la dégustation de Noël')
  await d.getByLabel('Porteurs').click()
  await page.getByRole('option', { name: 'Noé MODELE' }).click()
  await page.keyboard.press('Escape')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Tâche ajoutée.')).toBeVisible()
  await expect.poll(() => appels.filter((a) => a.type === 'tache')).toEqual([
    { type: 'tache', magasin: 'Lyon Test', tache: expect.stringMatching(/^l_/), cles: ['coach:Noé MODELE'] },
  ])
})

test('une communication mise à la une prévient les franchisés, une seule fois', async ({ page }) => {
  const communications: CommunicationSimulee[] = [
    { id: 1, titre: 'Nouvelle gamme', texte: 'Arrivée en magasin.', magasins: null, auteur: MOI, auteur_nom: 'Dominique DIRECTION', auteur_role: 'directeur', cree_le: '2026-10-20T09:00:00Z' },
  ]
  await seConnecter(page, { communications })
  const appels = await fonctionSimulee(page)
  await page.goto('./#/infos')
  await page.getByRole('button', { name: 'Modifier la communication Nouvelle gamme' }).click()
  const jour = new Date(Date.now() + 7 * 86400000).toLocaleDateString('sv-SE')
  await page.getByRole('dialog').getByLabel('À la une jusqu’au').fill(jour)
  await page.getByRole('dialog').getByRole('button', { name: /Publier|Enregistrer/ }).click()
  await expect.poll(() => appels).toEqual([{ type: 'une', ids: [1] }])
  // Prolonger la date ne renvoie rien
  await page.getByRole('button', { name: 'Modifier la communication Nouvelle gamme' }).click()
  await page.getByRole('dialog').getByLabel('À la une jusqu’au').fill(new Date(Date.now() + 9 * 86400000).toLocaleDateString('sv-SE'))
  await page.getByRole('dialog').getByRole('button', { name: /Publier|Enregistrer/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.waitForTimeout(500)
  expect(appels).toHaveLength(1)
})
