import { expect, test, type Page } from '@playwright/test'
import { deplierPoint, seConnecter, textesTropPetits, type CommunicationSimulee } from './supabase-simule'
import { zonesTropPetites } from './pilotage/supabase-simule'

// Fil d'actualité façon réseau social (propositions 204 à 211, Joseph 15/11/2026, « fais tout ») : une carte par
// publication (204), l'auteur en tête et le texte qui se déplie (205), le décompte au-dessus de boutons simples (206),
// « Partager » en tête (207), À la une en bandeau (208), sur téléphone le point du jour replié au-dessus d'un fil continu
// (209), cartes blanches en colonne (210), repère « Nouveau » depuis le dernier passage (211).

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

async function lisible(page: Page, isMobile: boolean) {
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
}

const PAUL = { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }
const DIRECTION = '00000000-0000-0000-0000-0000000000dd'
const LONG = Array.from({ length: 12 }, (_, i) => `Point ${i + 1} : on ouvre trois vins le samedi et on note les ventes de la journée.`).join('\n')
const communications = (): CommunicationSimulee[] => [
  { id: 1, titre: 'Nouvelle charte des vitrines', texte: 'À mettre en place avant le 15 novembre.', magasins: null, auteur: DIRECTION, auteur_nom: 'Dominique DIRECTION', auteur_role: 'directeur', cree_le: '2026-10-19T09:00:00Z', a_la_une: '2026-11-15' },
  { id: 3, titre: 'Opération bières de Noël', texte: 'Les fûts arrivent la semaine prochaine.', magasins: null, auteur: DIRECTION, auteur_nom: 'Dominique DIRECTION', auteur_role: 'directeur', cree_le: '2026-10-20T09:00:00Z', a_la_une: '2026-11-15' },
  { id: 2, titre: 'Résultats du challenge de septembre', texte: LONG, magasins: null, auteur: DIRECTION, auteur_nom: 'Dominique DIRECTION', auteur_role: 'directeur', cree_le: '2026-10-25T09:00:00Z',
    pouces: [{ user_id: 'x', nom: 'Hugo FICTIF' }, { user_id: 'y', nom: 'Inès EXEMPLE' }], commentaires: [{ id: 9, auteur: 'x', auteur_nom: 'Hugo FICTIF', auteur_role: 'coach', texte: 'Bravo à tous.', cree_le: '2026-10-25T10:00:00Z' }] },
]

test('204 à 206 et 208 : une carte par publication, l’auteur en tête, voir plus, décompte au-dessus des boutons, À la une en bandeau', async ({ page, isMobile }) => {
  await seConnecter(page, { communications: communications(), reactionsVisites: { pouces: {}, commentaires: {} } })
  await page.goto('./#/')
  // À la une : un bandeau qui défile sur le côté, les deux annonces côte à côte
  const une = page.getByRole('region', { name: 'À la une' })
  await expect(une.getByRole('article')).toHaveCount(2)
  const [a, b] = await une.getByRole('article').all()
  expect(Math.abs((await a.boundingBox())!.y - (await b.boundingBox())!.y)).toBeLessThan(2)
  const fil = page.getByRole('region', { name: 'Actualités' })
  const challenge = fil.getByRole('article', { name: 'Résultats du challenge de septembre' })
  await expect(challenge.getByText('Dominique DIRECTION', { exact: true })).toBeVisible()
  await expect(challenge.getByText(/^Directeur de réseau · Tout le réseau · /)).toBeVisible()
  // Texte coupé, déplié sur place
  await challenge.getByRole('button', { name: '…voir plus' }).click()
  await expect(challenge.getByRole('button', { name: '…voir plus' })).toHaveCount(0)
  // Décompte au-dessus, boutons simples
  await expect(challenge.getByText('2 J’aime', { exact: true })).toBeVisible()
  await expect(challenge.getByText('1 commentaire', { exact: true })).toBeVisible()
  await expect(challenge.getByRole('button', { name: 'J’aime' })).toBeVisible()
  await expect(challenge.getByRole('button', { name: 'Commenter' })).toBeVisible()
  // Chaque compte rendu a sa propre carte, avec ses gestes
  const comptesRendus = fil.getByRole('article', { name: /^Compte rendu de / })
  expect(await comptesRendus.count()).toBeGreaterThan(0)
  for (const cr of await comptesRendus.all()) await expect(cr.getByRole('button', { name: 'J’aime' })).toHaveCount(1)
  // Accueil : plus de filtres, ils restent dans Actualités
  await expect(fil.getByRole('group', { name: 'Filtrer le fil' })).toHaveCount(0)
  await lisible(page, isMobile)
})

test('207 : « Partager » en tête du fil ouvre la bonne pratique ; le Directeur publie une communication', async ({ page }) => {
  await seConnecter(page)
  const partager = page.getByRole('region', { name: 'Actualités' }).getByRole('region', { name: 'Partager' })
  await expect(partager.getByRole('link', { name: 'Communication' })).toBeVisible()
  await partager.getByRole('link', { name: 'Bonne pratique' }).click()
  await expect(page).toHaveURL(/vue=pratiques&ajouter=1/)
  await expect(page.getByRole('dialog', { name: 'Nouvelle bonne pratique' })).toBeVisible()
})

test('207 : le franchisé propose une bonne pratique depuis son fil, sans publier de communication', async ({ page }) => {
  await seConnecter(page, { acces: PAUL })
  const partager = page.getByRole('region', { name: 'Actualités' }).getByRole('region', { name: 'Partager' })
  await expect(partager.getByRole('link', { name: 'Communication' })).toHaveCount(0)
  await partager.getByRole('link', { name: 'Proposer une bonne pratique' }).click()
  await expect(page).toHaveURL(/vue=pratiques&proposer=1/)
  await expect(page.getByRole('dialog', { name: 'Proposer une bonne pratique' })).toBeVisible()
})

test('209 : sur téléphone, le point du jour se replie au-dessus du fil et se déplie à la demande', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Disposition du téléphone')
  await seConnecter(page)
  const bande = page.getByRole('button', { name: /^Mon point du jour/ })
  await expect(bande).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('region', { name: 'À traiter' })).toHaveCount(0)
  // Le fil commence dans le premier écran
  const fil = page.getByRole('region', { name: 'Actualités' })
  expect((await fil.boundingBox())!.y).toBeLessThan(page.viewportSize()!.height)
  await expect(fil.getByRole('link', { name: 'Voir toutes les actualités' })).toHaveCount(0)
  await deplierPoint(page)
  await expect(page.getByRole('region', { name: 'À traiter' })).toBeVisible()
  await lisible(page, isMobile)
})

test('211 : ce qui est arrivé depuis le dernier passage porte « Nouveau », puis « Vous êtes à jour »', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('vandb-fil-vu', '2026-10-22T00:00:00.000Z') } catch { /* sans stockage */ } })
  await seConnecter(page, { communications: communications().map((c) => ({ ...c, a_la_une: null })) })
  await page.goto('./#/')
  const fil = page.getByRole('region', { name: 'Actualités' })
  await expect(fil.getByRole('article', { name: 'Résultats du challenge de septembre' }).getByText('Nouveau', { exact: true })).toBeVisible()
  await expect(fil.getByRole('article', { name: 'Nouvelle charte des vitrines' }).getByText('Nouveau', { exact: true })).toHaveCount(0)
  await expect(fil.getByRole('separator', { name: 'Vous êtes à jour' })).toHaveCount(1)
})
