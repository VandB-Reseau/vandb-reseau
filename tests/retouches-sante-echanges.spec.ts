import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Retouches de Joseph (22/10/2026) : filtre Alerte à côté du Coach, une vingtaine de déploiements lisibles,
// plus de puces de tri sur la liste des magasins au téléphone

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const ouiNon = [{ libelle: 'Oui', ton: 'positif' }, { libelle: 'En cours', ton: 'partiel' }, { libelle: 'Non', ton: 'negatif' }]
const thematiques = Array.from({ length: 20 }, (_, i) => ({ id: `th${i + 1}`, libelle: `Thématique fictive ${i + 1}`, options: ouiNon }))
const valeurs = Object.fromEntries(thematiques.slice(0, 14).map((t, i) => [t.id, ['Oui', 'Oui', 'En cours', 'Non'][i % 4]]))
const config = { deploiements: { thematiques, valeurs: { 'Lyon Test': valeurs, 'Annecy Test': { th1: 'Oui' } }, journal: {} } }
const sansDefilementHorizontal = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

test('Santé du parc, Chiffres : le filtre Alerte est juste à côté du filtre Coach', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/plus/sante?vue=chiffres')
  if (isMobile) await page.getByRole('button', { name: 'Filtres' }).click()
  const coach = page.getByRole('button', { name: 'Filtre Coach' })
  const alerte = page.getByRole('button', { name: 'Filtre Alerte' })
  await expect(alerte).toBeVisible()
  const c = (await coach.boundingBox())!, a = (await alerte.boundingBox())!
  if (!isMobile) {
    expect(Math.abs(c.y - a.y)).toBeLessThan(4)
    expect(a.x - (c.x + c.width)).toBeLessThan(16)
  }
  await alerte.click()
  await page.getByRole('menuitem', { name: /Décroche/ }).click()
  await page.keyboard.press('Escape')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-chiffres-filtre-alerte.png` })
})

test('vingt déploiements restent lisibles sur la fiche magasin', async ({ page }, info) => {
  await seConnecter(page, { config })
  await page.goto('./#/magasins/Lyon%20Test?vue=chiffres')
  await page.getByRole('heading', { name: 'Déploiements', exact: true }).scrollIntoViewIfNeeded()
  await expect(page.getByText('sur 20 thématiques déployées')).toBeVisible()
  const pas = page.getByRole('region', { name: 'Pas déployé' })
  await expect(pas.getByRole('listitem')).toHaveCount(3)
  await expect(page.getByRole('region', { name: 'En partie' }).getByRole('listitem').first()).toHaveAccessibleName('Thématique fictive 3 : En cours')
  await expect(page.getByRole('region', { name: 'Déployé', exact: true }).getByRole('listitem')).toHaveCount(8)
  await expect(page.getByRole('region', { name: 'Non renseigné' }).getByRole('listitem')).toHaveCount(6)
  expect(await textesTropPetits(page)).toEqual([])
  expect(await sansDefilementHorizontal(page)).toBe(true)
  await page.screenshot({ path: `captures/${info.project.name}-fiche-20-deploiements.png` })
})

test('vingt déploiements dans l’onglet Déploiements : avancement en grille, points sur deux rangées', async ({ page, isMobile }, info) => {
  await seConnecter(page, { config })
  await page.goto('./#/plus/sante?vue=deploiements')
  const avancement = page.getByRole('region', { name: 'Avancement des déploiements' })
  if (isMobile) {
    await expect(avancement.getByRole('img')).toHaveCount(5)
    await avancement.getByRole('button', { name: 'Voir les 20 thématiques' }).click()
  }
  await expect(avancement.getByRole('img')).toHaveCount(20)
  if (!isMobile) {
    const points = page.getByRole('img', { name: '8 thématiques déployées sur 20' })
    const b = (await points.boundingBox())!
    expect(b.width).toBeLessThan(140)
  }
  expect(await textesTropPetits(page)).toEqual([])
  expect(await sansDefilementHorizontal(page)).toBe(true)
  await page.screenshot({ path: `captures/${info.project.name}-onglet-20-deploiements.png`, fullPage: !isMobile })
})

test('Magasins : plus de puces de tri au-dessus de la liste', async ({ page }) => {
  await seConnecter(page)
  await page.setViewportSize({ width: 1000, height: 800 })
  await page.goto('./#/magasins')
  await expect(page.getByRole('region', { name: /^Magasins en [A-Z#]$/ }).first()).toBeVisible()
  await expect(page.getByRole('group', { name: 'Trier par', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Dernière visite', exact: true })).toHaveCount(0)
})

test('plus de bouton Exporter sur les listes, les exports complets restent dans Paramètres', async ({ page, isMobile }) => {
  await seConnecter(page)
  for (const ecran of ['./#/magasins?vue=liste', './#/visites?vue=historique', './#/plus/sante?vue=evaluer', './#/plus/sante?vue=deploiements']) {
    await page.goto(ecran)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Exporter', exact: true })).toHaveCount(0)
  }
  if (isMobile) return
  await page.goto('./#/parametres/donnees')
  await expect(page.getByRole('button', { name: 'Exporter Magasins', exact: true })).toBeVisible()
})
