import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, type ReactionsPratiquesSimulees } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const ilYa = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString().slice(0, 10)
const AUTRE = '00000000-0000-0000-0000-000000000009'
const PAUL = { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }
const pratiques = () => [
  { id: 'bp_1', magasin: 'Lyon Test', date: ilYa(3), titre: 'Dégustation du samedi', theme: 'Animation et événements', texte: 'Trois vins ouverts chaque samedi.', par: 'Noé MODELE', photos: [], reprises: [], jaime: ['Hugo FICTIF'] },
]
const reactions = (): ReactionsPratiquesSimulees => ({
  pouces: { bp_1: [{ user_id: AUTRE, nom: 'Inès EXEMPLE' }] },
  commentaires: { bp_1: [{ id: 1, auteur: AUTRE, auteur_nom: 'Inès EXEMPLE', auteur_role: 'coach', texte: 'Je le propose à Nantes.', cree_le: new Date().toISOString() }] },
})

// L'accueil n'a plus de fil d'activité (Joseph, 21/10/2026) : les bonnes pratiques se lisent sur leur page
test('les bonnes pratiques du réseau avec J’aime et commentaires', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, config: { bonnes_pratiques: pratiques() }, reactionsPratiques: reactions() })
  await page.goto('./#/visites?vue=pratiques')
  const carte = page.getByRole('article', { name: 'Dégustation du samedi' })
  await expect(carte).toContainText('Trois vins ouverts chaque samedi.')
  await expect(carte.getByText('Je le propose à Nantes.')).toBeVisible()
  // Ancien « J'aime » de l'équipe et nouveau pouce comptés ensemble
  const pouce = carte.getByRole('button', { name: /^J’aime/ })
  await expect(pouce).toHaveText('J’aime · 2')
  await pouce.click()
  await expect(pouce).toHaveText('J’aime · 3')
  expect(ecritures.find((e) => e.table === 'rpc/basculer_pouce_pratique')?.corps).toEqual({ p_id: 'bp_1' })
  await carte.getByRole('button', { name: /^Commenter/ }).click()
  await carte.getByRole('textbox', { name: 'Commentaire sur Dégustation du samedi' }).fill('Bravo à l’équipe de Lyon.')
  await carte.getByRole('button', { name: 'Envoyer le commentaire' }).click()
  await expect(carte.getByText('Bravo à l’équipe de Lyon.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'rpc/commenter_pratique')?.corps).toEqual({ p_id: 'bp_1', p_texte: 'Bravo à l’équipe de Lyon.' })
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fil-pratique.png`, fullPage: !isMobile })
})

test('le franchisé voit les bonnes pratiques de tout le réseau, aime et commente', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { acces: PAUL, ecritures, espace: { pratiques: pratiques() }, reactionsPratiques: reactions() })
  await page.goto('./#/bonnes-pratiques')
  const carte = page.getByRole('article', { name: 'Dégustation du samedi' })
  await carte.getByRole('button', { name: /^J’aime/ }).click()
  await expect(carte.getByRole('button', { name: /^J’aime/ })).toHaveAttribute('aria-pressed', 'true')
  await carte.getByRole('button', { name: /^Commenter/ }).click()
  await carte.getByRole('textbox', { name: 'Commentaire sur Dégustation du samedi' }).fill('On teste à Annecy.')
  await carte.getByRole('button', { name: 'Envoyer le commentaire' }).click()
  await expect(carte.getByText('On teste à Annecy.')).toBeVisible()
  // Toujours là après rechargement
  await page.reload()
  const page2 = page.getByRole('article', { name: 'Dégustation du samedi' })
  await expect(page2.getByText('On teste à Annecy.')).toBeVisible()
  await expect(page2.getByRole('button', { name: /^J’aime/ })).toHaveAttribute('aria-pressed', 'true')
})

test('sur la page des bonnes pratiques, l’équipe commente', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, config: { bonnes_pratiques: pratiques() }, reactionsPratiques: reactions() })
  await page.goto('./#/visites?vue=pratiques')
  const carte = page.getByRole('article', { name: 'Dégustation du samedi' })
  await expect(carte.getByText('Je le propose à Nantes.')).toBeVisible()
  await carte.getByRole('button', { name: /^Commenter/ }).click()
  await carte.getByRole('textbox', { name: 'Commentaire sur Dégustation du samedi' }).fill('À reprendre partout.')
  await carte.getByRole('button', { name: 'Envoyer le commentaire' }).click()
  await expect(carte.getByText('À reprendre partout.')).toBeVisible()
})
