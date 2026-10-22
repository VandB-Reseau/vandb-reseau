import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type CommunicationSimulee, type Ecriture } from './supabase-simule'

// Canaux « Réseau V and B » et « Bonnes pratiques » présentés comme un groupe (Joseph, 22/10/2026) :
// les publications défilent comme des messages, la plus récente en bas ; seuls ceux qui publient ont le bouton,
// tout le monde aime et commente

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const AUTRE = '00000000-0000-0000-0000-000000000009'
const ilYa = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString()
const communications = (): CommunicationSimulee[] => [
  { id: 1, titre: 'Coffrets de Noël', texte: 'Arrivée le 2 novembre.', magasins: null, auteur: AUTRE, auteur_nom: 'Joseph PERREAU', auteur_role: 'directeur', cree_le: ilYa(1) },
  { id: 2, titre: 'Bilan de l’été', texte: 'Ventes en hausse.', magasins: null, auteur: AUTRE, auteur_nom: 'Joseph PERREAU', auteur_role: 'directeur', cree_le: ilYa(20) },
]
const pratiques = [
  { id: 'bp_1', magasin: 'Annecy Test', date: ilYa(3).slice(0, 10), titre: 'Dégustation du samedi', theme: 'Animation et événements', texte: 'Trois vins ouverts.', par: 'Hugo FICTIF', photos: [], reprises: [], jaime: [] },
  { id: 'bp_2', magasin: 'Nice Test', date: ilYa(30).slice(0, 10), titre: 'Accord mets et vins', theme: 'Vente additionnelle', texte: 'Une fiche par plat.', par: 'Sam SUD', photos: [], reprises: [], jaime: [] },
]
const publications = (page: Page, canal: string) => page.getByRole('list', { name: `Publications de ${canal}` }).getByRole('article')

test('le canal Réseau V and B défile comme un groupe, le Directeur publie en bas', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { communications: communications(), ecritures })
  await page.goto('./#/echanges/reseau')
  await expect(page.getByRole('heading', { name: 'Réseau V and B' })).toBeVisible()
  // La plus ancienne en haut, la plus récente en bas, à l'écran
  await expect(publications(page, 'Réseau V and B')).toHaveText([/Bilan de l’été/, /Coffrets de Noël/])
  await expect(page.getByRole('article', { name: 'Coffrets de Noël' })).toBeInViewport()
  const publier = page.getByRole('button', { name: 'Publier' })
  await expect(publier).toBeInViewport()
  const bas = (await publier.boundingBox())!
  expect(bas.y + bas.height).toBeGreaterThan(page.viewportSize()!.height - 120)
  expect(bas.height).toBeGreaterThanOrEqual(48)
  if (isMobile) await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeHidden()
  else await expect(page.getByRole('list', { name: 'Conversations' }).getByRole('button', { name: /^Réseau V and B/ })).toHaveClass(/Mui-selected/)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-canal-reseau.png` })
  await page.getByRole('article', { name: 'Coffrets de Noël' }).getByRole('button', { name: /^J’aime/ }).click()
  await expect.poll(() => ecritures.some((e) => e.table === 'rpc/basculer_pouce_communication')).toBe(true)
  await publier.click()
  await expect(page.getByRole('dialog', { name: 'Nouvelle communication' })).toBeVisible()
})

test('un franchisé lit le canal sans pouvoir publier, mais aime et commente', async ({ page }) => {
  await seConnecter(page, { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] }, communications: communications() })
  await page.goto('./#/echanges/reseau')
  await expect(publications(page, 'Réseau V and B')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Publier' })).toHaveCount(0)
  const carte = page.getByRole('article', { name: 'Coffrets de Noël' })
  await expect(carte.getByRole('button', { name: /^J’aime/ })).toBeEnabled()
  await carte.getByRole('button', { name: /^Commenter/ }).click()
  await expect(carte.getByRole('textbox', { name: 'Commentaire sur Coffrets de Noël' })).toBeVisible()
})

test('le canal Bonnes pratiques défile comme un groupe, avec l’ajout en bas', async ({ page }, info) => {
  await seConnecter(page, { config: { bonnes_pratiques: pratiques } })
  await page.goto('./#/echanges/pratiques')
  await expect(page.getByRole('heading', { name: 'Bonnes pratiques' })).toBeVisible()
  await expect(publications(page, 'Bonnes pratiques')).toHaveText([/Accord mets et vins/, /Dégustation du samedi/])
  const ajouter = page.getByRole('button', { name: 'Ajouter une bonne pratique' })
  await expect(ajouter).toBeInViewport()
  await page.screenshot({ path: `captures/${info.project.name}-canal-pratiques.png` })
  await ajouter.click()
  await expect(page.getByRole('dialog', { name: 'Nouvelle bonne pratique' })).toBeVisible()
})
