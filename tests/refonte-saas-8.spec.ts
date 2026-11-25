import { expect, test, type Page } from '@playwright/test'
import { deplierPoint, creerDepuisMenu, seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'
import { zonesTropPetites } from './pilotage/supabase-simule'

// Refonte façon SaaS, vague 8 (Joseph, 10/11/2026, « ok pour tout, fais tout ») : cohérence globale (92 à 110 sauf 107)
// et trois retours de Joseph (11 et 13/11/2026) : l'actualité au premier plan de l'accueil, la visite qui ne fait plus
// saisir les chiffres de la caisse, la tâche reliée à une priorité du plan et à son objectif chiffré.

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

async function lisible(page: Page, isMobile: boolean) {
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
}

const PAUL = { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }

test('l’actualité au premier plan de l’accueil, comme un réseau social', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  const fil = page.getByRole('region', { name: 'Actualités' })
  await expect(fil).toBeVisible()
  // Le fil passe avant les indicateurs et avant À traiter ; sur téléphone, le fil seul (278), le point du jour est dans la barre du haut
  await expect(page.getByRole('main').getByRole('region').first()).toHaveAttribute('aria-label', 'Actualités')
  // Téléphone (278) : Communication se choisit en touchant le champ Partager
  if (!isMobile) await expect(fil.getByRole('button', { name: 'Communication' })).toBeVisible()
  if (isMobile) {
    // Téléphone : les indicateurs s'ouvrent par le picto « Mon point du jour »
    await expect(page.getByRole('region', { name: 'À traiter' })).toHaveCount(0)
    await deplierPoint(page)
    await expect(page.getByRole('region', { name: 'À traiter' })).toBeVisible()
    await page.getByRole('dialog', { name: 'Mon point du jour' }).getByRole('button', { name: 'Fermer' }).click()
  } else {
    // PC : le fil à gauche, la colonne Aujourd'hui à droite (plus d'indicateurs chiffrés depuis le 25/11/2026)
    const [f, ind] = await Promise.all([fil.boundingBox(), page.getByRole('complementary', { name: 'Aujourd’hui' }).boundingBox()])
    expect(ind!.x).toBeGreaterThan(f!.x + f!.width)
    expect(f!.y).toBeLessThanOrEqual(ind!.y + 16)
  }
  await lisible(page, isMobile)
  await page.screenshot({ path: `captures/${info.project.name}-vague8-accueil-actualites.png` })
  if (isMobile) {
    await fil.getByRole('button', { name: 'Partager une réussite du terrain' }).click()
    await page.getByRole('menuitem', { name: 'Communication' }).click()
  } else await fil.getByRole('button', { name: 'Communication' }).click()
  await expect(page.getByRole('dialog', { name: 'Nouvelle communication' })).toBeVisible()
})

test('l’accueil du franchisé commence aussi par l’actualité', async ({ page, isMobile }) => {
  await seConnecter(page, { acces: PAUL })
  await expect(page.getByRole('main').getByRole('region').first()).toHaveAttribute('aria-label', isMobile ? 'Mon mois' : 'Actualités') // 222 : sur le téléphone, un chiffre et une action d'abord
  await lisible(page, isMobile)
})

