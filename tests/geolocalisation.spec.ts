import { expect, test } from '@playwright/test'
import { fichesFictives, magasinsFictifs } from './donnees-fictives'
import { seConnecter, type Ecriture } from './supabase-simule'

const positions = (e: Ecriture[]) => e.filter((x) => x.table === 'store_overrides' && (x.corps as { lat?: number })?.lat !== undefined)

test('un magasin posé au chef-lieu de son département retrouve sa vraie position', async ({ page }) => {
  const ecritures: Ecriture[] = []
  // Import Excel de l'ancienne app : Redon (35) posé provisoirement sur Rennes
  const magasins = [...magasinsFictifs, { n: 'Redon Test', dept: '35', open: '2020-03-01', addr: '1 rue de l’Exemple, 35600 Redon', cp: '35600', ville: 'Redon', lat: 48.11, lon: -1.68, geo: 'dept' }]
  await seConnecter(page, { ecritures, config: { store_adds: magasins } })
  await expect.poll(() => positions(ecritures).length).toBe(1)
  expect(positions(ecritures)[0]).toEqual(expect.objectContaining({ methode: 'POST', corps: expect.objectContaining({ store_name: 'Redon Test', lat: 47.65, lon: -1.65 }) }))
})

test('changer l’adresse d’un magasin déplace son point', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Nantes%20Test')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Modifier Nantes Test' })
  await d.getByLabel('Code postal').fill('35600')
  await d.getByLabel('Ville').fill('Redon')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect.poll(() => positions(ecritures).length).toBe(1)
  expect(positions(ecritures)[0].corps).toEqual(expect.objectContaining({ lat: 47.65, lon: -1.65 }))
})

test('un Coach dont le domicile est loin de la ville de sa fiche est replacé dans sa commune', async ({ page }) => {
  const ecritures: Ecriture[] = []
  // Domicile enregistré près de Lyon alors que la fiche indique Lille ; les autres Coachs n'ont pas de ville
  const fiches = { ...fichesFictives, 'coach:Camille TESTARD': { prenom: 'Camille', nom: 'TESTARD', codePostal: '59000', departement: '59', ville: 'Lille', pays: 'France' } }
  await seConnecter(page, { ecritures, config: { fiches_personnes: fiches } })
  const domiciles = () => ecritures.filter((x) => x.table === 'cs_overrides' && (x.corps as { lat?: number })?.lat !== undefined)
  await expect.poll(() => domiciles().length).toBe(1)
  expect(domiciles()[0]).toEqual(expect.objectContaining({ methode: 'PATCH', filtre: expect.stringContaining('Camille'), corps: expect.objectContaining({ lat: 50.63, lon: 3.06, ville: 'Lille' }) }))
})
