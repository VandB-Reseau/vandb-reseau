import { expect, test, type Page } from '@playwright/test'
import { seConnecter, type CommunicationSimulee } from './supabase-simule'

// Canal « Réseau V and B » du franchisé présenté comme un groupe (Joseph, 22/10/2026) : les publications défilent
// comme des messages, la plus récente en bas ; le franchisé aime et commente

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

// Pour l'équipe, communications et bonnes pratiques ne sont plus que dans Infos réseau (sprint 22, S1)
test('pour l’équipe, les anciens canaux mènent à Infos réseau', async ({ page }) => {
  await seConnecter(page, { communications: communications(), config: { bonnes_pratiques: pratiques } })
  await page.goto('./#/echanges/reseau')
  await expect(page).toHaveURL(/#\/infos$/)
  await expect(page.getByRole('article', { name: 'Coffrets de Noël' })).toBeVisible()
  await page.goto('./#/echanges/pratiques')
  await expect(page).toHaveURL(/#\/infos\?vue=pratiques$/)
  await page.goto('./#/echanges')
  await expect(page.getByRole('list', { name: 'Conversations' }).getByRole('button', { name: /^(Réseau V and B|Bonnes pratiques)/ })).toHaveCount(0)
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
