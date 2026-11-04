import { expect, test, type Page } from '@playwright/test'
import { COMPTE, ouvrirOnglet, simulerSupabase, textesTropPetits, type OptionsSimulation } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type OptionsSimulation as OptionsPilotage } from './supabase-simule'

// Fusion, suite (Joseph, 04/11/2026) : le CA vient de la caisse, groupe budgétaire sur la fiche, commentaires de budget
// en notification. Données fictives uniquement.

const magasins: MagasinSimule[] = [
  { magasin: 'Annecy Test', statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z', groupe_id: 1 },
  { magasin: 'Lyon Test', statut: 'valide', hypotheses: magasinFictif, maj_le: '2026-10-22T16:05:00Z' },
]
const groupes = [{ id: 1, nom: 'Alpes', cibles: null }, { id: 2, nom: 'Grandes villes', cibles: null }]

async function connecter(page: Page, reseau: OptionsSimulation, pilotage: OptionsPilotage) {
  await simulerSupabase(page, reseau)
  const ecritures = await simulerPilotage(page, { magasins, groupes, ...pilotage })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  return ecritures
}

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('un mois importé de la caisse ne se saisit plus à la main ; un mois sans caisse, si', async ({ page, isMobile }, info) => {
  const ecritures: NonNullable<OptionsSimulation['ecritures']> = []
  await connecter(page, { ecritures, chiffresCaisse: [{ store_name: 'Annecy Test', month: '2026-09-01', ca_cave: 81000, ca_bar: 9000, ca_ext: 0, pm_cave: 45, flux_cave: 1800, pm_bar: 15, flux_bar: 600, freq: 2400, panier: 37.5, marge: 41.2 }] }, {})
  await page.goto('./#/magasins/Annecy%20Test?vue=chiffres')
  await page.getByRole('button', { name: 'Saisir les chiffres' }).click()
  const d = page.getByRole('dialog', { name: 'Chiffres de Annecy Test' })
  await expect(d.getByLabel('Mois')).toHaveText('septembre 2026')
  await expect(d.getByRole('status')).toHaveText('Chiffres de septembre 2026 importés de la caisse : ils ne se modifient pas ici.')
  await expect(d.getByLabel('Panier moyen HT cave (€)')).toBeDisabled()
  await expect(d.getByLabel('Panier moyen HT cave (€)')).toHaveValue('45')
  await expect(d.getByRole('button', { name: 'Supprimer' })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await d.screenshot({ path: `captures/${info.project.name}-chiffres-caisse.png` })
  // Août n'a pas de caisse : la saisie reste ouverte
  await d.getByLabel('Mois').click()
  await page.getByRole('option', { name: 'août 2026', exact: true }).click()
  await expect(d.getByRole('status')).toHaveCount(0)
  await expect(d.getByLabel('Panier moyen HT cave (€)')).toBeEnabled()
  await expect(d.getByRole('button', { name: 'Supprimer' })).toBeVisible()
  expect(ecritures.some((e) => e.table === 'rpc/chiffres_mensuels')).toBe(false)
})

test('sans la mise à jour 0039, les chiffres saisis restent lus comme avant', async ({ page }) => {
  await connecter(page, { chiffresCaisse: null }, {})
  await page.goto('./#/magasins/Annecy%20Test?vue=chiffres')
  await page.getByRole('button', { name: 'Saisir les chiffres' }).click()
  const d = page.getByRole('dialog', { name: 'Chiffres de Annecy Test' })
  await expect(d.getByLabel('Panier moyen HT cave (€)')).toBeEnabled()
  await expect(d.getByRole('status')).toHaveCount(0)
})

test('le Directeur range le magasin dans un groupe budgétaire depuis sa fiche', async ({ page, isMobile }) => {
  const ecritures = await connecter(page, {}, {})
  await page.goto('./#/magasins/Annecy%20Test')
  const champ = page.getByLabel('Groupe budgétaire')
  await expect(champ).toHaveText('Alpes')
  await champ.click()
  await page.getByRole('option', { name: 'Grandes villes' }).click()
  await expect(champ).toHaveText('Grandes villes')
  expect(ecritures.find((e) => e.table === 'groupe_magasins')?.corps).toEqual({ store_name: 'Annecy Test', groupe_id: 2 })
  await champ.click()
  await page.getByRole('option', { name: 'Aucun' }).click()
  await expect.poll(() => ecritures.filter((e) => e.table === 'groupe_magasins' && e.methode === 'DELETE').length).toBe(1)
  if (isMobile) expect((await champ.boundingBox())!.height).toBeGreaterThanOrEqual(48)
})

test('le Coach lit le groupe sans le changer', async ({ page }) => {
  await connecter(page, { appMetadata: { role: 'coach', coach: 'Hugo FICTIF' } }, { role: 'coach' })
  await page.goto('./#/magasins/Annecy%20Test')
  await expect(page.getByText('Groupe budgétaire', { exact: true })).toBeVisible()
  await expect(page.getByText('Alpes', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Groupe budgétaire')).toHaveCount(0)
})

test('sans groupe budgétaire créé, la fiche n’a pas la ligne', async ({ page }) => {
  await connecter(page, {}, { groupes: [] })
  await page.goto('./#/magasins/Annecy%20Test')
  await expect(page.getByText('Code magasin')).toBeVisible()
  await expect(page.getByText('Groupe budgétaire')).toHaveCount(0)
})

test('un commentaire posé sur le budget part en notification vers les autres comptes du magasin', async ({ page }) => {
  const envois: unknown[] = []
  await connecter(page, {}, {})
  // Après les simulateurs : la dernière route posée répond la première
  await page.route('https://supabase.test/functions/v1/notifier', (r) => { envois.push(r.request().postDataJSON()); return r.fulfill({ json: { envoyees: 2 } }) })
  await page.goto('./#/magasins/Annecy%20Test?vue=budget&partie=budget')
  await ouvrirOnglet(page, 'Budget')
  const panneau = page.getByRole('region', { name: 'Commentaires', exact: true })
  await page.getByRole('button', { name: 'Commenter : Ventes Cave' }).click()
  await panneau.getByRole('textbox', { name: 'Commenter : Ventes Cave' }).fill('On vise plutôt +2 % de tickets.')
  await panneau.getByRole('button', { name: 'Commenter', exact: true }).click()
  await expect.poll(() => envois).toEqual([{ type: 'budget', ids: [1] }])
})

// Une seule liste de tâches (Joseph, 04/11/2026, « Tâche réseau avec la mesure ») : l'action du budget est une tâche du réseau
const tacheBudget = {
  id: 'b_7', action: 'Relancer la vente additionnelle', porteur: 'Paul MULTI', echeance: '2026-11-30', creeLe: '2026-10-01', auteur: 'Hugo FICTIF',
  budget: { type: 'ca', annee: 2026, responsable: 'franchise', depart: { valeur: -6.5, mois: 9 }, origine: 7, role: 'coach' },
}
const ancienne = (id: number, intitule: string) => ({
  id, store_name: 'Annecy Test', type_alerte: 'autre', intitule, responsable: 'coach', echeance: null, statut: 'a_faire', annee: 2026,
  depart: null, mois_depart: null, cree_par_role: 'directeur', cree_par_nom: 'Dominique DIRECTION', cree_le: '2026-09-01T08:00:00Z', faite_le: null,
})
const tachesEcrites = (ecritures: NonNullable<OptionsSimulation['ecritures']>) => ecritures.filter((e) => e.methode === 'SUIVI' && (e.corps as { key: string }).key === 'actions')
  .map((e) => JSON.parse((e.corps as { value: string }).value) as Record<string, Record<string, unknown>[]>)

test('une action ajoutée au plan du budget devient une tâche du magasin, avec son porteur', async ({ page, isMobile }) => {
  const ecritures: NonNullable<OptionsSimulation['ecritures']> = []
  const pilotage = await connecter(page, { ecritures, persister: true }, {})
  await page.goto('./#/magasins/Annecy%20Test?vue=budget')
  const plan = page.getByRole('region', { name: 'Plan d’action' })
  await plan.getByRole('button', { name: 'Ajouter une action' }).click()
  const form = plan.getByRole('form', { name: 'Nouvelle action' })
  await form.getByLabel('Action').fill('Former l’équipe au conseil')
  await form.getByLabel('Qui').click()
  await page.getByRole('option', { name: 'Coach' }).click()
  await form.getByRole('button', { name: 'Ajouter au plan' }).click()
  await expect(plan.getByRole('list', { name: 'Actions en cours' }).getByText('Former l’équipe au conseil')).toBeVisible()
  const tache = tachesEcrites(ecritures).at(-1)?.['Annecy Test']?.find((t) => t.action === 'Former l’équipe au conseil')
  expect(tache).toMatchObject({ porteur: 'Hugo FICTIF', echeance: '', budget: { type: 'autre', responsable: 'coach', depart: null, role: 'directeur' } })
  expect(pilotage.some((e) => e.table === 'actions')).toBe(false)
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  // La même tâche, dans la liste des tâches du magasin
  await page.goto('./#/magasins/Annecy%20Test?vue=actions')
  const liste = page.getByRole('list', { name: 'Tâches en cours de Annecy Test' })
  await expect(liste.getByText('Former l’équipe au conseil')).toBeVisible()
  await expect(liste.getByText(/Hugo FICTIF · .* · Budget/)).toBeVisible()
})

test('le plan du budget lit les tâches du magasin avec leur mesure ; une action déjà reprise ne se voit qu’une fois', async ({ page }, info) => {
  const ecritures: NonNullable<OptionsSimulation['ecritures']> = []
  await connecter(page, { ecritures, persister: true, config: { actions: { 'Annecy Test': [tacheBudget, { id: 'l_x', action: 'Refaire la vitrine', porteur: '', echeance: '', creeLe: '2026-10-02' }] } } },
    { actions: [ancienne(7, 'Relancer la vente additionnelle'), ancienne(8, 'Revoir le planning')] })
  await page.goto('./#/magasins/Annecy%20Test?vue=budget')
  const plan = page.getByRole('region', { name: 'Plan d’action' })
  const enCours = plan.getByRole('list', { name: 'Actions en cours' })
  await expect(enCours.getByText('Relancer la vente additionnelle')).toHaveCount(1)
  await expect(enCours.getByText('Revoir le planning')).toBeVisible()
  await expect(enCours.getByText('Refaire la vitrine')).toHaveCount(0)
  await expect(plan.getByText(/Au départ : /)).toBeVisible()
  await plan.screenshot({ path: `captures/${info.project.name}-plan-action-taches.png` })
  await plan.getByRole('button', { name: 'Abandonner : Relancer la vente additionnelle' }).click()
  await expect(enCours.getByText('Relancer la vente additionnelle')).toHaveCount(0)
  const t = tachesEcrites(ecritures).at(-1)?.['Annecy Test']?.find((x) => x.id === 'b_7')
  expect(t).toMatchObject({ faite: '2026-10-27', budget: { abandonnee: true, depart: { valeur: -6.5, mois: 9 } } })
  await plan.getByRole('button', { name: /Actions closes/ }).click()
  await expect(plan.getByRole('list', { name: 'Actions closes' }).getByText('abandonnée')).toBeVisible()
})

test('le franchisé coche la tâche du budget faite, sans pouvoir l’abandonner', async ({ page }) => {
  const ecritures: NonNullable<OptionsSimulation['ecritures']> = []
  await connecter(page, { ecritures, acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] }, espace: { actions: { 'Annecy Test': [tacheBudget] } } },
    { role: 'franchise', magasins: [magasins[0]] })
  await page.goto('./#/magasins/Annecy%20Test?vue=budget')
  const plan = page.getByRole('region', { name: 'Plan d’action' })
  await expect(plan.getByText('Relancer la vente additionnelle')).toBeVisible()
  await expect(plan.getByRole('button', { name: /^Abandonner/ })).toHaveCount(0)
  await expect(plan.getByRole('button', { name: /^Retirer/ })).toHaveCount(0)
  await plan.getByRole('button', { name: 'Faite : Relancer la vente additionnelle' }).click()
  await expect.poll(() => ecritures.find((e) => e.table === 'rpc/marquer_action_franchise')?.corps).toEqual({ p_store: 'Annecy Test', p_faite: true, p_libre: 'b_7' })
})
