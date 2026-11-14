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
  await expect(bloc.getByRole('region', { name: 'Priorités sans objectif chiffré' })).toContainText('Tenir les rituels d’équipe')
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
