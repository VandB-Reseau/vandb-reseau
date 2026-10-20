import { expect, test } from '@playwright/test'
import { COMPTE, seConnecter, simulerSupabase, textesTropPetits } from './supabase-simule'

const principales = ['Magasins', 'Visites', 'Santé du parc']
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
  await expect(page.locator('main h2').first()).toBeVisible()
  const titres = await page.locator('main h2').allTextContents()
  expect(titres).toEqual([
    'Magasins qui décrochent',
    'Magasins qui sous-performent',
    'Visites en retard',
    'Actions à échéance',
    'Campagnes en cours',
    'Mandats à renouveler',
    'Changements de case',
    'Agenda de la semaine',
    'Coachs surchargés et postes vacants',
    'Ouvertures à préparer',
  ])
  await page.screenshot({ path: `captures/${info.project.name}-accueil.png`, fullPage: true })
})

test('chaque destination est accessible depuis la navigation', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  for (const nom of principales) {
    await nav.getByRole('button', { name: nom }).click()
    await expect(page.getByRole('heading', { level: 1, name: nom })).toBeVisible()
  }
  for (const nom of secondaires) {
    if (isMobile) {
      await nav.getByRole('button', { name: 'Plus' }).click()
      await page.getByRole('main').getByRole('button', { name: new RegExp(`^${nom}`) }).click()
    } else {
      await nav.getByRole('button', { name: nom }).click()
    }
    if (nom === 'Carte') await expect(page.getByRole('tab', { name: 'Carte', selected: true })).toBeVisible()
    else await expect(page.getByRole('heading', { level: 1, name: nom })).toBeVisible()
  }
  if (isMobile) {
    await nav.getByRole('button', { name: 'Plus' }).click()
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
})

test('zones tactiles d’au moins 48 px sur téléphone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'téléphone uniquement')
  await seConnecter(page)
  const boutons = page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button')
  await expect(boutons).toHaveCount(5)
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
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Plus' }).click()
    await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible()
    return
  }
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav.getByRole('button', { name: 'Dashboard' })).toBeVisible()
  await expect(nav.getByText('Paramètres', { exact: true }).first()).toBeVisible()
  await page.goto('./#/equipe?vue=franchises')
  await expect(page).toHaveURL(/#\/parametres\/franchises/)
})

test('Équipe ouvre le groupe Paramètres', async ({ page, isMobile }) => {
  await seConnecter(page)
  if (isMobile) {
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Plus' }).click()
    const groupe = page.getByRole('main').getByRole('heading', { name: 'Paramètres' }).locator('xpath=following-sibling::*[1]')
    await expect(groupe.getByRole('button').first()).toHaveText(/^Équipe/)
  } else {
    const groupe = page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('list').filter({ hasText: 'Paramètres' }).last()
    await expect(groupe.getByRole('button').first()).toHaveText('Équipe')
    const classique = page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('list').first()
    await expect(classique.getByRole('button', { name: 'Équipe' })).toHaveCount(0)
  }
})
