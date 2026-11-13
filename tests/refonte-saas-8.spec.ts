import { expect, test, type Page } from '@playwright/test'
import { creerDepuisMenu, seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'
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
  // Le fil passe avant les indicateurs et avant À traiter
  await expect(page.getByRole('main').getByRole('region').first()).toHaveAttribute('aria-label', 'Actualités')
  await expect(fil.getByRole('link', { name: 'Publier' })).toBeVisible()
  if (isMobile) {
    // Téléphone : les indicateurs se déplient
    await expect(page.getByRole('region', { name: 'Pilotage' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Mes indicateurs' }).click()
    await expect(page.getByRole('region', { name: 'Pilotage' })).toBeVisible()
  } else {
    // PC : le fil à gauche, les indicateurs en tête de la colonne Aujourd'hui
    const [f, ind] = await Promise.all([fil.boundingBox(), page.getByRole('region', { name: 'Pilotage' }).boundingBox()])
    expect(ind!.x).toBeGreaterThan(f!.x + f!.width)
    expect(f!.y).toBeLessThanOrEqual(ind!.y + 16)
  }
  await lisible(page, isMobile)
  await page.screenshot({ path: `captures/${info.project.name}-vague8-accueil-actualites.png` })
  await fil.getByRole('link', { name: 'Publier' }).click()
  await expect(page.getByRole('dialog', { name: 'Nouvelle communication' })).toBeVisible()
})

test('l’accueil du franchisé commence aussi par l’actualité', async ({ page, isMobile }) => {
  await seConnecter(page, { acces: PAUL })
  await expect(page.getByRole('main').getByRole('region').first()).toHaveAttribute('aria-label', 'Actualités')
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
