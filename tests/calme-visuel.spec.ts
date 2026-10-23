import { expect, test, type Locator } from '@playwright/test'
import { COMPTE, seConnecter, simulerSupabase, textesTropPetits, deplierATraiter } from './supabase-simule'
import { magasinsFictifs } from './donnees-fictives'

// Une seule couleur forte par ligne, onglets qui tiennent sur l'écran du téléphone,
// « Voir plus » gardé au retour arrière (Joseph, 21/10/2026)

const fond = (l: Locator) => l.evaluate((e) => getComputedStyle(e).backgroundColor)
const transparent = 'rgba(0, 0, 0, 0)'

test('seul le rouge reste une pastille pleine ; le reste est un texte coloré', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  const aTraiter = page.getByRole('region', { name: 'À traiter' })
  await deplierATraiter(page)
  expect(await fond(aTraiter.getByText('Décroche', { exact: true }))).toBe('rgb(198, 40, 40)')
  await aTraiter.getByRole('button', { name: /^À voir · \d+$/ }).click()
  expect(await fond(aTraiter.getByText('Visite', { exact: true }).first())).toBe(transparent)
  await page.goto('./#/magasins')
  const liste = page.getByRole('main')
  // PC large : la dernière visite passe en colonne, l'alerte orange reste un texte coloré
  const orange = isMobile ? liste.getByText(/^vu il y a \d+ j$/).first() : liste.getByText('À surveiller', { exact: true }).first()
  await expect(orange).toBeVisible()
  expect(await fond(orange)).toBe(transparent)
  // La charge à 8/8 n'est plus pleine, le dépassement (9/8) l'est toujours
  await page.goto('./#/equipe')
  const charges = page.getByRole('main').locator('.MuiChip-root')
  expect(await fond(charges.filter({ hasText: '8 / 8' }).first())).toBe(transparent)
  expect(await fond(charges.filter({ hasText: '9 / 8' }).first())).not.toBe(transparent)
  expect(await textesTropPetits(page)).toEqual([])
  await page.goto('./#/magasins')
  await page.screenshot({ path: `captures/${info.project.name}-magasins-calme.png` })
})

test('fiche magasin : sur téléphone étroit, 3 onglets et « Plus » ; sur PC, tous les onglets', async ({ page, isMobile }, info) => {
  if (isMobile) await page.setViewportSize({ width: 390, height: 844 })
  await seConnecter(page)
  await page.goto('./#/magasins/Brest%20Test')
  const onglets = page.getByRole('tablist', { name: 'Rubriques de Brest Test' })
  if (!isMobile) {
    await expect(onglets.getByRole('tab')).toHaveText(['Fiche', 'Tâches et campagnes', 'Visites', 'Chiffres et santé', 'Journal', 'Bonnes pratiques'])
    return
  }
  await expect(onglets.getByRole('tab')).toHaveText(['Fiche', 'Tâches', 'Visites', 'Plus'])
  // Aucun onglet coupé au bord de l'écran
  const largeur = page.viewportSize()!.width
  for (const t of await onglets.getByRole('tab').all()) {
    const b = (await t.boundingBox())!
    expect(b.x + b.width).toBeLessThanOrEqual(largeur)
    expect(b.height).toBeGreaterThanOrEqual(48)
  }
  await onglets.getByRole('tab', { name: 'Autres rubriques' }).click()
  const panneau = page.getByRole('dialog', { name: 'Rubriques de Brest Test' })
  await expect(panneau.getByRole('button')).toHaveText(['Chiffres et santé', 'Journal', 'Bonnes pratiques'])
  for (const b of await panneau.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-onglets-plus.png` })
  await panneau.getByRole('button', { name: 'Chiffres et santé' }).click()
  await expect(page).toHaveURL(/vue=chiffres/)
  // L'onglet « Plus » prend le nom court de la rubrique ouverte
  const plus = onglets.getByRole('tab', { name: 'Chiffres et santé, autres rubriques' })
  await expect(plus).toHaveText('Chiffres')
  await expect(plus).toHaveAttribute('aria-selected', 'true')
  await page.screenshot({ path: `captures/${info.project.name}-onglet-journal.png` })
  await onglets.getByRole('tab', { name: 'Fiche' }).click()
  await expect(onglets.getByRole('tab', { name: 'Autres rubriques' })).toHaveText('Plus')
})

test('après « Voir plus », le retour arrière retrouve la liste aussi longue', async ({ page }) => {
  const magasins = Array.from({ length: 120 }, (_, i) => ({ ...magasinsFictifs[i % 24], n: `Grand${i} Test`, code: `G${i}` }))
  await simulerSupabase(page, { config: { store_adds: magasins } })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1, name: 'Accueil' }).waitFor({ state: 'attached' })
  await page.goto('./#/plus/sante?vue=evaluer')
  const lignes = page.getByRole('region', { name: 'Évaluation des magasins' }).getByRole('button', { name: /^Saisir Grand/ })
  await expect(lignes).toHaveCount(50)
  await page.getByRole('button', { name: /^Voir plus \(\d+\)$/ }).click()
  await expect(lignes).toHaveCount(100)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight - 2000))
  const avant = await page.evaluate(() => window.scrollY)
  await page.goto('./#/magasins')
  await expect(page.getByRole('heading', { level: 1, name: 'Magasins' })).toBeVisible()
  await page.goBack()
  await expect(lignes).toHaveCount(100)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(avant)
  // Déploiements, sur la même page, garde sa propre longueur
  await page.goto('./#/plus/sante?vue=deploiements')
  await expect(page.getByRole('region', { name: 'Déploiements par magasin' }).getByRole('button', { name: /^Saisir Grand/ })).toHaveCount(50)
})