test('une tâche se relie à une priorité du plan, créée au passage avec son objectif chiffré', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, config: { objectifs_magasins: { 'Annecy Test': [{ id: 'o1', indicateur: 'pmCave', mode: 'valeur', depart: 40, moisDepart: '2026-09', cible: 44, echeance: '2027-01', taches: [], par: 'Joseph', creeLe: '2026-10-01' }] } } })
  await page.goto('./#/magasins/Annecy%20Test')
  await creerDepuisMenu(page, 'Tâche')
  const d = page.getByRole('dialog', { name: 'Ajouter une tâche' })
  const choixMagasin = d.getByLabel('Magasin')
  if (await choixMagasin.count()) { await choixMagasin.fill('Annecy Test'); await page.getByRole('option', { name: 'Annecy Test', exact: true }).click() }
  await d.getByLabel('Tâche', { exact: true }).fill('Former l’équipe à la vente additionnelle')
  // Le lien au plan d'action se voit même sans priorité en cours
  await d.getByLabel('Priorité du plan d’action').click()
  await page.getByRole('option', { name: 'Nouvelle priorité…' }).click()
  await d.getByLabel('Nouvelle priorité', { exact: true }).fill('Relancer la Cave')
  await d.getByLabel('Objectif chiffré de la priorité').click()
  await page.getByRole('option', { name: /Panier moyen HT Cave/ }).click()
  expect(await textesTropPetits(page)).toEqual([])
  await d.screenshot({ path: `captures/${info.project.name}-vague8-tache-priorite.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const plan = ecritures.filter((e) => e.table === 'app_config' && (e.corps as { key?: string }).key === 'plans_magasins').at(-1)
  const priorites = JSON.parse((plan!.corps as { value: string }).value)['Annecy Test'] as { id: string; titre: string; objectif: string }[]
  expect(priorites).toEqual([expect.objectContaining({ titre: 'Relancer la Cave', objectif: 'o1' })])
  const taches = ecritures.filter((e) => e.table === 'app_config' && (e.corps as { key?: string }).key === 'actions').at(-1)
  const ajoutee = (JSON.parse((taches!.corps as { value: string }).value)['Annecy Test'] as { action: string; priorite?: string }[]).find((a) => a.action.startsWith('Former'))
  expect(ajoutee?.priorite).toBe(priorites[0].id)
})

// Joseph (13/11/2026) : bonne pratique depuis le « + » du magasin, visible dans son activité ; onglet Nine box avec l'évolution
test('le « + » du magasin ajoute une bonne pratique, rangée dans le fil de l’activité', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('main').getByRole('button', { name: 'Ajouter', exact: true }).first().click()
  await page.getByRole('menuitem', { name: 'Bonne pratique' }).click()
  const d = page.getByRole('dialog', { name: 'Nouvelle bonne pratique' })
  await expect(d).toBeVisible()
  await expect(d.getByRole('combobox', { name: 'Magasin' }).or(d.getByLabel('Magasin')).first()).toHaveValue('Lyon Test')
  await page.keyboard.press('Escape')
  await page.goto('./#/magasins/Lyon%20Test?vue=activite')
  // Choix 199 (15/11/2026) : plus de filtre à part, les bonnes pratiques sont dans le fil
  await expect(page.getByRole('group', { name: 'Filtrer l’activité' }).getByRole('button', { name: 'Bonnes pratiques', exact: true })).toHaveCount(0)
  // (zones tactiles : le fil d'activité a des liens courts déjà connus, hors de ce lot)
  expect(await textesTropPetits(page)).toEqual([])
})

test('l’onglet Nine box montre la case actuelle et le chemin du magasin', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test?vue=ninebox')
  await expect(page.getByRole('heading', { name: 'Nine box', exact: true })).toBeVisible()
  const grille = page.getByRole('main')
  // Lyon Test : Cœur de réseau en juin, Redressement urgent depuis octobre
  await expect(grille.getByRole('group', { name: /^Redressement urgent, case actuelle/ })).toBeVisible()
  await expect(grille.getByRole('group', { name: /^Cœur de réseau, passé le/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Santé', exact: true })).toBeVisible()
  await lisible(page, isMobile)
  await page.screenshot({ path: `captures/${info.project.name}-vague8-ninebox-magasin.png`, fullPage: true })
})

// Vague 8, suite (Joseph, 13/11/2026, « faire le reste ») : 109, 104, 100
test('109 : l’espace franchisé a deux rubriques, « Mon magasin », À faire par tâche et ses magasins en cartes', async ({ page, isMobile }, info) => {
  await seConnecter(page, { acces: PAUL, espace: {} })
  if (!isMobile) {
    const nav = page.getByRole('navigation', { name: 'Navigation principale' })
    await expect(nav.getByText('Mon magasin', { exact: true })).toBeVisible()
    await expect(nav.getByText('Échanger', { exact: true })).toBeVisible()
    await page.getByRole('combobox', { name: 'Mon magasin' }).click()
    await page.getByRole('option', { name: 'Rennes Test' }).click()
    await expect(page).toHaveURL(/magasins\/Rennes/)
    await page.goto('./#/')
  }
  // 348 (18/11/2026) : À faire en une ligne par tâche et par magasin ; sur téléphone, « Clôturer » est dans le bandeau du haut
  await deplierPoint(page)
  const aFaire = page.getByRole('region', { name: 'À faire' })
  const tache = isMobile ? 'Relire mon budget' : 'Clôturer'
  await expect(aFaire.getByRole('link', { name: new RegExp(`^${tache}.*Annecy Test`) })).toBeVisible()
  await expect(aFaire.getByRole('link', { name: new RegExp(`^${tache}.*Rennes Test`) })).toBeVisible()
  if (isMobile) await expect(aFaire.getByText(/^Clôturer /)).toHaveCount(0)
  await page.goto('./#/magasins')
  const cartes = page.getByRole('region', { name: 'Mes magasins' })
  await expect(cartes.getByRole('heading', { level: 2 })).toHaveText(['Annecy Test', 'Rennes Test'])
  await lisible(page, isMobile)
  await page.screenshot({ path: `captures/${info.project.name}-vague8-franchise-magasins.png`, fullPage: true })
})

test('104 : les actions secondaires passent dans « ⋯ »', async ({ page, isMobile }) => {
  test.skip(isMobile, 'PC : Évolution du parc depuis Magasins')
  await seConnecter(page)
  await page.goto('./#/magasins')
  await page.getByRole('button', { name: 'Autres actions' }).click()
  await page.getByRole('menuitem', { name: 'Évolution du parc' }).click()
  await expect(page).toHaveURL(/#\/evolution$/)
})

test('100 : un seul champ de date, libellé au-dessus, valeur conservée', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Annecy%20Test')
  await creerDepuisMenu(page, 'Tâche')
  const d = page.getByRole('dialog', { name: 'Ajouter une tâche' })
  const echeance = d.getByRole('textbox', { name: 'Échéance' })
  await echeance.fill('2026-12-05')
  await expect(echeance).toHaveValue('2026-12-05')
  await expect(echeance).toHaveAttribute('type', 'date')
})
