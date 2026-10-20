import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Même barre d'outils partout : recherche, filtres puis actions sur une seule ligne
const pages = [
  { url: '/magasins?vue=liste', recherche: 'Rechercher dans les magasins', action: 'Ajouter un magasin', court: 'Magasin' },
  { url: '/visites', recherche: 'Magasin, ville, Coach…', action: 'Saisir une visite', court: 'Visite' },
  { url: '/visites?vue=historique', recherche: 'Rechercher un magasin ou une note', action: 'Saisir une visite', court: 'Visite' },
  { url: '/parametres/collaborateurs', recherche: 'Rechercher une personne', action: 'Ajouter un collaborateur', court: 'Ajouter' },
  { url: '/parametres/franchises', recherche: 'Rechercher une personne', action: 'Ajouter un franchisé', court: 'Ajouter' },
]

for (const p of pages) test(`barre d’outils alignée : ${p.url}`, async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#' + p.url)
  const recherche = page.getByLabel(p.recherche)
  const action = page.getByRole('button', { name: p.action, exact: true })
  await expect(action).toBeVisible()
  const r = (await recherche.boundingBox())!
  const a = (await action.boundingBox())!
  // Même ligne que la recherche, 48 px de haut au moins
  expect(Math.abs((a.y + a.height / 2) - (r.y + r.height / 2))).toBeLessThanOrEqual(6)
  expect(a.height).toBeGreaterThanOrEqual(48)
  // Icône à côté du libellé, sur PC comme sur téléphone (libellé court sur téléphone)
  await expect(action).toHaveText(isMobile ? p.court : p.action)
  await expect(action.locator('svg')).toHaveCount(1)
  if (isMobile) expect((await recherche.boundingBox())!.width).toBeGreaterThanOrEqual(150)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-barre${p.url.replace(/[\/?=]/g, '-')}.png` })
})

test('sur téléphone, les boutons de l’Agenda gardent icône et libellé', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'Spécifique au téléphone')
  await seConnecter(page)
  await page.goto('./#/plus/agenda')
  for (const nom of ['Absence', 'Événement']) {
    const b = page.getByRole('button', { name: nom, exact: true })
    await expect(b).toHaveText(nom)
    await expect(b.locator('svg')).toHaveCount(1)
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.screenshot({ path: `captures/${info.project.name}-agenda-boutons.png` })
})

test('les bandes d’onglets ont la même hauteur sur toutes les pages, 48 px sur téléphone', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  const hauteurs: number[] = []
  for (const [url, nom] of [['/equipe', 'Rubriques de l’équipe'], ['/magasins?vue=liste', 'Affichage'], ['/visites', 'Rubriques des visites'], ['/plus/sante', 'Rubriques de la santé du parc']]) {
    await page.goto('./#' + url)
    const bande = page.getByRole('tablist', { name: nom })
    await expect(bande).toBeVisible()
    hauteurs.push(Math.round((await bande.boundingBox())!.height))
    await page.screenshot({ path: `captures/${info.project.name}-onglets${url.replace(/[\/?=]/g, '-')}.png` })
  }
  expect(new Set(hauteurs).size).toBe(1)
  if (isMobile) expect(hauteurs[0]).toBeLessThanOrEqual(50)
  // Icône à côté du libellé sur chaque onglet, PC comme téléphone
  const onglets = page.getByRole('tablist', { name: 'Rubriques de la santé du parc' }).getByRole('tab')
  for (const o of await onglets.all()) await expect(o.locator('svg').first()).toBeVisible()
})
