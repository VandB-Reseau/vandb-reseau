import { expect, test } from '@playwright/test'
import { COMPTE, seConnecter, simulerSupabase, textesTropPetits } from './supabase-simule'

// Barre du bas sur téléphone : libellé court ; menu latéral sur PC : libellé long
const principales = [
  { nom: 'Accueil', court: 'Accueil' },
  { nom: 'Magasins', court: 'Magasins' },
  { nom: 'Visites', court: 'Visites' },
  { nom: 'Santé du parc', court: 'Santé' },
]
// Hors de la barre du bas : dans le menu du compte sur téléphone
const secondaires = ['Agenda', 'Équipe', 'Évolution du parc', 'Collaborateurs', 'Franchisés', 'Paramètres']

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})

test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('un mauvais mot de passe affiche un message clair', async ({ page }) => {
  await simulerSupabase(page)
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill('faux')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByText('Email ou mot de passe incorrect.')).toBeVisible()
})

test('après connexion, l’accueil montre les priorités dans l’ordre choisi', async ({ page }, info) => {
  await seConnecter(page)
  const aTraiter = page.getByRole('region', { name: 'À traiter' })
  await expect(aTraiter).toBeVisible()
  await expect(page.getByRole('region', { name: 'Cette semaine' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Fil de mes magasins' })).toBeVisible()
  // Cinq lignes d'abord, puis tout
  await expect(aTraiter.getByRole('link')).toHaveCount(5)
  await aTraiter.getByRole('button', { name: /^Voir les \d+$/ }).click()
  // Chaque ligne porte une seule pastille (la plus grave), dans l'ordre de priorité choisi
  const pastilles = (await aTraiter.getByRole('link').allInnerTexts()).map((t) => t.trim().split('\n').at(-1)!.trim())
  expect([...new Set(pastilles)]).toEqual([
    'Décroche',
    'À surveiller',
    'En retard',
    'Visite',
    'Recule',
    'Surchargé',
    'Vacant',
    'Ouverture',
  ])
  await expect(aTraiter.getByRole('link').first()).toContainText('Lyon Test')
  await aTraiter.getByRole('button', { name: 'Afficher moins' }).click()
  await page.screenshot({ path: `captures/${info.project.name}-accueil.png`, fullPage: true })
})

test('chaque destination est accessible depuis la navigation', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav.getByRole('button', { name: 'Créer' })).toBeVisible()
  for (const { nom, court } of principales) {
    await nav.getByRole('button', { name: isMobile ? court : nom, exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: nom, exact: true })).toBeAttached()
    if (nom !== 'Accueil') await expect(page.getByRole('heading', { level: 1, name: nom, exact: true })).toBeVisible()
  }
  for (const nom of secondaires) {
    if (isMobile) {
      await expect(nav.getByRole('button', { name: nom, exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Mon compte' }).click()
      await page.getByRole('menu').getByRole('menuitem', { name: nom, exact: true }).click()
    } else {
      await nav.getByRole('button', { name: nom, exact: true }).click()
    }
    await expect(page.getByRole('heading', { level: 1, name: nom, exact: true })).toBeVisible()
  }
  if (isMobile) {
    await page.getByRole('button', { name: 'Mon compte' }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await page.screenshot({ path: `captures/${info.project.name}-plus.png`, fullPage: true })
  } else {
    await nav.getByRole('button', { name: 'Magasins' }).click()
    await page.screenshot({ path: `captures/${info.project.name}-magasins.png` })
  }
})

test('aucun texte sous 12 px', async ({ page }) => {
  await seConnecter(page)
  expect(await textesTropPetits(page)).toEqual([])
  await page.goto('./#/plus')
  expect(await textesTropPetits(page)).toEqual([])
  await page.getByRole('button', { name: 'Mon compte' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
})

test('zones tactiles d’au moins 48 px sur téléphone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'téléphone uniquement')
  await seConnecter(page)
  const boutons = page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button')
  await expect(boutons).toHaveCount(5)
  await expect(boutons.nth(2)).toHaveAccessibleName('Créer')
  for (const b of await boutons.all()) {
    const box = await b.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(48)
    expect(box!.width).toBeGreaterThanOrEqual(48)
  }
})

test('le mode sombre suit le réglage de l’appareil', async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await seConnecter(page)
  const fond = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(fond).toBe('rgb(18, 18, 20)')
  await page.screenshot({ path: `captures/${info.project.name}-sombre.png` })
})

test('la déconnexion ramène à l’écran de connexion', async ({ page }) => {
  await seConnecter(page)
  await page.getByRole('button', { name: 'Mon compte' }).click()
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click()
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
})

test('le menu a deux parties : la partie classique et Paramètres', async ({ page, isMobile }) => {
  await seConnecter(page)
  if (isMobile) {
    await page.getByRole('button', { name: 'Mon compte' }).click()
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem', { name: 'Agenda' })).toBeVisible()
    await expect(menu.getByText('Paramètres', { exact: true }).first()).toBeVisible()
    return
  }
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav.getByRole('button', { name: 'Accueil' })).toBeVisible()
  await expect(nav.getByText('Paramètres', { exact: true }).first()).toBeVisible()
  await page.goto('./#/equipe?vue=franchises')
  await expect(page).toHaveURL(/#\/parametres\/franchises/)
})

test('Équipe ouvre le groupe Paramètres', async ({ page, isMobile }) => {
  await seConnecter(page)
  if (isMobile) {
    await page.getByRole('button', { name: 'Mon compte' }).click()
    const menu = page.getByRole('menu')
    // Juste sous le titre « Paramètres » ; la partie classique (au-dessus) ne le contient pas
    const titre = menu.locator('li', { hasText: /^Paramètres$/ }).first()
    await expect(titre.locator('xpath=following-sibling::*[1]')).toHaveText('Équipe')
    await expect(menu.getByRole('menuitem').first()).toHaveText('Agenda')
  } else {
    const groupe = page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('list').filter({ hasText: 'Paramètres' }).last()
    await expect(groupe.getByRole('button').first()).toHaveText('Équipe')
    const classique = page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('list').first()
    await expect(classique.getByRole('button', { name: 'Équipe' })).toHaveCount(0)
  }
})
