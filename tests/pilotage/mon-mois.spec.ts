import { expect, test, type Page } from '@playwright/test'
import { COMPTE, simulerSupabase, textesTropPetits, type OptionsSimulation } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type OptionsSimulation as OptionsPilotage } from './supabase-simule'

// 222 et 223 (Joseph, 16/11/2026) : accueil du franchisé sur téléphone, un chiffre et une action ; clôture express en
// trois écrans. Données fictives uniquement.
const NOM = 'Annecy Test'
const magasins: MagasinSimule[] = [{ magasin: NOM, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }]
const franchise: OptionsSimulation = { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: [NOM] } }

async function connecter(page: Page, pilotage: OptionsPilotage) {
  await simulerSupabase(page, franchise)
  const ecritures = await simulerPilotage(page, { magasins, role: 'franchise', ...pilotage })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  return ecritures
}

test('222 et 223 : un chiffre, une action, clôture en trois écrans', async ({ page, isMobile }) => {
  // Au 27/10/2026 : août saisi, septembre pas encore
  const ecritures = await connecter(page, { stocks: [{ store_name: NOM, annee: 2026, mois: 8, cave: 60_000, bar: 8_000, exterieur: null }] })
  const carte = page.getByRole('region', { name: 'Mon mois' })
  if (!isMobile) {
    // Sur PC, l'accueil ne change pas : les chiffres restent en tête de la colonne de droite
    await expect(page.getByRole('heading', { name: 'Accueil' })).toBeVisible()
    await expect(carte).toHaveCount(0)
    return
  }
  await expect(carte.getByText(/^CA HT · /)).toBeVisible()
  await expect(carte.getByText('Clôturer septembre')).toBeVisible()
  // La carte passe avant l'actualité
  const yCarte = (await carte.boundingBox())!.y
  const yFil = (await page.getByRole('heading', { name: 'Actualités' }).first().boundingBox())?.y ?? Infinity
  expect(yCarte).toBeLessThan(yFil)
  expect(await textesTropPetits(page)).toEqual([])
  expect(await zonesTropPetites(page)).toEqual([])

  await carte.getByRole('button', { name: 'Clôturer' }).click()
  const fenetre = page.getByRole('dialog', { name: /Clôture de septembre/ })
  await expect(fenetre.getByText('Étape 1 sur 3')).toBeVisible()
  await expect(fenetre.getByLabel('Stock Cave')).toHaveValue(/60\s000/)
  await expect(fenetre.getByLabel('Stock Cave')).toHaveAttribute('data-prerempli', 'oui')
  await expect(fenetre.getByLabel('Stock Extérieur')).toHaveValue('')
  await fenetre.getByLabel('Stock Bar').fill('12000') // +50 % : à relire
  expect(await zonesTropPetites(page)).toEqual([])
  await fenetre.getByRole('button', { name: 'Suivant' }).click()

  await expect(fenetre.getByText('Étape 2 sur 3')).toBeVisible()
  await expect(fenetre.getByRole('listitem', { name: 'Stock Bar' }).getByText('À vérifier')).toBeVisible()
  await expect(fenetre.getByRole('listitem', { name: 'Stock Cave' }).getByText('À vérifier')).toHaveCount(0)
  // Corriger revient aux champs saisis
  await fenetre.getByRole('button', { name: 'Corriger' }).click()
  await expect(fenetre.getByLabel('Stock Bar')).toHaveValue('12000')
  await fenetre.getByLabel('Stock Bar').fill('9000')
  await fenetre.getByRole('button', { name: 'Suivant' }).click()
  await expect(fenetre.getByText('À vérifier')).toHaveCount(0)
  await fenetre.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(fenetre.getByText('Étape 3 sur 3')).toBeVisible()
  await expect(fenetre.getByText('Stock de fin septembre enregistré')).toBeVisible()
  const ecrit = ecritures.filter((e) => e.table === 'stocks' && e.methode === 'POST').at(-1)?.corps as Record<string, unknown>
  expect(ecrit).toMatchObject({ store_name: NOM, annee: 2026, mois: 9, cave: 60_000, bar: 9_000, exterieur: null })
  await fenetre.getByRole('button', { name: 'Terminer' }).click()
  await expect(fenetre).toHaveCount(0)
  // Clôture faite : l'action suivante prend la place
  await expect(carte.getByText('Clôturer septembre')).toHaveCount(0)
  await expect(carte.getByText('À faire maintenant')).toBeVisible()
})

test('222 : clôture déjà faite et rien à rendre, « Rien d’urgent »', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'carte du téléphone')
  await connecter(page, { stocks: [{ store_name: NOM, annee: 2026, mois: 9, cave: 60_000, bar: 8_000, exterieur: null }] })
  const carte = page.getByRole('region', { name: 'Mon mois' })
  await expect(carte.getByText('Clôturer septembre')).toHaveCount(0)
  await expect(carte.getByText(/Rien d’urgent|À faire maintenant/).first()).toBeVisible()
})
