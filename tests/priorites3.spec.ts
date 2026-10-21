import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Priorités 3 des propositions par onglet (Joseph, 21/10/2026) : filtres actifs en puces,
// fiche magasin à trois pictos et un menu, historique des visites par mois, postes à pourvoir dans l'équipe

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('Magasins sur téléphone : les filtres actifs restent visibles en puces, une croix pour chacun', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'Les filtres sont repliés sur téléphone')
  await seConnecter(page)
  await page.goto('./#/magasins')
  await page.getByRole('button', { name: /^Filtres/ }).click()
  await page.getByRole('button', { name: 'Filtre Type' }).click()
  await page.getByRole('menuitem', { name: /^Intégré/ }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /^Filtres/ }).click()
  const puces = page.getByRole('group', { name: 'Filtres actifs' })
  const puce = puces.getByRole('button', { name: 'Retirer le filtre Intégré' })
  await expect(puce).toBeVisible()
  expect((await puce.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-magasins-filtres-actifs.png` })
  await puce.click()
  await expect(puces).toHaveCount(0)
})

test('fiche magasin : trois pictos, Planifier, Préparer et Modifier dans « Autres actions »', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByRole('heading', { level: 1, name: 'Lyon Test' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Planifier la visite' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Autres actions' }).click()
  const menu = page.getByRole('menu')
  for (const nom of ['Planifier la visite', 'Préparer la visite', 'Modifier la fiche']) expect((await menu.getByRole('menuitem', { name: nom }).boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await page.screenshot({ path: `captures/${info.project.name}-fiche-autres-actions.png` })
  await menu.getByRole('menuitem', { name: 'Préparer la visite' }).click()
  await expect(page).toHaveURL(/preparer/)
})

test('historique des visites : un intertitre par mois avec son nombre de visites', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/visites?vue=historique')
  const visites = page.getByRole('region', { name: 'Visites' })
  const intertitre = visites.getByRole('heading', { level: 2 }).first()
  await expect(intertitre).toHaveText(/^[a-zéû]+ \d{4} · \d+ visites?$/i)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-historique-par-mois.png`, fullPage: !isMobile })
})

test('équipe en liste : le poste à pourvoir est une ligne grisée à la fin de sa région', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe?forme=liste')
  const ligne = page.getByRole('link', { name: /Poste NORD/ })
  await expect(ligne).toContainText(/À recruter · \d+ magasins? en attente/)
  const region = page.getByRole('region', { name: /^Coachs de / }).filter({ has: ligne })
  await expect(region.getByRole('link').last()).toContainText('Poste NORD')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-equipe-poste-a-pourvoir.png`, fullPage: !isMobile })
})
