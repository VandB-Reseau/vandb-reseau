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
  // Choix 212 (15/11/2026) : l'Accueil porte seul le fil, avec ses filtres
  // Téléphone (278) : les filtres derrière un picto
  if (isMobile) await expect(fil.getByRole('button', { name: 'Filtrer le fil' })).toBeVisible()
  else await expect(fil.getByRole('group', { name: 'Filtrer le fil' })).toBeVisible()
  await lisible(page, isMobile)
})

test('207 : « Partager » en tête du fil ouvre la bonne pratique sur place ; le Directeur publie une communication sans quitter l’Accueil', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Téléphone : un seul champ, voir le test 278')
  await seConnecter(page)
  const partager = page.getByRole('region', { name: 'Actualités' }).getByRole('region', { name: 'Partager' })
  await partager.getByRole('button', { name: 'Bonne pratique' }).click()
  await expect(page.getByRole('dialog', { name: 'Nouvelle bonne pratique' })).toBeVisible()
  await expect(page).not.toHaveURL(/infos/)
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click()
  await partager.getByRole('button', { name: 'Partager une réussite du terrain' }).click()
  await expect(page.getByRole('dialog', { name: 'Nouvelle bonne pratique' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click()
  await partager.getByRole('button', { name: 'Communication' }).click()
  const fenetre = page.getByRole('dialog', { name: 'Nouvelle communication' })
  await expect(fenetre).toBeVisible()
  await fenetre.getByRole('textbox', { name: 'Titre' }).fill('Bravo à toute l’équipe')
  await fenetre.getByRole('textbox', { name: 'Message' }).fill('Belle soirée dégustation samedi.')
  await fenetre.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(fenetre).toHaveCount(0)
  await expect(page.getByText('Communication publiée.')).toBeVisible()
  await expect(page).not.toHaveURL(/infos/)
})

test('207 : le franchisé propose une bonne pratique depuis son fil, sans publier de communication', async ({ page }) => {
  await seConnecter(page, { acces: PAUL })
  const partager = page.getByRole('region', { name: 'Actualités' }).getByRole('region', { name: 'Partager' })
  await expect(partager.getByRole('button', { name: 'Communication' })).toHaveCount(0)
  await partager.getByRole('button', { name: 'Proposer une bonne pratique' }).click()
  await expect(page.getByRole('dialog', { name: 'Proposer une bonne pratique' })).toBeVisible()
  await expect(page).not.toHaveURL(/infos/)
})

test('209 puis 278 : sur téléphone, le fil commence en haut ; le point du jour s’ouvre par la barre du haut', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Disposition du téléphone')
  await seConnecter(page)
  await expect(page.getByRole('region', { name: 'À traiter' })).toHaveCount(0)
  // Le fil commence dans le premier écran
  const fil = page.getByRole('region', { name: 'Actualités' })
  expect((await fil.boundingBox())!.y).toBeLessThan(page.viewportSize()!.height / 3)
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

test('Accueil PC (17/11) : fil et colonne de droite alignés sous le titre, sans grand vide entre ou autour', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Disposition du PC')
  await page.setViewportSize({ width: 1920, height: 1000 })
  await seConnecter(page)
  const fil = (await page.getByRole('region', { name: 'Actualités' }).boundingBox())!
  const cote = (await page.getByRole('complementary', { name: 'Aujourd’hui' }).boundingBox())!
  const titre = (await page.getByRole('heading', { name: 'Accueil', level: 1 }).boundingBox())!
  expect(Math.abs(fil.x - titre.x)).toBeLessThan(4)
  expect(cote.x - (fil.x + fil.width)).toBeLessThanOrEqual(32)
  expect(fil.width).toBeGreaterThan(700)
  expect(cote.width).toBeGreaterThan(500)
})

test('278 corrigé (17/11) : sur téléphone, ni titre visible, périmètre en puce, Partager en un champ, filtres derrière un picto, fil bord à bord, nombre rouge = urgences', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Disposition du téléphone')
  await seConnecter(page, { communications: communications().map((c) => ({ ...c, a_la_une: null })) })
  await page.goto('./#/')
  const main = page.getByRole('main')
  const fil = page.getByRole('region', { name: 'Actualités' })
  await expect(fil.getByRole('article').first()).toBeVisible()
  // Titres présents pour les lecteurs d'écran seulement
  for (const nom of ['Accueil', 'Actualités']) {
    const t = main.getByRole('heading', { name: nom, exact: true })
    expect((await t.boundingBox())!.height).toBeLessThanOrEqual(2)
  }
  // Périmètre : une puce d'une ligne
  const perimetre = main.getByRole('button', { name: /^Périmètre : / })
  await expect(perimetre).toHaveText(/^Tout le réseau/)
  expect((await perimetre.boundingBox())!.height).toBeLessThanOrEqual(50)
  // Partager : un seul champ ; Bonne pratique et Communication au toucher
  const partager = fil.getByRole('region', { name: 'Partager' })
  await expect(partager.getByRole('button')).toHaveCount(1)
  await partager.getByRole('button', { name: 'Partager une réussite du terrain' }).click()
  await page.getByRole('menuitem', { name: 'Bonne pratique' }).click()
  await expect(page.getByRole('dialog', { name: 'Nouvelle bonne pratique' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click()
  await partager.getByRole('button', { name: 'Partager une réussite du terrain' }).click()
  await page.getByRole('menuitem', { name: 'Communication' }).click()
  await expect(page.getByRole('dialog', { name: 'Nouvelle communication' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click()
  // Filtres : repliés derrière le picto, le filtre choisi se retire d'un geste
  await expect(fil.getByRole('group', { name: 'Filtrer le fil' })).toHaveCount(0)
  await fil.getByRole('button', { name: 'Filtrer le fil' }).click()
  await page.getByRole('menuitem', { name: 'Visites' }).click()
  await expect(fil.getByRole('article', { name: /^Compte rendu de / }).first()).toBeVisible()
  await fil.getByRole('button', { name: 'Retirer le filtre Visites' }).click()
  await expect(fil.getByRole('button', { name: /^Retirer le filtre/ })).toHaveCount(0)
  // Publications bord à bord, séparées par un fin espace
  const largeur = page.viewportSize()!.width
  const [a, b] = await fil.getByRole('article').all()
  const [ba, bb] = [(await a.boundingBox())!, (await b.boundingBox())!]
  expect(ba.x).toBeLessThanOrEqual(1)
  expect(ba.width).toBeGreaterThanOrEqual(largeur - 2)
  expect(bb.y - (ba.y + ba.height)).toBeLessThanOrEqual(8)
  // Le nombre rouge ne compte que les urgences (pastilles rouges), pas tout ce qui est à traiter
  const picto = page.getByRole('banner').getByRole('button', { name: /^Mon point du jour/ })
  const libelle = (await picto.getAttribute('aria-label'))!
  const urgences = Number(/(\d+) urgence/.exec(libelle)?.[1] ?? 0)
  const total = Number(/(\d+) à traiter/.exec(libelle)?.[1] ?? 0)
  expect(urgences).toBeLessThan(total)
  if (urgences) await expect(picto.locator('.MuiBadge-badge')).toHaveText(String(urgences))
  await lisible(page, isMobile)
})

// Bug du J'aime retiré (Joseph, 17/11/2026) : sur téléphone, le bouton restait grisé après avoir retiré son J'aime. Le
// bouton ne se grise plus pendant l'envoi, le décompte suit, et des gestes rapides finissent sur l'état voulu.
test('J’aime : aimer, retirer, remettre, même avec une base lente, le bouton reste actif et le décompte suit', async ({ page }) => {
  const liste = communications()
  await seConnecter(page, { communications: liste, reactionsVisites: { pouces: {}, commentaires: {} } })
  let envois = 0
  await page.route('**/rest/v1/rpc/basculer_pouce_communication', async (route) => { envois++; await new Promise((r) => setTimeout(r, 600)); await route.fallback() })
  await page.goto('./#/')
  const carte = page.getByRole('region', { name: 'Actualités' }).getByRole('article', { name: 'Résultats du challenge de septembre' })
  const bouton = carte.getByRole('button', { name: 'J’aime' })
  await expect(carte.getByText('2 J’aime', { exact: true })).toBeVisible()
  await bouton.click()
  await expect(bouton).toHaveAttribute('aria-pressed', 'true')
  expect(await bouton.isDisabled()).toBe(false)
  await expect(carte.getByText('3 J’aime', { exact: true })).toBeVisible()
  await expect.poll(() => envois).toBe(1)
  await bouton.click()
  await expect(bouton).toHaveAttribute('aria-pressed', 'false')
  expect(await bouton.isDisabled()).toBe(false)
  await expect(carte.getByText('2 J’aime', { exact: true })).toBeVisible()
  await bouton.click()
  await expect(bouton).toHaveAttribute('aria-pressed', 'true')
  await expect(carte.getByText('3 J’aime', { exact: true })).toBeVisible()
  // Retiré pour de bon : après relecture de la base, le bouton reste vide et actif
  await bouton.click()
  await expect(bouton).toHaveAttribute('aria-pressed', 'false')
  await page.waitForTimeout(2000)
  await expect(bouton).toHaveAttribute('aria-pressed', 'false')
  expect(await bouton.isDisabled()).toBe(false)
  await expect(carte.getByText('2 J’aime', { exact: true })).toBeVisible()
  expect(liste.find((c) => c.id === 2)!.pouces!.some((p) => p.user_id !== 'x' && p.user_id !== 'y')).toBe(false)
})

test('Accueil (24/11) : un compte rendu montre tout de suite sa barre J’aime / Commenter, sans autre bouton remplacé une seconde plus tard', async ({ page }) => {
  await seConnecter(page, { reactionsVisites: { pouces: {}, commentaires: {} } })
  // Base lente pour les « J'aime » des comptes rendus
  await page.route('**/rest/v1/rpc/reactions_visites', async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.fallback() })
  await page.reload()
  const compteRendu = page.getByRole('region', { name: 'Actualités' }).getByRole('article', { name: /^Compte rendu de / }).first()
  await expect(compteRendu).toBeVisible()
  const jaime = compteRendu.getByRole('button', { name: 'J’aime' })
  await expect(jaime).toBeVisible()
  await expect(jaime).toBeDisabled()
  await expect(compteRendu.getByRole('link', { name: 'Voir le compte rendu' })).toHaveCount(0)
  // Les « J'aime » arrivés, la même barre devient active
  await expect(jaime).toBeEnabled()
  await expect(compteRendu.getByRole('link', { name: 'Voir le compte rendu' })).toHaveCount(0)
})
