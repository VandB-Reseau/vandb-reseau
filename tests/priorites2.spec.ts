import { expect, test } from '@playwright/test'
import { MOI, seConnecter, textesTropPetits, type CommunicationSimulee, type Ecriture } from './supabase-simule'

// Priorités 2 des propositions par onglet (Joseph, 21/10/2026) : en-tête compact, Plus et Paramètres en lignes,
// contacts à initiales, tri et lettres dans Magasins, Agenda en pastilles, communication à la une

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('en-tête : sur téléphone, le compteur passe à droite du titre', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  const h1 = page.getByRole('heading', { level: 1, name: 'Magasins' })
  const compteur = page.getByText(/^\d+ magasins?/).first()
  const [t, c] = [(await h1.boundingBox())!, (await compteur.boundingBox())!]
  if (isMobile) {
    expect(c.x).toBeGreaterThan(t.x + t.width)
    expect(Math.abs((c.y + c.height / 2) - (t.y + t.height / 2))).toBeLessThanOrEqual(8)
  } else expect(c.y).toBeGreaterThan(t.y + t.height - 1)
})

test('Plus : des libellés seuls, le nombre de postes à pourvoir sur Équipe', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'Plus est l’onglet du téléphone')
  await seConnecter(page)
  await page.goto('./#/plus')
  await expect(page.getByText(/^\d+ postes? à pourvoir$/)).toBeVisible()
  for (const b of await page.getByRole('main').getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-plus-libelles.png` })
})

test('Paramètres : chaque réglage sur une ligne, le chiffre à droite', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/parametres/reglages?rubrique=visite')
  const champ = page.getByLabel('Redressement urgent (jours sans visite)')
  await expect(champ).toBeVisible()
  const b = (await champ.boundingBox())!
  expect(b.width).toBeLessThanOrEqual(110)
  const libelle = page.getByText('Redressement urgent', { exact: true }).first()
  const l = (await libelle.boundingBox())!
  expect(l.x).toBeLessThan(b.x)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-parametres-lignes.png` })
})

test('Visites : plus de bouton de tournée par Coach, la tournée reste dans Semaine', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/visites')
  await expect(page.getByRole('heading', { level: 1, name: 'Visites' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Tournée de / })).toHaveCount(0)
})

test('fiche magasin : contacts à initiales, rôle sous le nom, pictos de 48 px', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('tab', { name: 'Fiche' }).click()
  await expect(page.getByText(/^Coach( · .*)?$/).first()).toBeVisible()
  for (const b of await page.getByRole('main').getByRole('link', { name: /^(Appeler|Écrire à) / }).all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-contacts.png`, fullPage: !isMobile })
})

test('Magasins : tri au choix, intertitres par lettre sans rangée de lettres', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  await expect(page.getByRole('region', { name: /^Magasins en [A-Z#]$/ }).first()).toBeVisible()
  await expect(page.getByRole('group', { name: 'Aller à la lettre' })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-magasins-lettres.png`, fullPage: !isMobile })

  // PC large : les titres des colonnes trient (sprint 21, D2) ; téléphone : plus de puces de tri, la page Visites suffit (Joseph, 22/10/2026)
  if (isMobile) {
    await expect(page.getByRole('group', { name: 'Trier par', exact: true })).toHaveCount(0)
    return
  }
  const tri = page.getByRole('group', { name: 'Trier par colonne' })
  await tri.getByRole('button', { name: 'Trier par CA vs N-1' }).click()
  await expect(page).toHaveURL(/tri=ca/)
  await expect(page.getByRole('region', { name: /^Magasins en / })).toHaveCount(0)
  await tri.getByRole('button', { name: 'Trier par dernière visite' }).click()
  await expect(page).toHaveURL(/tri=visite/)
})

test('Agenda : catégories en pastilles neutres, jours du mois en bande sur téléphone', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/plus/agenda')
  const categories = page.getByRole('group', { name: 'Catégories affichées' })
  const premiere = categories.getByRole('button').first()
  await expect(premiere).toHaveAttribute('aria-pressed', 'true')
  expect((await premiere.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await premiere.click()
  await expect(premiere).toHaveAttribute('aria-pressed', 'false')
  const jours = page.getByRole('group', { name: 'Jours du mois' })
  if (isMobile) {
    await expect(jours).toBeVisible()
    for (const b of (await jours.getByRole('button').all()).slice(0, 5)) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  } else await expect(jours).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-agenda-pastilles.png`, fullPage: !isMobile })
})

const communications = (): CommunicationSimulee[] => [
  { id: 1, titre: 'Nouvelle gamme', texte: 'Arrivée en magasin.', magasins: null, auteur: MOI, auteur_nom: 'Dominique DIRECTION', auteur_role: 'directeur', cree_le: '2026-10-20T09:00:00Z' },
  { id: 2, titre: 'Foire aux vins', texte: 'Le calendrier est en ligne.', magasins: null, auteur: '00000000-0000-0000-0000-0000000000dd', auteur_nom: 'Dominique DIRECTION', auteur_role: 'directeur', cree_le: '2026-10-01T09:00:00Z', a_la_une: '2099-01-15' },
]

test('une communication à la une passe en tête, sur le canal Réseau V and B comme dans les actualités de l’accueil', async ({ page, isMobile }, info) => {
  await seConnecter(page, { communications: communications() })
  await page.goto('./#/communications')
  const premiere = page.getByRole('article').first()
  await expect(premiere).toHaveAttribute('aria-label', 'Foire aux vins')
  await expect(premiere.getByText(/^À la une jusqu’au 15 janvier$/)).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-communication-a-la-une.png`, fullPage: !isMobile })
  await page.goto('./#/')
  await expect(page.getByText(/^À la une jusqu’au/).first()).toBeVisible()
})

test('le Directeur met une communication à la une jusqu’à une date', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { communications: communications(), ecritures })
  await page.goto('./#/infos')
  await page.getByRole('button', { name: 'Modifier la communication Nouvelle gamme' }).click()
  const fenetre = page.getByRole('dialog')
  const jour = new Date(Date.now() + 7 * 86400000).toLocaleDateString('sv-SE')
  await fenetre.getByLabel('À la une jusqu’au').fill(jour)
  await fenetre.getByRole('button', { name: /Publier|Enregistrer/ }).click()
  await expect.poll(() => ecritures.filter((e) => e.table === 'rpc/mettre_a_la_une').map((e) => e.corps)).toEqual([{ p_id: 1, p_jusqu_au: jour }])
  // Les deux sont à la une : elles restent en tête, dans l'ordre de publication
  await expect(page.getByRole('article', { name: 'Nouvelle gamme' }).getByText(/^À la une jusqu’au/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Communications' }).getByRole('article').nth(1)).toHaveAttribute('aria-label', 'Foire aux vins')
})

test('les écrans peu utilisés se chargent à la demande, avec une silhouette', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/parametres/reglages')
  await expect(page.getByRole('heading', { level: 1, name: 'Paramètres' })).toBeVisible()
  await page.goto('./#/plus/evolution')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
