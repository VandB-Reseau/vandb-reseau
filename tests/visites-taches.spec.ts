import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'
import { zonesTropPetites } from './pilotage/supabase-simule'
import { visitesFictives } from './donnees-fictives'

// Vague 7 (Joseph, 10/11/2026, « ok pour tout » : 79A à 91A) : un seul bouton « Visite », frise en trois étapes, ordre du
// jour préparé, saisie guidée qui revoit le plan d'action, anti-doublon, rappels ; tâches rangées par priorité partout ;
// fiche du magasin avec un seul jeu d'actions (retour de Joseph, 10/11/2026).

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

// Une visite de Lyon Test planifiée le jour des tests (27/10/2026)
async function avecVisitePrevue(page: Page) {
  const visites = [...visitesFictives, { id: 99, store: 'Lyon Test', visit_date: '2026-10-27', type: 'terrain', visitor: 'Noé MODELE', docs: [], prevue: true }]
  await page.route('https://supabase.test/rest/v1/visits**', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: visites }) : r.fallback()))
}

async function ajouterPriorite(page: Page, titre: string) {
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Ajouter une priorité' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Priorité', { exact: true }).fill(titre)
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toHaveCount(0)
}

test('79A et fiche : un seul bouton Visite, « + » regroupe tâche, visite non prévue, appel et note', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  const visite = page.getByRole('link', { name: 'Planifier la visite : Lyon Test' })
  await expect(visite).toBeVisible()
  await expect(page.getByRole('region', { name: 'Prochaines étapes' })).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  const menu = page.getByRole('menu')
  for (const n of ['Tâche', 'Visite non prévue', 'Appel', 'Note']) await expect(menu.getByRole('menuitem', { name: n })).toBeVisible()
  await page.keyboard.press('Escape')
  // Le menu « ⋯ » ne propose plus Planifier ni Préparer
  await page.getByRole('button', { name: 'Autres actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Planifier la visite' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  // Activité : plus de boutons en double
  await page.goto('./#/magasins/Lyon%20Test?vue=activite')
  await expect(page.getByRole('heading', { name: 'À venir' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('button', { name: 'Ajouter une tâche' })).toHaveCount(0)
  await lisible(page, isMobile)
  await visite.click()
  await expect(page).toHaveURL(/visite\?etape=preparer/)
  await expect(page.getByRole('navigation', { name: 'Étapes de la visite' }).getByRole('button')).toHaveCount(3)
})

test('81A et 82A : Préparer pose la date et un ordre du jour à cocher, envoyé au franchisé', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, persister: true })
  await ajouterPriorite(page, 'Relancer la vente additionnelle au bar')
  await page.goto('./#/magasins/Lyon%20Test/visite?etape=preparer')
  const ordre = page.getByRole('region', { name: 'Ordre du jour' })
  await ordre.getByRole('checkbox', { name: 'À aborder : Relancer la vente additionnelle au bar' }).check()
  await ordre.getByRole('checkbox', { name: 'À aborder : Refaire la tête de gondole Beaujolais' }).check()
  await ordre.getByRole('button', { name: 'Ajouter un sujet' }).click()
  await ordre.getByLabel('Sujet 1').fill('Planning de Noël')
  // Les chiffres du magasin sont un sujet de l'équipe seule
  await expect(ordre.getByText('équipe seule')).toBeVisible()
  await page.getByRole('button', { name: 'Enregistrer la préparation' }).click()
  await expect(page.getByText('Préparation enregistrée.')).toBeVisible()
  const prep = ecritures.filter((e) => JSON.stringify(e.corps).includes('Planning de Noël')).at(-1)
  expect(JSON.stringify(prep?.corps)).toContain('t:1:0')
  await lisible(page, isMobile)
  await ordre.getByRole('button', { name: 'Envoyer l’ordre du jour' }).click()
  const d = page.getByRole('dialog', { name: 'Envoyer l’ordre du jour' })
  const texte = await d.getByLabel('Message').inputValue()
  expect(texte).toContain('- Relancer la vente additionnelle au bar')
  expect(texte).toContain('- Planning de Noël')
  expect(texte).not.toContain('CA de')
  // Planifier depuis la page : la date se pose sans fenêtre
  await page.keyboard.press('Escape')
  await page.getByLabel('Date', { exact: true }).fill('2026-11-05')
  await page.getByRole('button', { name: 'Planifier la visite' }).click()
  await expect(page.getByText('Visite planifiée le 5 nov.')).toBeVisible()
  expect(ecritures.some((e) => e.table === 'visits' && e.methode === 'POST' && JSON.stringify(e.corps).includes('2026-11-05'))).toBe(true)
})

