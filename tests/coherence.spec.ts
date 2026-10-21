import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Même barre d'outils partout : recherche, filtres puis actions sur une seule ligne
const pages = [
  { url: '/magasins?vue=liste', recherche: 'Rechercher dans les magasins', action: 'Ajouter un magasin' },
  { url: '/visites', recherche: 'Magasin, ville, Coach…', action: 'Saisir une visite' },
  { url: '/visites?vue=historique', recherche: 'Rechercher un magasin ou une note', action: 'Saisir une visite' },
  { url: '/parametres/collaborateurs', recherche: 'Rechercher une personne', action: 'Ajouter un collaborateur' },
  { url: '/parametres/franchises', recherche: 'Rechercher une personne', action: 'Ajouter un franchisé' },
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
  if (isMobile) {
    // Sur téléphone, l'action est un bouton rond sans texte
    expect(a.width).toBeLessThanOrEqual(52)
    await expect(action).toHaveText('')
  }
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-barre${p.url.replace(/[\/?=]/g, '-')}.png` })
})

test('absence et événement se créent depuis le bouton Créer, plus depuis l’en-tête de l’Agenda', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/plus/agenda')
  await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('button', { name: /^(Absence|Événement)$/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  const creer = page.getByRole('dialog', { name: 'Créer' })
  for (const nom of ['Absence', 'Événement']) expect((await creer.getByRole('button', { name: nom, exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await creer.getByRole('button', { name: 'Événement', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Ajouter un événement' })).toBeVisible()
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
})
