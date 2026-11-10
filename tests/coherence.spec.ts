import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

// Même barre d'outils partout : recherche, filtres puis actions sur une seule ligne. Refonte vague 4 (39A) : l'action
// principale d'une liste passe à droite du titre de la page (enTitre)
const pages = [
  { url: '/magasins?vue=liste', recherche: 'Rechercher dans les magasins', action: 'Ajouter un magasin', enTitre: true },
  { url: '/visites', recherche: 'Magasin, ville, Coach…', action: 'Saisir une visite', enTitre: true },
  { url: '/visites?vue=historique', recherche: 'Rechercher dans les visites', action: 'Saisir une visite', enTitre: true },
  { url: '/parametres/collaborateurs', recherche: 'Rechercher une personne', action: 'Ajouter un collaborateur' },
  { url: '/parametres/franchises', recherche: 'Rechercher une personne', action: 'Ajouter un franchisé' },
]

for (const p of pages) test(`barre d’outils alignée : ${p.url}`, async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#' + p.url)
  const recherche = 'enTitre' in p ? page.getByRole('heading', { level: 1 }) : page.getByLabel(p.recherche)
  const action = page.getByRole('button', { name: p.action, exact: true }).first()
  // Vague 6 (retour de Joseph, 10/11/2026) : sur téléphone, un seul « + », celui de l'en-tête ; l'ajout d'un magasin reste sur PC
  if (isMobile && p.url.startsWith('/magasins')) { await expect(page.getByRole('heading', { name: 'Magasins', level: 1 })).toBeVisible(); await expect(action).toHaveCount(0); return }
  await expect(action).toBeVisible()
  const r = (await recherche.boundingBox())!
  const a = (await action.boundingBox())!
  // Même ligne que la recherche (ou que le titre), 48 px de haut au moins
  expect(Math.abs((a.y + a.height / 2) - (r.y + r.height / 2))).toBeLessThanOrEqual('enTitre' in p ? 24 : 6)
  expect(a.height).toBeGreaterThanOrEqual(48)
  if (isMobile) {
    // Sur téléphone, l'action est un bouton rond sans texte
    expect(a.width).toBeLessThanOrEqual(52)
    await expect(action).toHaveText('')
  }
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-barre${p.url.replace(/[\/?=]/g, '-')}.png` })
})

// Refonte (09/11/2026, 9A) : sur PC, plus de bouton Créer dans le menu ; l'Agenda a son bouton, qui ouvre le panneau de droite
test('l’événement se crée depuis l’en-tête de l’Agenda sur PC, depuis Créer sur téléphone ; plus d’absence', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/plus/agenda')
  await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('button', { name: /^(Absence|Événement)$/ })).toHaveCount(0)
  if (!isMobile) {
    await expect(page.getByRole('button', { name: 'Créer', exact: true })).toHaveCount(0)
    await page.getByRole('main').getByRole('button', { name: 'Ajouter un événement' }).click()
    await expect(page.getByRole('dialog', { name: 'Ajouter un événement' })).toBeVisible()
    return
  }
  await expect(page.getByRole('main').getByRole('button', { name: 'Ajouter un événement' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  const creer = page.getByRole('menu', { name: 'Créer' })
  await expect(creer.getByRole('menuitem', { name: 'Absence' })).toHaveCount(0)
  expect((await creer.getByRole('menuitem', { name: 'Événement', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await creer.getByRole('menuitem', { name: 'Événement', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Ajouter un événement' })).toBeVisible()
})

test('les bandes d’onglets ont la même hauteur sur toutes les pages, 48 px sur téléphone', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  const hauteurs: number[] = []
  // Magasins : Liste et Carte en bascule dans l'en-tête depuis la refonte (09/11/2026), plus en onglets
  for (const [url, nom] of [['/equipe', 'Rubriques de l’équipe'], ['/visites', 'Rubriques des visites'], ['/plus/sante', 'Rubriques de la santé du parc']]) {
    await page.goto('./#' + url)
    const bande = page.getByRole('tablist', { name: nom })
    await expect(bande).toBeVisible()
    hauteurs.push(Math.round((await bande.boundingBox())!.height))
    await page.screenshot({ path: `captures/${info.project.name}-onglets${url.replace(/[\/?=]/g, '-')}.png` })
  }
  expect(new Set(hauteurs).size).toBe(1)
  if (isMobile) expect(hauteurs[0]).toBeLessThanOrEqual(50)
})
