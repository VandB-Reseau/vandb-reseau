import { expect, test, type Locator } from '@playwright/test'
import { COMPTE, seConnecter, simulerSupabase, textesTropPetits, deplierATraiter, deplierGroupes } from './supabase-simule'
import { magasinsFictifs } from './donnees-fictives'

// Une seule couleur forte par ligne, onglets qui tiennent sur l'écran du téléphone,
// « Voir plus » gardé au retour arrière (Joseph, 21/10/2026)

const fond = (l: Locator) => l.evaluate((e) => getComputedStyle(e).backgroundColor)
const transparent = 'rgba(0, 0, 0, 0)'

// 361 (Joseph, 23/11/2026) : les statuts deviennent des badges teintés (fond pâle, texte foncé), rouge compris ;
// les étiquettes de type restent sans fond
test('statuts en badges teintés, aucune pastille pleine ; les types restent sans fond', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  const aTraiter = page.getByRole('region', { name: 'À traiter' })
  await deplierATraiter(page)
  expect(await fond(aTraiter.getByText('Décroche', { exact: true }))).toBe('rgba(194, 65, 25, 0.14)')
  await aTraiter.getByRole('button', { name: /^À voir · \d+$/ }).click()
  await deplierGroupes(page)
  expect(await fond(aTraiter.getByText('Visite', { exact: true }).first())).toBe(transparent)
  await page.goto('./#/magasins')
  const liste = page.getByRole('main')
  // PC large : l'alerte orange est un badge teinté dans la colonne Statut
  const orange = isMobile ? liste.getByText(/^vu il y a \d+ j$/).first() : liste.getByText('À surveiller', { exact: true }).first()
  await expect(orange).toBeVisible()
  if (!isMobile) expect(await fond(orange)).toBe('rgba(234, 96, 41, 0.14)')
  // La charge à 8/8 n'est plus pleine, le dépassement (9/8) l'est toujours
  await page.goto('./#/equipe')
  const charges = page.getByRole('main').locator('.MuiChip-root')
  // Charge à 8/8 en badge orange, dépassement (9/8) en badge rouge
  expect(await fond(charges.filter({ hasText: '8 / 8' }).first())).toBe('rgba(234, 96, 41, 0.14)')
  expect(await fond(charges.filter({ hasText: '9 / 8' }).first())).toBe('rgba(194, 65, 25, 0.14)')
  expect(await textesTropPetits(page)).toEqual([])
  await page.goto('./#/magasins')
  await page.screenshot({ path: `captures/${info.project.name}-magasins-calme.png` })
})

test('fiche magasin : tous les onglets, sur téléphone dans une bande qui défile (Joseph, 17/11/2026)', async ({ page, isMobile }, info) => {
  if (isMobile) await page.setViewportSize({ width: 360, height: 780 })
  await seConnecter(page)
  await page.goto('./#/magasins/Brest%20Test')
  const onglets = page.getByRole('tablist', { name: 'Rubriques de Brest Test' })
  if (!isMobile) {
    // Refonte (Joseph, 09/11/2026, 3A) ; Simulateurs à côté de Chiffres et Budget (Joseph, 14/11/2026)
    await expect(onglets.getByRole('tab')).toHaveText(['Vue d’ensemble', 'Tâches', 'Chiffres', 'Budget', 'Simulateurs', 'Marché extérieur', 'Nine box', 'Équipements', 'Historique'])
    return
  }
  // Joseph (17/11/2026) : tous les onglets présents, la bande défile vers la droite, sans « Plus »
  await expect(onglets.getByRole('tab')).toHaveText(['Vue d’ensemble', 'Tâches', 'Chiffres', 'Budget', 'Simulateurs', 'Marché extérieur', 'Nine box', 'Équipements', 'Historique'])
  for (const t of await onglets.getByRole('tab').all()) expect((await t.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await textesTropPetits(page)).toEqual([])
  await onglets.getByRole('tab', { name: 'Nine box' }).click()
  await expect(page).toHaveURL(/vue=ninebox/)
  await onglets.getByRole('tab', { name: 'Vue d’ensemble' }).click()
  await expect(page).not.toHaveURL(/vue=/)
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
