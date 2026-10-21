import { expect, test, type Page } from '@playwright/test'
import { COMPTE, seConnecter, simulerSupabase, textesTropPetits } from './supabase-simule'
import { magasinsFictifs } from './donnees-fictives'

// Tableaux Évaluer et Déploiements : « Voir plus » dans le tableau, tri et filtre par colonne (Joseph, 21/10/2026)

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const afficherTableau = (page: Page) => page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Tableau' }).click()
const premiers = async (page: Page, table: string, n: number) => {
  const liens = page.getByRole('table', { name: table }).locator('tbody tr').getByRole('link')
  return (await liens.allInnerTexts()).slice(0, n)
}

test('« Voir plus » agrandit le tableau d’Évaluer et de Déploiements', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Tableau réservé au PC')
  const magasins = Array.from({ length: 280 }, (_, i) => ({ ...magasinsFictifs[i % 24], n: `Grand${i} Test`, code: `G${i}` }))
  await simulerSupabase(page, { config: { store_adds: magasins } })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1, name: 'Accueil' }).waitFor({ state: 'attached' })
  for (const [vue, nom] of [['evaluer', 'Évaluation des magasins'], ['deploiements', 'Déploiements par magasin']]) {
    await page.goto(`./#/plus/sante?vue=${vue}`)
    await afficherTableau(page)
    const table = page.getByRole('table', { name: nom })
    const lignes = table.locator('tbody tr')
    await expect(lignes).toHaveCount(50)
    // « Voir plus » sous le tableau, atteint à la molette comme à la souris, puis le cadre montre les lignes ajoutées
    const voirPlus = page.getByRole('button', { name: /^Voir plus \(\d+\)$/ })
    await expect(page.locator('.MuiTableContainer-root').getByRole('button', { name: /^Voir plus/ })).toHaveCount(0)
    await page.mouse.move(700, 200)
    const sousLePointeur = async () => {
      const b = await voirPlus.boundingBox()
      if (!b || b.y + b.height > page.viewportSize()!.height) return false
      return page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.textContent?.startsWith('Voir plus') ?? false, [b.x + b.width / 2, b.y + b.height / 2])
    }
    for (let i = 0; i < 30 && !(await sousLePointeur()); i++) { await page.mouse.wheel(0, 600); await page.waitForTimeout(50) }
    expect(await sousLePointeur()).toBe(true)
    const b = (await voirPlus.boundingBox())!
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
    await expect(lignes).toHaveCount(100)
    await expect(lignes.nth(50)).toBeInViewport()
    await page.screenshot({ path: `captures/${info.project.name}-tableau-${vue}-voir-plus.png` })
  }
})

