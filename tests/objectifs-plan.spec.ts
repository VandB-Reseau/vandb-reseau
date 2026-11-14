import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

// Joseph (14/11/2026) : objectifs de l'année et plan d'action en un seul bloc dans l'aperçu de la fiche magasin.
// Sous chaque objectif, ses priorités ; sous chaque priorité, ses tâches avec échéance et porteur.
const objectifs = { 'Brest Test': [{ id: 'o1', indicateur: 'pmCave', mode: 'valeur', depart: 37.14, moisDepart: '2026-09', cible: 40, echeance: '2026-12', taches: [], par: 'Joseph', creeLe: '2026-10-01' }] }
const plans = { 'Brest Test': [
  { id: 'p1', titre: 'Améliorer le mix produit', objectif: 'o1', statut: 'active', bilan: '', creeLe: '2026-10-01', par: 'Joseph', closLe: '', revueLe: '' },
  { id: 'p2', titre: 'Tenir les rituels d’équipe', objectif: '', statut: 'active', bilan: '', creeLe: '2026-10-01', par: 'Joseph', closLe: '', revueLe: '' },
] }

test('un seul bloc : l’objectif de l’année, ses priorités et leurs tâches', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, config: { objectifs_magasins: objectifs, plans_magasins: plans } })
  await page.goto('./#/magasins/Brest%20Test')
  const bloc = page.locator('.MuiCard-root', { has: page.getByRole('heading', { name: 'Objectifs 2026 et plan d’action' }) })
  await expect(bloc).toBeVisible()
  // Plus de cartes séparées « Plan d'action » et « Objectifs »
  await expect(page.getByRole('heading', { name: /^Plan d’action/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /^Objectifs ·/ })).toHaveCount(0)
  const objectif = bloc.getByRole('region', { name: /^Objectif : Panier moyen HT Cave/ })
  await expect(objectif.getByText('Année 2026')).toBeVisible()
  await expect(objectif.getByRole('heading', { name: 'Panier moyen HT Cave : 37,14 € → 40,00 €' })).toBeVisible()
  await expect(objectif.getByRole('listitem', { name: 'Priorité 1 : Améliorer le mix produit' })).toBeVisible()
  // La priorité sans objectif reste dans le bloc, à part
  await expect(bloc.getByRole('region', { name: 'Priorités sans objectif' })).toContainText('Tenir les rituels d’équipe')
  expect(await textesTropPetits(page)).toEqual([])
  // Une tâche s'ajoute sous la priorité : elle y est rattachée d'office
  await objectif.getByRole('button', { name: 'Ajouter une tâche à la priorité Améliorer le mix produit' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une tâche' })
  await expect(d.getByLabel('Priorité du plan d’action')).toContainText('Améliorer le mix produit')
  await d.getByLabel('Tâche', { exact: true }).fill('Mettre en avant les vins à 15 €')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const taches = ecritures.filter((e) => e.table === 'app_config' && (e.corps as { key?: string }).key === 'actions').at(-1)
  const ajoutee = (JSON.parse((taches!.corps as { value: string }).value)['Brest Test'] as { action: string; priorite?: string }[]).find((a) => a.action.startsWith('Mettre en avant'))
  expect(ajoutee?.priorite).toBe('p1')
})

test('une priorité se crée sous son objectif, déjà reliée', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, config: { objectifs_magasins: objectifs } })
  await page.goto('./#/magasins/Brest%20Test')
  const objectif = page.getByRole('region', { name: /^Objectif : Panier moyen HT Cave/ })
  await expect(objectif.getByText('Aucune priorité pour cet objectif.')).toBeVisible()
  await objectif.getByRole('button', { name: 'Ajouter une priorité' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Priorité', { exact: true }).fill('Relancer la Cave')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toHaveCount(0)
  const plan = ecritures.filter((e) => e.table === 'app_config' && (e.corps as { key?: string }).key === 'plans_magasins').at(-1)
  const p = JSON.parse((plan!.corps as { value: string }).value)['Brest Test'] as { titre: string; objectif: string }[]
  expect(p).toEqual([expect.objectContaining({ titre: 'Relancer la Cave', objectif: 'o1' })])
})

