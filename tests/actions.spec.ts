import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

type Libre = { id: string; action: string; porteur: string; echeance: string; creeLe: string; faite?: string; faitePar?: string; auteur?: string }
const derniere = (ecritures: Ecriture[]): Record<string, Libre[]> | undefined => {
  const e = ecritures.filter((x) => x.table === 'app_config' && ((x.corps as { key?: string }).key === 'actions' || x.filtre.includes('key=eq.actions'))).at(-1)
  return e ? JSON.parse((e.corps as { value: string }).value) : undefined
}
const aujourdhui = () => new Date().toISOString().slice(0, 10)

async function ouvrirActions(page: Page, isMobile: boolean) {
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Actions', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^(Mes actions|Actions)$/)
}

test('le Directeur ouvre ses actions depuis la navigation, en coche une et en ajoute une', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  const actions = { 'Brest Test': [{ id: 'l1', action: 'Commander la nouvelle PLV', porteur: 'Noé MODELE', echeance: '2026-10-01', creeLe: '2026-09-25', auteur: 'Noé MODELE' }] }
  await seConnecter(page, { ecritures, persister: true, config: { actions } })
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  // Téléphone : Actions dans la barre du bas, la santé du parc passe dans « Plus »
  if (isMobile) await expect(nav.getByRole('button')).toHaveText(['Dashboard', 'Magasins', 'Visites', 'Actions', 'Plus'])
  await ouvrirActions(page, isMobile)

  const aFaire = page.getByRole('list', { name: 'Actions à faire' })
  const ligne = aFaire.getByRole('listitem').filter({ hasText: 'Commander la nouvelle PLV' })
  await expect(ligne).toContainText('Brest Test')
  await expect(ligne).toContainText('ajoutée le 25 sept. 2026 par Noé MODELE')
  await expect(ligne).toContainText('En retard')
  // Actions des plans de visite aussi
  await expect(aFaire).toContainText('Former l’équipe à la vente additionnelle')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-actions.png`, fullPage: !isMobile })

  await ligne.getByRole('checkbox', { name: 'Marquer faite : Commander la nouvelle PLV' }).click()
  await expect(page.getByText('Action marquée faite.')).toBeVisible()
  const faite = derniere(ecritures)!['Brest Test'][0]
  expect(faite.faite).toBe(aujourdhui())
  expect(faite.faitePar).toBeTruthy()
  const faites = page.getByRole('list', { name: 'Actions faites' })
  await expect(faites.getByRole('listitem').filter({ hasText: 'Commander la nouvelle PLV' })).toContainText(`par ${faite.faitePar}`)

  await page.getByRole('button', { name: 'Ajouter une action' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une action' })
  await d.getByLabel('Magasin').click()
  await page.getByRole('option', { name: 'Lyon Test' }).click()
  await d.getByLabel('Action', { exact: true }).fill('Mettre en avant les coffrets de Noël')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Action ajoutée.')).toBeVisible()
  expect(derniere(ecritures)!['Lyon Test'][0]).toMatchObject({ action: 'Mettre en avant les coffrets de Noël', creeLe: aujourdhui() })
  await expect(aFaire.getByRole('listitem').filter({ hasText: 'Mettre en avant les coffrets de Noël' })).toContainText('Lyon Test')
})

test('une action du plan de visite cochée garde qui l’a faite', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/actions')
  await page.getByRole('list', { name: 'Actions à faire' }).getByRole('checkbox', { name: 'Marquer faite : Former l’équipe à la vente additionnelle' }).click()
  await expect(page.getByText('Action marquée faite.')).toBeVisible()
  const maj = ecritures.filter((e) => e.methode === 'PATCH' && e.table === 'visits').at(-1)!
  const plan = (maj.corps as { action_plan: { action: string; faite?: string; faitePar?: string }[] }).action_plan
  const a = plan.find((x) => x.action === 'Former l’équipe à la vente additionnelle')!
  expect(a.faite).toBe(aujourdhui())
  expect(a.faitePar).toBeTruthy()
})

test('un Coach ne voit que les actions de ses magasins', async ({ page, isMobile }) => {
  const actions = {
    'Brest Test': [{ id: 'l1', action: 'Commander la nouvelle PLV', porteur: '', echeance: '', creeLe: '2026-09-25' }],
    'Nantes Test': [{ id: 'l2', action: 'Action d’un autre Coach', porteur: '', echeance: '', creeLe: '2026-09-25' }],
  }
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' }, config: { actions } })
  await ouvrirActions(page, isMobile)
  await expect(page.getByRole('combobox', { name: 'Vue' })).toHaveCount(0)
  await expect(page.getByText('Commander la nouvelle PLV')).toBeVisible()
  await expect(page.getByText('Action d’un autre Coach')).toHaveCount(0)
})

test('le lien du Dashboard mène à toutes les actions', async ({ page }) => {
  const actions = { 'Brest Test': [{ id: 'l1', action: 'Commander la nouvelle PLV', porteur: '', echeance: '2026-10-01', creeLe: '2026-09-25' }] }
  await seConnecter(page, { config: { actions } })
  await page.getByRole('link', { name: 'Voir toutes les actions' }).click()
  await expect(page).toHaveURL(/#\/actions$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Actions' })).toBeVisible()
})

// Paul MULTI, franchisé fictif d'Annecy Test et de Rennes Test
const PAUL = { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }
const espace = () => ({
  visites: [{ id: 50, store: 'Annecy Test', visit_date: '2026-09-15', type: 'terrain', visitor: 'Hugo FICTIF', signed_required: false, docs: [],
    action_plan: [{ action: 'Lancer une dégustation', porteur: 'Paul MULTI', echeance: '2026-09-30' }, { action: '' }, { action: 'Former au conseil', porteur: 'Hugo FICTIF', echeance: '2099-01-31' }] }],
  actions: { 'Rennes Test': [{ id: 'l9', action: 'Refaire la vitrine', porteur: '', echeance: '', creeLe: '2026-10-01', auteur: 'Hugo FICTIF', faite: '2026-10-05', faitePar: 'Hugo FICTIF' }] },
})

test('le franchisé coche et ajoute ses actions, la base pose son nom', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { acces: PAUL, espace: espace(), ecritures })
  await ouvrirActions(page, isMobile)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes actions')
  await expect(page.getByRole('group', { name: 'Magasins affichés' }).getByRole('button')).toHaveText(['Tous', 'Annecy Test', 'Rennes Test'])
  const aFaire = page.getByRole('list', { name: 'Actions à faire' })
  await expect(aFaire.getByRole('listitem')).toHaveCount(2)
  const faites = page.getByRole('list', { name: 'Actions faites' })
  await expect(faites.getByRole('listitem').filter({ hasText: 'Refaire la vitrine' })).toContainText('faite le 5 oct. 2026 par Hugo FICTIF')
  // Pas de modification ni de suppression pour le franchisé
  await expect(page.getByRole('button', { name: /Modifier l’action/ })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) for (const c of await page.getByRole('checkbox').all()) expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await page.screenshot({ path: `captures/${info.project.name}-franchise-actions.png`, fullPage: true })

  // Action du plan de visite (la ligne vide du plan est ignorée, comme dans la base)
  await aFaire.getByRole('checkbox', { name: 'Marquer faite : Former au conseil' }).click()
  await expect(page.getByText('Action marquée faite.')).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'rpc/marquer_action_franchise').at(-1)!.corps).toEqual({ p_store: 'Annecy Test', p_faite: true, p_visite: 50, p_index: 1, p_texte: 'Former au conseil' })
  await expect(faites.getByRole('listitem').filter({ hasText: 'Former au conseil' })).toContainText('par Paul MULTI')

  // Remise à faire
  await faites.getByRole('checkbox', { name: 'Remettre en cours : Refaire la vitrine' }).click()
  await expect(page.getByText('Action remise à faire.')).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'rpc/marquer_action_franchise').at(-1)!.corps).toEqual({ p_store: 'Rennes Test', p_faite: false, p_libre: 'l9' })
  await expect(aFaire.getByText('Refaire la vitrine')).toBeVisible()

  // Ajout
  await page.getByRole('button', { name: 'Ajouter une action' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une action' })
  await d.getByLabel('Magasin').click()
  await page.getByRole('option', { name: 'Annecy Test' }).click()
  await d.getByLabel('Action', { exact: true }).fill('Commander les verres à vin')
  await d.getByLabel('Échéance', { exact: true }).fill('2099-03-01')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Action ajoutée.')).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'rpc/ajouter_action_franchise').at(-1)!.corps).toEqual({ p_store: 'Annecy Test', p_action: 'Commander les verres à vin', p_porteur: '', p_echeance: '2099-03-01' })
  await expect(aFaire.getByRole('listitem').filter({ hasText: 'Commander les verres à vin' })).toContainText('par Paul MULTI')
  // Le franchisé n'écrit dans aucune table directement
  expect(ecritures.filter((e) => !e.table.startsWith('rpc/'))).toEqual([])
})

test('franchisé : un message humain si la base n’est pas encore prête', async ({ page }) => {
  await seConnecter(page, { acces: PAUL, espace: espace() })
  await page.route('**/rest/v1/rpc/marquer_action_franchise', (r) => r.fulfill({ status: 404, json: { code: 'PGRST202', message: 'Could not find the function public.marquer_action_franchise' } }))
  await page.goto('./#/actions')
  await page.getByRole('checkbox', { name: 'Marquer faite : Former au conseil' }).click()
  await expect(page.getByText('Les actions ne peuvent pas encore être modifiées depuis ton espace. Ton Coach peut le faire pour toi.')).toBeVisible()
})
