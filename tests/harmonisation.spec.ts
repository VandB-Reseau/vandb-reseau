import { expect, test } from '@playwright/test'
import { COMPTE, seConnecter, simulerSupabase, textesTropPetits } from './supabase-simule'
import { magasinsFictifs } from './donnees-fictives'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('le titre de chaque onglet est à la même place, sans grand blanc au-dessus', async ({ page }) => {
  await seConnecter(page)
  const positions: number[] = []
  for (const [chemin, titre] of [['/', 'Accueil'], ['/magasins', 'Magasins'], ['/visites', 'Visites'], ['/plus/sante', 'Santé du parc'], ['/communications', 'Communications'], ['/plus/agenda', 'Agenda']]) {
    await page.goto(`./#${chemin}`)
    const h1 = page.getByRole('heading', { level: 1, name: titre })
    await expect(h1).toBeVisible()
    positions.push(Math.round((await h1.boundingBox())!.y))
  }
  expect(new Set(positions).size).toBe(1)
  expect(positions[0]).toBeLessThan(140)
})

test('Évaluer et Déploiements montrent un grand réseau par tranches avec « Voir plus »', async ({ page, isMobile }, info) => {
  const magasins = Array.from({ length: 280 }, (_, i) => ({ ...magasinsFictifs[i % 24], n: `Grand${i} Test`, code: `G${i}` }))
  await simulerSupabase(page, { config: { store_adds: magasins } })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1, name: 'Accueil' }).waitFor({ state: 'attached' })
  for (const [vue, region] of [['evaluer', 'Évaluation des magasins'], ['deploiements', 'Déploiements par magasin']]) {
    await page.goto(`./#/plus/sante?vue=${vue}`)
    const lignes = page.getByRole('region', { name: region }).getByRole('button', { name: /^Saisir Grand/ })
    await expect(lignes).toHaveCount(50)
    await page.getByRole('button', { name: /^Voir plus \(\d+\)$/ }).click()
    await expect(lignes).toHaveCount(100)
    // La recherche retrouve n'importe quel magasin, même au-delà de la première tranche
    await page.getByRole('combobox', { name: 'Rechercher un magasin ou un Coach' }).fill('Grand279')
    await page.keyboard.press('Escape')
    await expect(lignes).toHaveCount(1)
    await page.getByRole('combobox', { name: 'Rechercher un magasin ou un Coach' }).fill('')
  }
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-deploiements-lignes.png`, fullPage: !isMobile })
})

test('thématiques, imports et remise à zéro des notes sont dans les Paramètres', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/parametres/reglages')
  const th = page.getByRole('region', { name: 'Thématiques de déploiement' })
  await expect(th.getByRole('button', { name: 'Gérer les thématiques' })).toBeVisible()
  await expect(th).toContainText('Terrasse')
  await expect(page.getByRole('region', { name: 'Notes de la nine box' }).getByRole('button', { name: 'Effacer toutes les notes' })).toBeVisible()
  await page.goto('./#/parametres/donnees')
  for (const f of ['Classeur des visites', 'Export Asana de la santé du parc', 'Export mensuel des chiffres']) {
    await expect(page.getByRole('button', { name: `Importer le fichier : ${f}` })).toBeVisible()
  }
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-parametres-imports.png`, fullPage: !isMobile })
})
