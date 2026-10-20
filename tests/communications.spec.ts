import { expect, test } from '@playwright/test'
import { MOI, seConnecter, textesTropPetits, type CommunicationSimulee, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const PAUL = { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }
const AUTRE = '00000000-0000-0000-0000-000000000009'
const communications = (): CommunicationSimulee[] => [
  { id: 1, titre: 'Lancement des coffrets de Noël', texte: 'Les coffrets arrivent en magasin le 2 novembre.\nMise en avant en tête de gondole.', magasins: null, auteur: AUTRE, auteur_nom: 'Joseph PERREAU', auteur_role: 'directeur', cree_le: '2026-10-19T09:00:00Z',
    pouces: [{ user_id: AUTRE, nom: 'Noé MODELE' }], commentaires: [{ id: 1, auteur: AUTRE, auteur_nom: 'Noé MODELE', auteur_role: 'coach', texte: 'Bien reçu, je relaie en visite.', cree_le: '2026-10-19T10:00:00Z' }] },
  { id: 2, titre: 'Réunion des franchisés du Sud', texte: 'Rendez-vous à Marseille.', magasins: ['Nice Test'], auteur: AUTRE, auteur_nom: 'Sam SUD', auteur_role: 'rr', cree_le: '2026-10-18T09:00:00Z' },
]

test('le Directeur publie une communication pour tout le réseau', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, communications: [] })
  await page.goto('./#/communications')
  await expect(page.getByRole('heading', { level: 1, name: 'Communications' })).toBeVisible()
  await expect(page.getByText('Aucune communication')).toBeVisible()
  await page.getByRole('button', { name: 'Publier' }).click()
  const d = page.getByRole('dialog', { name: 'Nouvelle communication' })
  await d.getByLabel('Titre').fill('Nouvelle carte des cocktails')
  await d.getByRole('textbox', { name: 'Message' }).fill('La carte d’hiver est disponible.')
  expect(await textesTropPetits(page)).toEqual([])
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const carte = page.getByRole('article', { name: 'Nouvelle carte des cocktails' })
  await expect(carte).toContainText('Tout le réseau')
  await expect(carte).toContainText('La carte d’hiver est disponible.')
  expect(ecritures.find((e) => e.table === 'rpc/publier_communication')?.corps).toMatchObject({ p_id: null, p_titre: 'Nouvelle carte des cocktails' })
  // L'auteur la modifie
  await carte.getByRole('button', { name: 'Modifier la communication Nouvelle carte des cocktails' }).click()
  await expect(page.getByRole('dialog', { name: 'Modifier la communication' })).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-communication-publier.png`, fullPage: !isMobile })
})

test('un franchisé lit les communications de ses magasins, met un pouce et commente', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { acces: PAUL, ecritures, communications: communications() })
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await nav.getByRole('button', { name: isMobile ? 'Infos' : 'Communications' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Communications' })).toBeVisible()
  // Celle du Sud ne concerne pas ses magasins
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Publier' })).toHaveCount(0)
  const carte = page.getByRole('article', { name: 'Lancement des coffrets de Noël' })
  await expect(carte.getByText('Bien reçu, je relaie en visite.')).toBeVisible()
  const pouce = carte.getByRole('button', { name: /^J’aime/ })
  await expect(pouce).toHaveText('J’aime · 1')
  await pouce.click()
  await expect(pouce).toHaveAttribute('aria-pressed', 'true')
  await expect(pouce).toHaveText('J’aime · 2')
  expect(ecritures.some((e) => e.table === 'rpc/basculer_pouce_communication')).toBe(true)
  await carte.getByRole('button', { name: /^Commenter/ }).click()
  await carte.getByRole('textbox', { name: 'Commentaire sur Lancement des coffrets de Noël' }).fill('Merci, on s’organise.')
  await carte.getByRole('button', { name: 'Envoyer le commentaire' }).click()
  await expect(carte.getByText('Merci, on s’organise.')).toBeVisible()
  await expect(carte.getByRole('button', { name: /^Commenter · 2$/ })).toBeVisible()
  expect(ecritures.find((e) => e.table === 'rpc/commenter_communication')?.corps).toEqual({ p_id: 1, p_texte: 'Merci, on s’organise.' })
  // Son commentaire se retire
  await expect(carte.getByRole('button', { name: /^Retirer mon commentaire/ })).toHaveCount(1)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-communication-franchise.png`, fullPage: !isMobile })
})

test('un Coach lit et commente, sans publier', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' }, communications: communications() })
  await page.goto('./#/communications')
  await expect(page.getByRole('article', { name: 'Lancement des coffrets de Noël' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publier' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Modifier la communication/ })).toHaveCount(0)
})

test('la recherche filtre les communications et un Responsable Régional publie pour ses magasins', async ({ page }) => {
  const liste = communications()
  await seConnecter(page, { appMetadata: { role: 'rr', rr: 'rr1' }, communications: liste })
  await page.goto('./#/communications')
  await page.getByPlaceholder('Rechercher une communication').fill('Marseille')
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('article', { name: 'Réunion des franchisés du Sud' })).toBeVisible()
  await page.getByPlaceholder('Rechercher une communication').fill('')
  await page.getByRole('button', { name: 'Publier' }).click()
  const d = page.getByRole('dialog', { name: 'Nouvelle communication' })
  await d.getByLabel('Titre').fill('Point rentrée')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('article', { name: 'Point rentrée' })).toContainText('2 magasins')
  expect(liste.at(-1)).toMatchObject({ auteur: MOI, magasins: ['Lyon Test', 'Metz Test'] })
})

test('tant que le script n’est pas passé, la page le dit sans erreur technique', async ({ page }) => {
  await seConnecter(page, { communications: null })
  await page.goto('./#/communications')
  await expect(page.getByText('Communications pas encore activées')).toBeVisible()
  await expect(page.getByText(/PGRST|function/)).toHaveCount(0)
})
