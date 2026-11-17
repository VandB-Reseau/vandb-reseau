import { expect, test } from '@playwright/test'
import { deplierPoint, seConnecter, textesTropPetits } from './supabase-simule'

// Accueil de pilotage (maquette A, Joseph 22/10/2026, revue le 09/11/2026) : quatre repères, À traiter, Mes tâches et
// Cette semaine au centre, actualités à droite ; sur téléphone, ces trois blocs en onglets courts au-dessus des actualités

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('quatre repères de pilotage en tête de l’accueil, chacun mène à son détail', async ({ page, isMobile }) => {
  await seConnecter(page)
  // 278 : sur téléphone, Le point s'ouvre par le picto de la barre du haut
  await deplierPoint(page)
  const pilotage = page.getByRole('region', { name: 'Pilotage' })
  const tuiles = pilotage.getByRole('link')
  await expect(tuiles).toHaveCount(4)
  await expect(tuiles.nth(0)).toHaveAccessibleName(/^CA (de|du) /)
  await expect(tuiles.nth(1)).toHaveAccessibleName(/^Décrochent : (\d+|Aucun)/)
  await expect(tuiles.nth(2)).toHaveAccessibleName(/^Visites de l’année : \d+( faites)?, \d+ (d’avance|de retard) sur le repère|^Visites de l’année : \d+, pas de repère/)
  await expect(tuiles.nth(3)).toHaveAccessibleName(/^Santé du parc : (\d+|Aucun), prioritaires? sur \d+ classés|^Santé du parc : À classer/)
  await tuiles.nth(3).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Santé du parc' })).toBeVisible()
})

// Refonte vague 5 (Joseph, 10/11/2026, 43A, revient sur 7A) : les actualités au centre, « Aujourd'hui » à droite
test('PC : les actualités au centre, À traiter, Mes tâches et Cette semaine à droite dès l’arrivée', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Disposition du PC')
  await seConnecter(page)
  const actualites = page.getByRole('region', { name: 'Actualités' })
  await expect(actualites).toBeVisible()
  await expect(actualites).toBeInViewport()
  const colonne = page.getByRole('complementary', { name: 'Aujourd’hui' })
  const traiter = colonne.getByRole('region', { name: 'À traiter' })
  await expect(traiter).toBeVisible()
  await expect(page.getByRole('region', { name: 'Mes tâches' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Mes tâches' }).getByRole('link', { name: 'Toutes' })).toHaveAttribute('href', '#/taches')
  const a = (await actualites.boundingBox())!
  const t = (await traiter.boundingBox())!
  expect(a.x + a.width).toBeLessThanOrEqual(t.x)
  expect(t.y).toBeLessThan(page.viewportSize()!.height / 2)
  // Les repères au-dessus des deux colonnes
  const p = (await page.getByRole('region', { name: 'Pilotage' }).boundingBox())!
  expect(p.y + p.height).toBeLessThanOrEqual(t.y)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-accueil-pilotage.png` })
})

// Choix 278 (Joseph, 17/11/2026) : le fil seul, façon LinkedIn ; « Mon point du jour » passe en picto dans la barre du
// haut, avec le nombre à traiter, et ouvre une page : Le point en lignes, puis À traiter groupé par sujet à onglets
test('278 : téléphone, le fil seul et le point du jour en picto dans la barre du haut', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Disposition du téléphone')
  await seConnecter(page)
  const picto = page.getByRole('banner').getByRole('button', { name: /^Mon point du jour, \d+ à traiter/ })
  await expect(picto).toBeVisible()
  const b = (await picto.boundingBox())!
  expect(b.width).toBeGreaterThanOrEqual(48)
  expect(b.height).toBeGreaterThanOrEqual(48)
  // Le fil ouvre la page, plus de bande au-dessus
  await expect(page.getByRole('main').getByRole('region').first()).toHaveAttribute('aria-label', 'Actualités')
  await expect(page.getByRole('region', { name: 'Pilotage' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await picto.click()
  const point = page.getByRole('dialog', { name: 'Mon point du jour' })
  // Le point en quatre lignes, comme sur PC
  const pilotage = point.getByRole('region', { name: 'Pilotage' })
  await expect(pilotage.getByRole('link')).toHaveCount(4)
  const lignes = await Promise.all((await pilotage.getByRole('link').all()).map(async (l) => (await l.boundingBox())!))
  for (let k = 1; k < 4; k++) expect(lignes[k].y).toBeGreaterThanOrEqual(lignes[k - 1].y + lignes[k - 1].height - 1)
  // Proportions (Joseph, 17/11/2026) : chaque valeur à la taille de son libellé, pas plus grande
  const tailles = await pilotage.getByRole('link').evaluateAll((ls) => ls.map((l) => [...l.querySelectorAll('p')].slice(0, 2).map((x) => parseFloat(getComputedStyle(x).fontSize))))
  for (const [libelle, valeur] of tailles) expect(valeur).toBeLessThanOrEqual(libelle)
  await expect(point.getByRole('group', { name: 'Période des chiffres' })).toBeVisible()
  const onglets = point.getByRole('tablist', { name: 'Mon point' }).getByRole('tab')
  await expect(onglets).toHaveText([/^À traiter/, /^Tâches/, 'Semaine', /^Contrats/])
  for (const o of await onglets.all()) expect((await o.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  // À traiter groupé par sujet, comme sur PC : un groupe se déplie
  const traiter = point.getByRole('region', { name: 'À traiter' })
  await traiter.getByRole('button', { name: /^Voir les \d+$/ }).click()
  const groupe = traiter.locator('button[aria-expanded="false"]').first()
  await expect(groupe).toBeVisible()
  await groupe.click()
  await expect(traiter.locator('button[aria-expanded="true"]').first()).toBeVisible()
  await onglets.nth(1).click()
  await expect(point.getByRole('region', { name: 'Mes tâches' })).toBeVisible()
  await onglets.nth(2).click()
  await expect(point.getByRole('region', { name: 'Cette semaine' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await point.getByRole('button', { name: 'Fermer' }).click()
  await expect(point).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Actualités' })).toBeVisible()
})
