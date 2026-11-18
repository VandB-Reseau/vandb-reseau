import { expect, test } from '@playwright/test'
import { seConnecter, type Ecriture } from './supabase-simule'
import { fichesFictives } from './donnees-fictives'

// Départ d'un collaborateur et remplacement (Joseph, 18/11/2026) : dernier jour dans la fiche, reprise des magasins,
// des Coachs, des visites prévues et des tâches en cours par un collaborateur en poste ou un nouveau.

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const fiches = (e: Ecriture[]) => e.filter((x) => x.methode === 'FICHES').map((x) => JSON.parse((x.corps as { value: string }).value) as Record<string, { depart?: string; prenom?: string; nom?: string }>)

test('un Coach part : un nouveau Coach reprend ses magasins et ses tâches', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/equipe/coach/No%C3%A9%20MODELE')
  await page.getByRole('button', { name: 'Départ et remplacement' }).click()
  const d = page.getByRole('dialog', { name: 'Départ de Noé MODELE' })
  await d.getByLabel('Dernier jour').fill('2026-11-30')
  await d.getByLabel('Remplacé par').click()
  await page.getByRole('option', { name: 'Un nouveau Coach' }).click()
  await d.getByLabel('Prénom').fill('Léo')
  await d.getByLabel(/^Nom/).fill('Relais')
  await expect(d.getByLabel(/^Nom/)).toHaveValue('RELAIS')
  const magasins = d.getByRole('checkbox', { name: /magasins?$/ })
  await expect(magasins).toBeChecked()
  await expect(d.getByRole('checkbox', { name: '1 tâche en cours' })).toBeChecked()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Noé MODELE part le 30 nov\. 2026\. Léo RELAIS reprend \d+ magasins, 1 tâche\./)).toBeVisible()

  expect(fiches(ecritures).some((f) => f['coach:Noé MODELE']?.depart === '2026-11-30')).toBe(true)
  expect(fiches(ecritures).some((f) => f['coach:Léo RELAIS']?.nom === 'RELAIS')).toBe(true)
  expect(ecritures).toContainEqual(expect.objectContaining({ methode: 'POST', table: 'cs_overrides', corps: expect.objectContaining({ cs_name: 'Léo RELAIS' }) }))
  // Magasins repris au 1er du mois qui suit le dernier jour, dont Lyon Test
  const reprises = ecritures.filter((e) => e.methode === 'POST' && e.table === 'reassigns').map((e) => e.corps as { store: string; cs: string; date: string })
  expect(reprises).toContainEqual(expect.objectContaining({ store: 'Lyon Test', cs: 'Léo RELAIS', date: '2026-12-01' }))
  // La tâche en cours qu'il portait (visite de Brest) passe au remplaçant ; la tâche faite ne bouge pas
  const plan = ecritures.find((e) => e.methode === 'PATCH' && e.table === 'visits' && e.filtre.includes('id=eq.4'))?.corps as { action_plan: { id: string; porteur: string }[] }
  expect(plan.action_plan.find((a) => a.id === 'a2')?.porteur).toBe('Léo RELAIS')
  expect(plan.action_plan.find((a) => a.id === 'a3')?.porteur).toBe('Franchisé 11')
})

test('un Coach parti sort de l’équipe et rejoint les anciens, sa fiche reste lisible', async ({ page }) => {
  await seConnecter(page, { config: { fiches_personnes: { ...fichesFictives, 'coach:Hugo FICTIF': { prenom: 'Hugo', nom: 'FICTIF', depart: '2026-10-15' }, 'rr:rr2': { prenom: 'Sam', nom: 'SUD', depart: '2026-12-31' } } } })
  await page.goto('./#/equipe?vue=postes')
  await expect(page.getByText('Départs prévus (1)')).toBeVisible()
  await expect(page.getByText('Responsable Régional · part le 31 déc. 2026 · 2 à reprendre')).toBeVisible()
  await page.goto('./#/equipe?vue=collaborateurs')
  await expect(page.getByText('Camille TESTARD').first()).toBeVisible()
  await expect(page.getByText('Hugo FICTIF')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Anciens' }).click()
  const ligne = page.getByRole('link', { name: 'Hugo FICTIF' })
  await expect(ligne).toBeVisible()
  await expect(page.getByText('Coach · parti le 15 oct. 2026')).toBeVisible()
  await expect(page.getByText(/magasins? encore à son nom/)).toBeVisible()
  await ligne.click()
  await expect(page.getByText('Parti le 15 oct. 2026').first()).toBeVisible()
})

test('un Responsable Régional part : ses Coachs passent à un autre Responsable Régional', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/equipe/rr/rr2')
  await page.getByRole('button', { name: 'Départ et remplacement' }).click()
  const d = page.getByRole('dialog', { name: 'Départ de Sam SUD' })
  await d.getByLabel('Dernier jour').fill('2026-12-31')
  await d.getByLabel('Remplacé par').click()
  await page.getByRole('option', { name: 'Alex NORD' }).click()
  await expect(d.getByRole('checkbox', { name: '2 Coachs' })).toBeChecked()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Sam SUD part le 31 déc\. 2026\. Alex NORD reprend 2 Coachs/)).toBeVisible()
  const configs = ecritures.filter((e) => e.table === 'app_config' && e.methode !== 'FICHES').map((e) => JSON.parse((e.corps as { value: string }).value))
  // Chaque rattachement relit la configuration : on regarde toutes les écritures
  const rattachements = configs.flatMap((c) => c?.dr_assigns ?? [])
  expect(rattachements).toContainEqual(expect.objectContaining({ cs: 'Inès EXEMPLE', dr: 'rr1', date: '2027-01-01' }))
  expect(rattachements).toContainEqual(expect.objectContaining({ cs: 'Noé MODELE', dr: 'rr1', date: '2027-01-01' }))
})
