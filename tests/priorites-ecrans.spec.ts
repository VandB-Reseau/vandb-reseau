import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

// « À traiter » trié par gravité, info utile à droite des magasins, photos en vignettes, compteurs de visites,
// nine box lisible au téléphone, équipe groupée par Responsable Régional (Joseph, 21/10/2026)

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('« À traiter » : les urgences d’abord, des puces pour filtrer', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  const bloc = page.getByRole('region', { name: 'À traiter' })
  const puces = bloc.getByRole('group', { name: 'Éléments à traiter affichés' })
  await expect(puces.getByRole('button').first()).toHaveText('Tout')
  await expect(puces.getByRole('button', { name: /^Urgent · \d+$/ })).toBeVisible()
  // La première ligne porte une pastille rouge
  await expect(bloc.getByRole('link').first()).toContainText(/Décroche|En retard|Redressement/)
  await puces.getByRole('button', { name: /^À voir · \d+$/ }).click()
  await expect(puces.getByRole('button', { name: /^À voir/ })).toHaveAttribute('aria-pressed', 'true')
  for (const l of await bloc.getByRole('link').all()) await expect(l).toContainText(/pas vu depuis|jamais visité/)
  for (const b of await puces.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-a-traiter-filtres.png`, fullPage: !isMobile })
})

test('Magasins : la dernière visite à droite, le rouge réservé au décrochage', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  const liste = page.getByRole('region', { name: 'Liste des magasins' })
  await expect(liste.getByText(/^vu il y a \d+ j$/).first()).toBeVisible()
  await expect(liste.getByText('Visite', { exact: true })).toHaveCount(0)
  const fond = (t: string) => liste.getByText(t, { exact: true }).first().evaluate((e) => getComputedStyle(e).backgroundColor)
  expect(await fond('Décroche')).toBe('rgb(198, 40, 40)')
  expect(await liste.getByText(/^vu il y a \d+ j$/).first().evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  await page.screenshot({ path: `captures/${info.project.name}-magasins-derniere-visite.png` })
})

test('une photo seule reste une vignette et s’ouvre en plein écran', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  const photos = page.getByRole('region', { name: 'Photos' })
  const vignette = photos.getByRole('button', { name: 'Agrandir la photo 1' })
  const v = (await vignette.boundingBox())!
  expect(v.width).toBeLessThanOrEqual(170)
  expect(Math.abs(v.width - v.height)).toBeLessThanOrEqual(2)
  await vignette.click()
  const plein = page.getByRole('dialog', { name: 'Photos' })
  await expect(plein.getByText('1 / 1')).toBeVisible()
  expect((await plein.getByRole('button', { name: 'Fermer' }).boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await page.screenshot({ path: `captures/${info.project.name}-photo-plein-ecran.png` })
  await plein.getByRole('button', { name: 'Fermer' }).click()
  await expect(plein).toHaveCount(0)
})

test('Visites : trois compteurs sur une ligne, « pas vus » filtre la liste', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/visites')
  const pasVus = page.getByRole('button', { name: /^\d+ pas vus$/ })
  const [faites, reference] = [page.getByText(/^faites?$/), page.getByText('référence', { exact: true })]
  const y = async (l: typeof pasVus) => { const b = (await l.boundingBox())!; return b.y + b.height / 2 }
  expect(Math.abs((await y(faites)) - (await y(reference)))).toBeLessThanOrEqual(2)
  expect(Math.abs((await y(faites)) - (await y(pasVus.getByText('pas vus'))))).toBeLessThanOrEqual(2)
  expect((await pasVus.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  const n = Number((await pasVus.textContent())!.match(/\d+/)![0])
  await pasVus.click()
  await expect(pasVus).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'Par magasin' }).locator('..')).toContainText(String(n))
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-visites-compteurs.png`, fullPage: !isMobile })
})

