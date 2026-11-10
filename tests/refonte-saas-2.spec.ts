import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'
import { zonesTropPetites } from './pilotage/supabase-simule'

// Refonte façon SaaS, vague 2 (Joseph, 09/11/2026, « tout comme recommandé ») : cloche et volet de notifications (10A),
// en-tête de fiche compact (11A), Paramètres en quatre groupes (14A), page Performance sous Finances (15A), cases à cocher
// et actions en masse (16A), « Annuler » après une action (17A). Données fictives uniquement.

const DIRECTEUR = 'Dominique DIRECTION'
// Vague 4 (38B) : plus de notification « en retard », la tâche confiée récemment reste dans la cloche
const actions = { 'Brest Test': [
  { id: 'l1', action: 'Commander la nouvelle PLV', porteur: DIRECTEUR, echeance: '2026-10-01', creeLe: '2026-10-20', auteur: 'Noé MODELE' },
] }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

async function ouvrirCloche(page: Page) {
  await page.getByRole('button', { name: /^Notifications/ }).click()
  const volet = page.getByRole('dialog', { name: 'Notifications' })
  await expect(volet).toBeVisible()
  return volet
}

test('la cloche ouvre le volet des notifications : non lues, toutes, tout marquer comme lu', async ({ page, isMobile }, info) => {
  await seConnecter(page, { config: { actions } })
  const volet = await ouvrirCloche(page)
  await expect(volet.getByRole('heading', { level: 2 })).toHaveText('Notifications')
  // Première visite sur cet appareil : ce qui existait déjà est considéré comme lu
  await expect(volet.getByText('Tout est lu')).toBeVisible()
  await volet.getByRole('button', { name: 'Toutes' }).click()
  const liste = volet.getByRole('list', { name: 'Liste des notifications' })
  await expect(liste.getByRole('listitem').filter({ hasText: 'Commander la nouvelle PLV' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-notifications.png` })
  // Une notification mène à sa page et ferme le volet
  await liste.getByRole('listitem').filter({ hasText: 'Commander la nouvelle PLV' }).getByRole('button').click()
  await expect(volet).toBeHidden()
  await expect(page).toHaveURL(/#\/taches/)
})

test('la page Performance réunit les chiffres, le budget, les clôtures et l’évolution', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  if (!isMobile) {
    const menu = page.getByRole('navigation', { name: 'Navigation principale' })
    await menu.getByRole('button', { name: 'Chiffres' }).click()
  } else await page.goto('./#/performance')
  await expect(page).toHaveURL(/#\/performance/)
  // Vague 5 (51A) : Performance devient Chiffres, avec un onglet vers les budgets de l'année
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chiffres')
  const onglets = page.getByRole('tablist', { name: 'Parties des chiffres' })
  // Téléphone : trois onglets puis « Plus »
  await expect(onglets.getByRole('tab')).toHaveCount(isMobile ? 4 : 6)
  await expect(onglets.getByRole('tab', { selected: true })).toContainText(isMobile ? 'Magasins' : 'Chiffres des magasins')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-performance.png`, fullPage: !isMobile })
  // Les anciennes adresses mènent ici
  await page.goto('./#/parametres/evolution')
  await expect(page).toHaveURL(/#\/performance\?vue=evolution/)
  await expect(onglets.getByRole('tab', { selected: true })).toContainText('Évolution')
})

test('les Paramètres se lisent en quatre groupes, budgets compris', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/parametres/reglages')
  for (const g of ['Visites et suivi', 'Budgets', 'Données', 'Historique']) await expect(page.getByRole('group', { name: g })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Budgets' })).toContainText('Hypothèses')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-parametres-groupes.png`, fullPage: !isMobile })
  // Les anciennes adresses des budgets y mènent
  await page.goto('./#/budgets/hypotheses')
  await expect(page).toHaveURL(/#\/parametres\/reglages\?rubrique=hypotheses/)
})

test('PC : cocher des magasins ouvre la barre d’actions et crée une tâche pour chacun', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Les cases sont dans le tableau des magasins, sur PC')
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins')
  const tableau = page.getByRole('table', { name: 'Tableau des magasins' })
  await tableau.getByRole('checkbox', { name: 'Sélectionner Annecy Test' }).check()
  await tableau.getByRole('checkbox', { name: 'Sélectionner Brest Test' }).check()
  const barre = page.getByRole('toolbar', { name: 'Actions sur la sélection' })
  await expect(barre).toContainText('2 magasins')
  await page.screenshot({ path: `captures/${info.project.name}-selection-magasins.png` })
  await barre.getByRole('button', { name: 'Créer une tâche pour chacun' }).click()
  const fenetre = page.getByRole('dialog', { name: 'Une tâche pour 2 magasins' })
  await fenetre.getByLabel('Tâche').fill('Mettre en place la vitrine de Noël')
  await fenetre.getByRole('button', { name: /Créer/ }).click()
  await expect(fenetre).toBeHidden()
  await expect(barre).toBeHidden()
  const cles = ecritures.filter((e) => e.table === 'app_config' && JSON.stringify(e.corps).includes('Mettre en place la vitrine'))
  expect(cles.length).toBeGreaterThan(0)
  // Tout cocher, tout décocher
  await tableau.getByRole('checkbox', { name: 'Tout sélectionner' }).check()
  await expect(barre).toBeVisible()
  await barre.getByRole('button', { name: 'Désélectionner' }).click()
  await expect(barre).toBeHidden()
})

test('cocher une tâche se rattrape avec « Annuler »', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, persister: true, config: { actions } })
  await page.goto('./#/taches')
  const aFaire = page.getByRole('list', { name: 'Tâches à faire' })
  await aFaire.getByRole('checkbox', { name: 'Marquer faite : Commander la nouvelle PLV' }).click()
  await expect(page.getByText('Tâche marquée faite.')).toBeVisible()
  const annuler = page.getByRole('button', { name: 'Annuler' })
  if (isMobile) expect((await annuler.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await annuler.click()
  await expect(aFaire.getByRole('listitem').filter({ hasText: 'Commander la nouvelle PLV' })).toBeVisible()
})

test('PC : en descendant dans la fiche, le nom du magasin reste au-dessus des onglets', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Bande collante des onglets sur PC')
  await seConnecter(page)
  await page.goto(`./#/magasins/${encodeURIComponent('Annecy Test')}`)
  const enBref = page.getByRole('group', { name: 'En bref' })
  await expect(enBref).toBeVisible()
  await page.mouse.wheel(0, 1500)
  await expect(enBref).not.toBeInViewport()
  await expect(page.getByRole('tablist').first()).toBeInViewport()
  // Le nom reprend sa place dans la bande collante (texte décoratif : le titre de la page reste le h1)
  await expect(page.locator('p[aria-hidden]', { hasText: /^Annecy Test$/ })).toBeInViewport()
  await page.screenshot({ path: `captures/${info.project.name}-entete-collant.png` })
})