// Joseph (14/11/2026) : un objectif peut être qualitatif (« faire monter l'équipe en compétence ») : intitulé, description,
// période ; ses priorités et tâches se rangent dessous comme pour un objectif chiffré, l'avancement se lit dans les tâches faites.
test('un objectif qualitatif se fixe, s’affiche et avance avec ses tâches', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Brest%20Test')
  await page.getByRole('button', { name: 'Fixer un objectif' }).click()
  const d = page.getByRole('dialog')
  await d.getByRole('button', { name: 'Qualitatif' }).click()
  await expect(d.getByLabel('Indicateur de la caisse')).toHaveCount(0)
  await d.getByLabel('Objectif', { exact: true }).fill('Faire monter l’équipe en compétence')
  await d.getByLabel('Description (facultatif)').fill('Deux vendeurs autonomes en dégustation')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toHaveCount(0)
  const ecrit = ecritures.filter((e) => e.table === 'app_config' && (e.corps as { key?: string }).key === 'objectifs_magasins').at(-1)
  const o = (JSON.parse((ecrit!.corps as { value: string }).value)['Brest Test'] as Record<string, unknown>[])[0]
  expect(o).toEqual(expect.objectContaining({ nature: 'qualitatif', titre: 'Faire monter l’équipe en compétence', description: 'Deux vendeurs autonomes en dégustation', echeance: '2026-12' }))
})

test('un objectif qualitatif dit son avancement par les tâches faites', async ({ page }) => {
  const objectifsQ = { 'Brest Test': [{ id: 'q1', nature: 'qualitatif', titre: 'Racheter un deuxième magasin', description: 'Repérer et chiffrer deux cibles', echeance: '2026-12', moisDepart: '2026-09', par: 'Joseph', creeLe: '2026-09-01' }] }
  const plansQ = { 'Brest Test': [{ id: 'p9', titre: 'Trouver le financement', objectif: 'q1', statut: 'active', bilan: '', creeLe: '2026-09-01', par: 'Joseph', closLe: '', revueLe: '' }] }
  const actions = { 'Brest Test': [
    { id: 'l1', action: 'Rencontrer la banque', echeance: '2026-10-15', faite: true, priorite: 'p9', creeLe: '2026-09-02' },
    { id: 'l2', action: 'Monter le prévisionnel', echeance: '2026-11-15', faite: false, priorite: 'p9', creeLe: '2026-09-02' },
  ] }
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, config: { objectifs_magasins: objectifsQ, plans_magasins: plansQ, actions } })
  await page.goto('./#/magasins/Brest%20Test')
  const objectif = page.getByRole('region', { name: /^Objectif : Racheter un deuxième magasin/ })
  await expect(objectif.getByRole('heading', { name: 'Racheter un deuxième magasin' })).toBeVisible()
  await expect(objectif.getByText('Repérer et chiffrer deux cibles')).toBeVisible()
  await expect(objectif.getByRole('meter')).toHaveAttribute('aria-valuenow', '50')
  await expect(objectif.getByRole('listitem', { name: 'Priorité 1 : Trouver le financement' })).toBeVisible()
  // Statut réglé à la main
  await objectif.getByRole('button', { name: /^Modifier l’objectif/ }).click()
  const d = page.getByRole('dialog')
  await expect(d.getByRole('button', { name: 'Chiffré' })).toHaveCount(0)
  await d.getByRole('button', { name: 'Atteint' }).click()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toHaveCount(0)
  const ecrit = ecritures.filter((e) => e.table === 'app_config' && (e.corps as { key?: string }).key === 'objectifs_magasins').at(-1)
  expect(JSON.parse((ecrit!.corps as { value: string }).value)['Brest Test'][0]).toEqual(expect.objectContaining({ nature: 'qualitatif', etat: 'atteint' }))
  expect(await textesTropPetits(page)).toEqual([])
})