test('Évaluer : trier et filtrer chaque critère', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Tableau réservé au PC')
  await seConnecter(page)
  await page.goto('./#/plus/sante?vue=evaluer')
  await afficherTableau(page)
  const nom = 'Évaluation des magasins'
  const tri = page.getByRole('button', { name: 'Trier par CA marché extérieur' })
  await tri.click()
  await expect(page.getByRole('columnheader', { name: /CA marché extérieur/ })).toHaveAttribute('aria-sort', 'descending')
  await expect.poll(() => premiers(page, nom, 3)).toEqual(['Annecy Test', 'Nantes Test', 'Lyon Test'])
  await tri.click()
  await expect.poll(() => premiers(page, nom, 3)).toEqual(['Lyon Test', 'Nantes Test', 'Annecy Test'])
  await tri.click()
  await expect(page.getByRole('columnheader', { name: /CA marché extérieur/ })).not.toHaveAttribute('aria-sort', /./)

  // Filtre par valeur : seuls les magasins notés Fort restent
  await page.getByRole('button', { name: 'Filtrer Flux bar' }).click()
  await page.getByRole('menuitem', { name: /^Fort/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
  const liens = page.getByRole('table', { name: nom }).locator('tbody tr').getByRole('link')
  await expect(liens).toHaveText(['Annecy Test'])
  await page.screenshot({ path: `captures/${info.project.name}-tableau-evaluer-filtre.png` })
  // Filtre sur la case de la nine box, combiné : aucun magasin, puis tout afficher
  await page.getByRole('button', { name: 'Filtrer Case' }).click()
  await page.getByRole('menuitem', { name: /^Redressement/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
  await expect(page.getByText('Aucun magasin ne correspond à ces filtres.')).toBeVisible()
  await page.getByRole('button', { name: 'Effacer les filtres' }).click()
  await expect.poll(() => liens.count()).toBeGreaterThan(3)
  expect(await textesTropPetits(page)).toEqual([])
})

test('Déploiements : trier et filtrer thématique par thématique', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Tableau réservé au PC')
  await seConnecter(page)
  await page.goto('./#/plus/sante?vue=deploiements')
  await afficherTableau(page)
  const nom = 'Déploiements par magasin'
  await page.getByRole('button', { name: 'Trier par Concept 2.0' }).click()
  await expect.poll(() => premiers(page, nom, 2)).toEqual(['Lyon Test', 'Annecy Test'])
  await page.getByRole('button', { name: 'Filtrer Terrasse' }).click()
  await page.getByRole('menuitem', { name: /^Oui/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
  const liens = page.getByRole('table', { name: nom }).locator('tbody tr').getByRole('link')
  await expect(liens).toHaveText(['Lyon Test'])
  await page.screenshot({ path: `captures/${info.project.name}-tableau-deploiements-filtre.png` })
  await page.getByRole('button', { name: 'Effacer tri et filtres' }).click()
  await expect.poll(() => liens.count()).toBeGreaterThan(2)
  expect(await textesTropPetits(page)).toEqual([])
})

test('la colonne Magasin se trie de A à Z ou de Z à A et se filtre par nom', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Tableau réservé au PC')
  await seConnecter(page)
  for (const [vue, nom] of [['evaluer', 'Évaluation des magasins'], ['deploiements', 'Déploiements par magasin']]) {
    await page.goto(`./#/plus/sante?vue=${vue}`)
    await afficherTableau(page)
    const liens = page.getByRole('table', { name: nom }).locator('tbody tr').getByRole('link')
    const tous = await liens.allInnerTexts()
    const az = [...tous].sort((a, b) => a.localeCompare(b, 'fr'))
    const tri = page.getByRole('button', { name: 'Trier par Magasin' })
    await tri.click()
    await expect(page.getByRole('columnheader', { name: /^Magasin/ })).toHaveAttribute('aria-sort', 'ascending')
    await expect.poll(() => liens.allInnerTexts()).toEqual(az)
    await tri.click()
    await expect.poll(() => liens.allInnerTexts()).toEqual([...az].reverse())
    // Filtre : recherche dans la liste, puis deux magasins cochés
    await page.getByRole('button', { name: 'Filtrer Magasin' }).click()
    await page.getByRole('textbox', { name: 'Rechercher dans Magasin' }).fill('nan')
    await expect(page.getByRole('menuitem')).toHaveText(['Nantes Test'])
    await page.getByRole('menuitem', { name: 'Nantes Test' }).click()
    await page.getByRole('textbox', { name: 'Rechercher dans Magasin' }).fill('lyon')
    await page.getByRole('menuitem', { name: 'Lyon Test' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toBeHidden()
    await expect(liens).toHaveText(['Nantes Test', 'Lyon Test'])
    if (vue === 'evaluer') await page.screenshot({ path: `captures/${info.project.name}-tableau-magasin-filtre.png` })
    await page.getByRole('button', { name: 'Effacer tri et filtres' }).click()
    await expect.poll(() => liens.count()).toBe(tous.length)
  }
  expect(await textesTropPetits(page)).toEqual([])
})

test('sur téléphone, Évaluer et Déploiements restent en lignes', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Vue téléphone')
  await seConnecter(page)
  for (const [vue, region] of [['evaluer', 'Évaluation des magasins'], ['deploiements', 'Déploiements par magasin']]) {
    await page.goto(`./#/plus/sante?vue=${vue}`)
    await expect(page.getByRole('region', { name: region }).getByRole('button', { name: /^Saisir / }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^Trier par/ })).toHaveCount(0)
  }
  expect(await textesTropPetits(page)).toEqual([])
})
