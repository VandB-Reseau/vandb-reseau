import { expect, test, type Page } from '@playwright/test'
import { MOI, seConnecter, type CommunicationSimulee, type Ecriture } from './supabase-simule'

// Les fenêtres des communications se ferment dès l'enregistrement, même quand la base répond lentement
test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const AUTRE = '00000000-0000-0000-0000-000000000009'
const MIENNE = (): CommunicationSimulee[] => [
  { id: 1, titre: 'Lancement des coffrets de Noël', texte: 'Les coffrets arrivent le 2 novembre.', magasins: null, auteur: MOI, auteur_nom: 'Joseph PERREAU', auteur_role: 'directeur', cree_le: '2026-10-19T09:00:00Z',
    commentaires: [{ id: 1, auteur: MOI, auteur_nom: 'Joseph PERREAU', auteur_role: 'directeur', texte: 'Pensez aux affiches.', cree_le: '2026-10-19T10:00:00Z' }] },
  { id: 2, titre: 'Réunion des franchisés du Sud', texte: 'Rendez-vous à Marseille.', magasins: null, auteur: AUTRE, auteur_nom: 'Sam SUD', auteur_role: 'rr', cree_le: '2026-10-18T09:00:00Z' },
]

// Base lente (ou qui refuse) sur une fonction
async function ralentir(page: Page, fn: string, refus?: string) {
  await page.route(new RegExp(`/rest/v1/rpc/${fn}`), async (route) => {
    await new Promise((r) => setTimeout(r, 2500))
    if (refus) await route.fulfill({ status: 400, json: { code: 'P0001', message: refus } })
    else await route.fallback()
  })
}
// Compte les lectures de tout le réseau (le magasin le plus lu au chargement)
function lecturesReseau(page: Page) {
  const n = { v: 0 }
  page.on('request', (r) => { if (/\/rest\/v1\/store_overrides/.test(r.url())) n.v++ })
  return n
}

test('publier ferme la fenêtre aussitôt, sans relire tout le réseau', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, communications: MIENNE() })
  await ralentir(page, 'publier_communication')
  await page.goto('./#/communications')
  await expect(page.getByRole('article')).toHaveCount(2)
  const reseau = lecturesReseau(page)
  await page.getByRole('button', { name: 'Publier' }).click()
  const d = page.getByRole('dialog', { name: 'Nouvelle communication' })
  await d.getByLabel('Titre').fill('Carte des cocktails d’hiver')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden({ timeout: 1000 })
  await expect(page.getByRole('article', { name: 'Carte des cocktails d’hiver' })).toBeVisible({ timeout: 1000 })
  await expect(page.getByText('Communication publiée.')).toBeVisible({ timeout: 5000 })
  expect(ecritures.filter((e) => e.table === 'rpc/publier_communication')).toHaveLength(1)
  expect(reseau.v).toBe(0)
})

test('une publication refusée par la base rouvre la fenêtre avec ce qui était saisi', async ({ page }) => {
  await seConnecter(page, { communications: MIENNE() })
  await ralentir(page, 'publier_communication', 'trop_long')
  await page.goto('./#/communications')
  await page.getByRole('button', { name: 'Publier' }).click()
  await page.getByRole('dialog').getByLabel('Titre').fill('Texte trop long')
  await page.getByRole('dialog').getByRole('textbox', { name: 'Message' }).fill('Brouillon à garder')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 1000 })
  const d = page.getByRole('dialog', { name: 'Nouvelle communication' })
  await expect(d.getByText('Le texte est trop long.')).toBeVisible({ timeout: 5000 })
  await expect(d.getByLabel('Titre')).toHaveValue('Texte trop long')
  await expect(d.getByRole('textbox', { name: 'Message' })).toHaveValue('Brouillon à garder')
  await expect(page.getByRole('article', { name: 'Texte trop long' })).toHaveCount(0)
})

test('modifier et retirer ferment la fenêtre aussitôt ; un retrait refusé remet la communication', async ({ page }) => {
  await seConnecter(page, { communications: MIENNE() })
  await ralentir(page, 'publier_communication')
  await page.goto('./#/communications')
  await page.getByRole('button', { name: 'Modifier la communication Lancement des coffrets de Noël' }).click()
  const d = page.getByRole('dialog', { name: 'Modifier la communication' })
  await d.getByLabel('Titre').fill('Coffrets de Noël : nouvelle date')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden({ timeout: 1000 })
  await expect(page.getByRole('article', { name: 'Coffrets de Noël : nouvelle date' })).toBeVisible({ timeout: 1000 })
  await expect(page.getByText('Communication mise à jour.')).toBeVisible({ timeout: 5000 })

  await ralentir(page, 'supprimer_communication', 'acces_refuse')
  await page.getByRole('button', { name: 'Modifier la communication Coffrets de Noël : nouvelle date' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await page.getByRole('dialog').getByRole('alert').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 1000 })
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByText('Tu n’as pas accès à cette communication.')).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('article', { name: 'Coffrets de Noël : nouvelle date' })).toBeVisible()
})

test('retirer une communication la fait disparaître aussitôt', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, communications: MIENNE() })
  await ralentir(page, 'supprimer_communication')
  await page.goto('./#/communications')
  await page.getByRole('button', { name: 'Modifier la communication Lancement des coffrets de Noël' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await page.getByRole('dialog').getByRole('alert').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 1000 })
  await expect(page.getByRole('article')).toHaveCount(1, { timeout: 1000 })
  await expect(page.getByText('Communication retirée.')).toBeVisible({ timeout: 5000 })
  expect(ecritures.some((e) => e.table === 'rpc/supprimer_communication')).toBe(true)
})

test('un commentaire retiré disparaît aussitôt', async ({ page }) => {
  await seConnecter(page, { communications: MIENNE() })
  await ralentir(page, 'supprimer_commentaire_communication')
  await page.goto('./#/communications')
  const carte = page.getByRole('article', { name: 'Lancement des coffrets de Noël' })
  await carte.getByRole('button', { name: /^Retirer mon commentaire/ }).click()
  await expect(carte.getByText('Pensez aux affiches.')).toHaveCount(0, { timeout: 1000 })
})

test('au retour sur la page, les communications s’affichent sans attendre la base', async ({ page }) => {
  await seConnecter(page, { communications: MIENNE() })
  await page.goto('./#/communications')
  await expect(page.getByRole('article')).toHaveCount(2)
  await ralentir(page, 'communications')
  await page.goto('./#/magasins')
  await expect(page.getByRole('heading', { level: 1, name: 'Magasins' })).toBeVisible()
  await page.goto('./#/communications')
  await expect(page.getByRole('article')).toHaveCount(2, { timeout: 1000 })
  await expect(page.getByText('Chargement…')).toHaveCount(0)
})
