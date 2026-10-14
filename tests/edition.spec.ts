import { expect, test } from '@playwright/test'
import { seConnecter, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const ecrituresSur = (e: Ecriture[], table: string) => e.filter((x) => x.table === table)
const valeur = (e: Ecriture) => JSON.parse((e.corps as { value: string }).value)

test('modifier et renommer un magasin met à jour toutes les tables', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Nantes%20Test')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Modifier Nantes Test' })
  await expect(d.getByLabel('Franchisé', { exact: true })).toHaveValue('Franchisé 2')
  // Plus d'adjoint ni de plateforme logistique
  await expect(d.getByLabel('Adjoint')).toHaveCount(0)
  await expect(d.getByLabel('Plateforme logistique')).toHaveCount(0)
  await d.getByLabel('Nom du magasin').fill('Lyon Test')
  await expect(d.getByText('Un magasin porte déjà ce nom.')).toBeVisible()
  await d.getByLabel('Nom du magasin').fill('Nantes Centre Test')
  // Un franchisé existant reprend ses coordonnées
  await d.getByLabel('Franchisé', { exact: true }).fill('Paul MULTI')
  await page.screenshot({ path: `captures/${info.project.name}-modifier-magasin.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  // La base simulée ne garde pas les écritures : la fiche relue sous le nouveau nom n'existe pas ici
  await expect(page).toHaveURL(/Nantes%20Centre%20Test/)
  // Liste partagée, historique Coachs, visites, chiffres et fiche renommés
  const adds = valeur(ecrituresSur(ecritures, 'app_config').find((e) => (e.corps as { value: string }).value.includes('Nantes Centre Test'))!)
  expect(adds.map((m: { n: string }) => m.n)).toContain('Nantes Centre Test')
  expect(adds.map((m: { n: string }) => m.n)).not.toContain('Nantes Test')
  for (const t of ['reassigns', 'visits', 'store_finance', 'store_overrides']) {
    expect(ecritures).toContainEqual(expect.objectContaining({ methode: 'PATCH', table: t, filtre: expect.stringContaining('Nantes+Test') }))
  }
  expect(ecrituresSur(ecritures, 'store_overrides').at(-1)!.corps).toMatchObject({ store_name: 'Nantes Centre Test', resp: 'Paul MULTI', tel_resp: '+33 6 00 00 00 00', franchise: true })
  // Les valeurs d'adjoint et de plateforme déjà en base ne sont pas touchées
  expect(ecrituresSur(ecritures, 'store_overrides').at(-1)!.corps).not.toHaveProperty('adj')
  expect(ecrituresSur(ecritures, 'store_overrides').at(-1)!.corps).not.toHaveProperty('plat')
})

test('ajouter puis supprimer un magasin', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins')
  await page.getByRole('button', { name: 'Ajouter un magasin' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter un magasin' })
  await expect(d.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await d.getByLabel('Nom du magasin').fill('Colmar Test')
  await d.getByLabel('Ville').fill('Colmar')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page).toHaveURL(/Colmar%20Test/)
  const adds = valeur(ecrituresSur(ecritures, 'app_config')[0])
  expect(adds.at(-1)).toMatchObject({ n: 'Colmar Test', ville: 'Colmar' })
  expect(adds).toHaveLength(31)

  await page.goto('./#/magasins/Dax%20Test')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await page.getByRole('alert').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByRole('heading', { name: 'Magasins', level: 1 })).toBeVisible()
  expect(ecritures).toContainEqual(expect.objectContaining({ methode: 'DELETE', table: 'store_overrides', filtre: expect.stringContaining('Dax') }))
  expect(ecritures).toContainEqual(expect.objectContaining({ methode: 'DELETE', table: 'reassigns', filtre: expect.stringContaining('Dax') }))
})

test('renommer un Coach le renomme partout', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/equipe/coach/Hugo%20FICTIF')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Modifier Hugo FICTIF' })
  await expect(d.getByLabel('Prénom')).toHaveValue('Hugo')
  await expect(d.getByLabel(/^Nom/)).toHaveValue('FICTIF')
  await d.getByLabel('Prénom').fill('Noé')
  await d.getByLabel(/^Nom/).fill('MODELE')
  await expect(d.getByText('Cette personne existe déjà')).toBeVisible()
  await d.getByLabel('Prénom').fill('Hugo')
  await d.getByLabel(/^Nom/).fill('RENOMME')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page).toHaveURL(/Hugo%20RENOMME/)
  for (const t of ['reassigns', 'cs_overrides', 'recruits', 'leaves', 'visits']) {
    expect(ecritures).toContainEqual(expect.objectContaining({ methode: 'PATCH', table: t, filtre: expect.stringContaining('Hugo+FICTIF') }))
  }
  const configs = ecrituresSur(ecritures, 'app_config').map(valeur)
  expect(configs.find((c) => c.dr_assigns)?.dr_assigns).toContainEqual(expect.objectContaining({ cs: 'Hugo RENOMME', dr: 'rr1' }))
  expect(configs.find((c) => Array.isArray(c) && c.includes('Hugo FICTIF'))).toBeTruthy()
})