test('nine box : cases vides discrètes, Coachs en initiales sans chevauchement', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/plus/sante?vue=ninebox')
  const grille = page.getByRole('table', { name: 'Nine box' })
  await expect(grille).toBeVisible()
  // Les Coachs en initiales sous le chiffre
  await expect(grille.getByText(/^[A-Z]{2} \d+$/).first()).toBeVisible()
  for (const cellule of await grille.getByRole('cell').all()) {
    const libelle = (await cellule.getAttribute('aria-label'))!
    if (libelle.endsWith(': 0 magasin')) {
      const zero = cellule.getByText('0', { exact: true })
      expect(Number((await zero.evaluate((e) => getComputedStyle(e).fontSize)).replace('px', ''))).toBeLessThanOrEqual(20)
    }
    // Rien ne dépasse de la case
    const c = (await cellule.boundingBox())!
    for (const t of await cellule.locator('p, span').all()) {
      const b = await t.boundingBox()
      if (b) expect(b.x + b.width).toBeLessThanOrEqual(c.x + c.width + 1)
    }
  }
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-ninebox-initiales.png`, fullPage: !isMobile })
})

test('Équipe en liste : un intertitre par Responsable Régional, ses Coachs en lignes', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe?forme=liste')
  const region = page.getByRole('region', { name: 'Alex NORD' })
  await expect(region.getByRole('heading', { level: 3, name: 'Alex NORD' })).toBeVisible()
  const coachs = region.getByRole('region', { name: 'Coachs de Alex NORD' })
  await expect(coachs.getByRole('link').first()).toBeVisible()
  await expect(coachs.locator('.MuiChip-root').first()).toHaveText(/^\d+ \/ \d+$/)
  await expect(page.getByRole('button', { name: /Déplier|Replier/ })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-equipe-liste-rr.png`, fullPage: !isMobile })
})

test('Paramètres : un sommaire avec la valeur clé, une rubrique par écran', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/parametres/reglages')
  const sommaire = page.getByRole('region', { name: 'Rubriques des paramètres' })
  await expect(sommaire.getByRole('button', { name: 'Règle de charge' })).toContainText(/Charge maximale \d+/)
  await expect(sommaire.getByRole('button', { name: 'Alerte de visite' })).toContainText(/\d+ j/)
  for (const b of await sommaire.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  if (isMobile) {
    // Le sommaire seul, sans les réglages
    await expect(page.getByLabel('Charge maximale d’un Coach')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(2000)
  } else await expect(page.getByLabel('Charge maximale d’un Coach')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-parametres-sommaire.png` })
  await sommaire.getByRole('button', { name: 'Alerte de visite' }).click()
  await expect(page).toHaveURL(/rubrique=visite/)
  await expect(page.getByLabel('Redressement urgent (jours sans visite)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible()
  if (isMobile) {
    await expect(page.getByRole('heading', { name: 'Alerte de visite' })).toBeVisible()
    await expect(sommaire).toHaveCount(0)
    await page.screenshot({ path: `captures/${info.project.name}-parametres-rubrique.png` })
    await page.getByRole('button', { name: 'Paramètres' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Paramètres')
  }
})

const annonce = (lus: string[], nonLus: string[]) => [{ id: 1, titre: 'Foire aux vins', texte: 'Le calendrier est en ligne.', magasins: null, auteur: '00000000-0000-0000-0000-0000000000dd',
  auteur_nom: 'Dominique DIRECTION', auteur_role: 'directeur', cree_le: '2026-10-20T09:00:00Z', lus, non_lus: nonLus }]

test('communications : le Directeur voit qui a lu, et qui ne l’a pas encore lue', async ({ page, isMobile }, info) => {
  await seConnecter(page, { communications: annonce(['Paul MULTI'], ['Claire FICTIVE', 'Marc EXEMPLE']) })
  await page.goto('./#/communications')
  const carte = page.getByRole('article', { name: 'Foire aux vins' })
  const lecture = carte.getByRole('button', { name: /Lue par 1 franchisé sur 3/ })
  await expect(lecture).toBeVisible()
  expect((await lecture.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await lecture.click()
  await expect(carte.getByText('Claire FICTIVE, Marc EXEMPLE')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-communication-lecture.png`, fullPage: !isMobile })
})

test('communications : le franchisé qui les affiche les a lues', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] }, ecritures, communications: annonce([], ['Paul MULTI']) })
  await page.goto('./#/communications')
  await expect(page.getByRole('article', { name: 'Foire aux vins' })).toBeVisible()
  await expect.poll(() => ecritures.filter((e) => e.table === 'rpc/lire_communications').map((e) => e.corps)).toEqual([{ p_ids: [1] }])
  // Le franchisé ne voit pas la ligne de lecture
  await expect(page.getByText(/Lue par/)).toHaveCount(0)
})