test('83A et 87A : la saisie revoit le plan, une tâche bloquée et une tâche ajoutée sous la priorité', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, persister: true })
  await avecVisitePrevue(page)
  await ajouterPriorite(page, 'Relancer la vente additionnelle au bar')
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByRole('link', { name: 'Commencer la visite : Lyon Test' })).toBeVisible()
  await page.goto('./#/magasins/Lyon%20Test/visite?id=99&etape=surplace')
  await page.getByRole('button', { name: 'Commencer la visite' }).click()
  const d = page.getByRole('dialog')
  await expect(d.getByRole('navigation', { name: 'Sommaire de la saisie' })).toBeVisible()
  const plan = d.getByRole('region', { name: 'Plan d’action et tâches' })
  await plan.getByLabel('Où en est-on : Refaire la tête de gondole Beaujolais').click()
  await page.getByRole('option', { name: 'Bloquée' }).click()
  await plan.getByLabel('Ce qui bloque').fill('Attente du présentoir')
  await plan.getByRole('button', { name: 'Ajouter une tâche à la priorité Relancer la vente additionnelle au bar' }).click()
  await plan.getByLabel('Tâche', { exact: true }).fill('Former l’équipe au conseil bière')
  await lisible(page, isMobile)
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toHaveCount(0)
  const patch = ecritures.find((e) => e.table === 'visits' && e.methode === 'PATCH' && JSON.stringify(e.corps).includes('Former l’équipe'))
  expect(JSON.stringify(patch?.corps)).toContain('"priorite":"p_')
  expect(ecritures.some((e) => JSON.stringify(e.corps).includes('Attente du présentoir'))).toBe(true)
  // La visite marque le plan revu ce jour-là
  expect(ecritures.some((e) => JSON.stringify(e.corps).includes('"revueLe":"2026-10-27"'))).toBe(true)
})

test('84A : une visite non prévue reprend la visite planifiée du magasin', async ({ page }) => {
  await seConnecter(page)
  await avecVisitePrevue(page)
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Visite non prévue' }).click()
  await expect(page.getByRole('dialog').getByText(/cette saisie la complète, sans créer de doublon/)).toBeVisible()
})

test('85A : la visite du jour sans compte rendu et la visite à préparer remontent dans À traiter', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' } })
  const visites = [...visitesFictives, { id: 98, store: 'Lyon Test', visit_date: '2026-10-29', type: 'terrain', visitor: 'Noé MODELE', docs: [], prevue: true }]
  await page.route('https://supabase.test/rest/v1/visits**', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: visites }) : r.fallback()))
  await page.goto('./#/')
  await page.reload()
  await expect(page.getByText('Visite le 29 oct. · ordre du jour à préparer').first()).toBeAttached()
})

test('89A : la liste Tâches se range par priorité et filtre les tâches sans priorité', async ({ page, isMobile }) => {
  await seConnecter(page, { persister: true })
  await ajouterPriorite(page, 'Relancer la vente additionnelle au bar')
  await page.goto('./#/taches?de=%40franchises')
  if (isMobile) await page.getByRole('button', { name: 'Filtres' }).click()
  else {
    await page.getByRole('button', { name: 'Par priorité' }).click()
    await expect(page.getByRole('heading', { name: 'Sans priorité' })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Sans priorité' }).click()
  await expect(page.getByText('Refaire la tête de gondole Beaujolais')).toBeVisible()
  await lisible(page, isMobile)
})

test('88A : le compte rendu range le plan d’action par priorité', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test/visite?id=1&etape=suivi')
  const plan = page.getByRole('region', { name: 'Plan d’action' })
  await expect(plan.getByText('Refaire la tête de gondole Beaujolais')).toBeVisible()
  // Ancien lien vers l'étape « Compte rendu » : il mène à l'étape Après
  await page.goto('./#/magasins/Lyon%20Test/visite?id=1&etape=compterendu')
  await expect(page.getByRole('button', { name: /^3 Après/ })).toHaveAttribute('aria-current', 'step')
})
