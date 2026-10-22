import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, deplierATraiter } from './supabase-simule'

// Sur téléphone, les filtres de la barre (liste, magasins) sont repliés derrière « Filtres »
async function deplierFiltres(page: Page) {
  // La barre doit être affichée avant de savoir si les filtres sont repliés (téléphone)
  await page.getByRole('textbox', { name: 'Rechercher une tâche' }).waitFor()
  const bouton = page.getByRole('button', { name: 'Filtres' })
  if (await bouton.isVisible() && (await bouton.getAttribute('aria-expanded')) !== 'true') await bouton.click()
}

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

// Tâches : volet « Mes tâches » de l'onglet Échanges (Joseph, 21/10/2026)
async function ouvrirTaches(page: Page) {
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: /^Échanges/ }).click()
  await page.getByRole('tablist', { name: 'Échanges' }).getByRole('tab', { name: /^Mes tâches/ }).click()
  await expect(page).toHaveURL(/#\/echanges\?vue=taches$/)
}

const DIRECTEUR = 'Dominique DIRECTION'

test('le Directeur ne voit que les tâches qui lui sont attribuées, les coche et en ajoute', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  const actions = { 'Brest Test': [
    { id: 'l1', action: 'Commander la nouvelle PLV', porteur: DIRECTEUR, echeance: '2026-10-01', creeLe: '2026-09-25', auteur: 'Noé MODELE' },
    { id: 'l2', action: 'Relancer le fournisseur', porteur: 'Noé MODELE', echeance: '', creeLe: '2026-09-25' },
  ] }
  await seConnecter(page, { ecritures, persister: true, config: { actions } })
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  // Tâches et messages sont réunis dans Échanges
  await expect(nav.getByRole('button', { name: /Tâches|Actions|Messages/ })).toHaveCount(0)
  if (isMobile) await expect(nav.getByRole('button')).toHaveText(['Accueil', 'Magasins', /^Échanges/, 'Visites', /^Santé/])
  await ouvrirTaches(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Échanges')
  // Le volet compte ses tâches à faire
  await expect(page.getByRole('tab', { name: 'Mes tâches · 1' })).toHaveAttribute('aria-selected', 'true')

  const aFaire = page.getByRole('list', { name: 'Tâches à faire' })
  await expect(aFaire.getByRole('listitem')).toHaveCount(1)
  const ligne = aFaire.getByRole('listitem').filter({ hasText: 'Commander la nouvelle PLV' })
  await expect(ligne).toContainText('Brest Test')
  await expect(ligne).toContainText('ajoutée le 25 sept. 2026 par Noé MODELE')
  await expect(ligne).toContainText('En retard')
  // Les actions des autres porteurs n'y sont pas
  await expect(page.getByText('Relancer le fournisseur')).toHaveCount(0)
  await expect(page.getByText('Former l’équipe à la vente additionnelle')).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-actions.png`, fullPage: !isMobile })

  await ligne.getByRole('checkbox', { name: 'Marquer faite : Commander la nouvelle PLV' }).click()
  await expect(page.getByText('Tâche marquée faite.')).toBeVisible()
  const faite = derniere(ecritures)!['Brest Test'][0]
  expect(faite.faite).toBe(aujourdhui())
  expect(faite.faitePar).toBeTruthy()
  const faites = page.getByRole('list', { name: 'Tâches faites' })
  await expect(faites.getByRole('listitem').filter({ hasText: 'Commander la nouvelle PLV' })).toContainText(`par ${faite.faitePar}`)

  // Ajoutée depuis sa liste : il en est le porteur
  await page.getByRole('button', { name: 'Ajouter une tâche' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une tâche' })
  await d.getByLabel('Magasin').click()
  await page.getByRole('option', { name: 'Lyon Test' }).click()
  await d.getByLabel('Tâche', { exact: true }).fill('Mettre en avant les coffrets de Noël')
  await expect(d.getByRole('button', { name: DIRECTEUR })).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Tâche ajoutée.')).toBeVisible()
  expect(derniere(ecritures)!['Lyon Test'][0]).toMatchObject({ action: 'Mettre en avant les coffrets de Noël', porteur: DIRECTEUR, creeLe: aujourdhui() })
  await expect(aFaire.getByRole('listitem').filter({ hasText: 'Mettre en avant les coffrets de Noël' })).toContainText('Lyon Test')

  // Il ouvre la liste d'un Coach
  await deplierFiltres(page)
  await page.getByLabel('Liste de').click()
  await page.getByRole('option', { name: 'Noé MODELE' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tâches de Noé MODELE')
  await expect(aFaire).toContainText('Relancer le fournisseur')
  await expect(aFaire).toContainText('Former l’équipe à la vente additionnelle')
  await expect(page.getByText('Commander la nouvelle PLV')).toHaveCount(0)
})

test('une action du plan de visite cochée garde qui l’a faite', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/taches?de=No%C3%A9%20MODELE')
  await page.getByRole('list', { name: 'Tâches à faire' }).getByRole('checkbox', { name: 'Marquer faite : Former l’équipe à la vente additionnelle' }).click()
  await expect(page.getByText('Tâche marquée faite.')).toBeVisible()
  const maj = ecritures.filter((e) => e.methode === 'PATCH' && e.table === 'visits').at(-1)!
  const plan = (maj.corps as { action_plan: { action: string; faite?: string; faitePar?: string }[] }).action_plan
  const a = plan.find((x) => x.action === 'Former l’équipe à la vente additionnelle')!
  expect(a.faite).toBe(aujourdhui())
  expect(a.faitePar).toBeTruthy()
})

test('un Coach ne voit que les tâches qui lui sont attribuées', async ({ page }) => {
  const actions = {
    'Brest Test': [{ id: 'l1', action: 'Commander la nouvelle PLV', porteur: 'Noé MODELE', echeance: '', creeLe: '2026-09-25' }],
    'Nantes Test': [{ id: 'l2', action: 'Action d’un autre magasin', porteur: 'Noé MODELE', echeance: '', creeLe: '2026-09-25' }],
  }
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' }, config: { actions } })
  await ouvrirTaches(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Échanges')
  // Sa liste ou celle de ses franchisés, jamais celle d'un autre Coach
  await deplierFiltres(page)
  await page.getByLabel('Liste de').click()
  await expect(page.getByRole('option')).toHaveText(['Mes tâches', 'Franchisés de mes magasins'])
  await page.keyboard.press('Escape')
  const aFaire = page.getByRole('list', { name: 'Tâches à faire' })
  await expect(aFaire).toContainText('Commander la nouvelle PLV')
  await expect(aFaire).toContainText('Former l’équipe à la vente additionnelle')
  // Celles du franchisé et celles hors de ses magasins n'y sont pas
  await expect(page.getByText('Refaire la vitrine')).toHaveCount(0)
  await expect(page.getByText('Action d’un autre magasin')).toHaveCount(0)
})

test('une tâche à plusieurs porteurs figure dans la liste de chacun', async ({ page }) => {
  const actions = { 'Brest Test': [{ id: 'l1', action: 'Préparer la soirée dégustation', porteur: 'Franchisé 11, Noé MODELE', echeance: '', creeLe: '2026-09-25' }] }
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' }, config: { actions } })
  await ouvrirTaches(page)
  const aFaire = page.getByRole('list', { name: 'Tâches à faire' })
  await expect(aFaire).toContainText('Préparer la soirée dégustation')
  await deplierFiltres(page)
  await page.getByLabel('Liste de').click()
  await page.getByRole('option', { name: 'Franchisés de mes magasins' }).click()
  await expect(aFaire.getByRole('listitem').filter({ hasText: 'Préparer la soirée dégustation' })).toContainText('Franchisé 11, Noé MODELE')
})

test('le Coach ouvre la liste des tâches des franchisés de ses magasins', async ({ page }, info) => {
  const actions = {
    'Brest Test': [{ id: 'l1', action: 'Envoyer le bilan du mois', porteur: 'Franchisé 11', echeance: '', creeLe: '2026-09-25' }],
    'Nantes Test': [{ id: 'l2', action: 'Tâche d’un franchisé d’un autre Coach', porteur: 'Franchisé 2', echeance: '', creeLe: '2026-09-25' }],
  }
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' }, config: { actions } })
  await ouvrirTaches(page)
  await deplierFiltres(page)
  await page.getByLabel('Liste de').click()
  await page.getByRole('option', { name: 'Franchisés de mes magasins' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tâches des franchisés')
  const aFaire = page.getByRole('list', { name: 'Tâches à faire' })
  // Le porteur est affiché ; les tâches du Coach n'y sont pas
  await expect(aFaire.getByRole('listitem').filter({ hasText: 'Refaire la vitrine' })).toContainText('Franchisé 11')
  await expect(aFaire).toContainText('Envoyer le bilan du mois')
  await expect(aFaire).not.toContainText('Former l’équipe à la vente additionnelle')
  await expect(page.getByText('Tâche d’un franchisé d’un autre Coach')).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-taches-franchises.png`, fullPage: true })
})

test('une tâche en retard de l’accueil mène aux actions du magasin', async ({ page }) => {
  const actions = { 'Brest Test': [{ id: 'l1', action: 'Commander la nouvelle PLV', porteur: '', echeance: '2026-10-01', creeLe: '2026-09-25' }] }
  await seConnecter(page, { config: { actions } })
  // La tâche en retard apparaît dans « À traiter » de l'accueil et mène aux tâches du magasin
  const aTraiter = page.getByRole('region', { name: 'À traiter' })
  await deplierATraiter(page)
  const ligne = aTraiter.getByRole('link', { name: /^Commander la nouvelle PLV/ })
  await expect(ligne).toContainText('Brest Test')
  await expect(ligne).toContainText('En retard')
  await ligne.click()
  await expect(page).toHaveURL(/#\/magasins\/Brest%20Test\?vue=actions$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Brest Test' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /^Tâches/, selected: true })).toBeVisible()
  await expect(page.getByText('Commander la nouvelle PLV')).toBeVisible()
})

// Paul MULTI, franchisé fictif d'Annecy Test et de Rennes Test
const PAUL = { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test', 'Rennes Test'] }
const espace = () => ({
  visites: [{ id: 50, store: 'Annecy Test', visit_date: '2026-09-15', type: 'terrain', visitor: 'Hugo FICTIF', signed_required: false, docs: [],
    action_plan: [{ action: 'Lancer une dégustation', porteur: 'Paul MULTI', echeance: '2026-09-30' }, { action: '' }, { action: 'Former au conseil', porteur: 'Hugo FICTIF', echeance: '2099-01-31' }] }],
  actions: { 'Rennes Test': [{ id: 'l9', action: 'Refaire la vitrine', porteur: 'Paul MULTI', echeance: '', creeLe: '2026-10-01', auteur: 'Hugo FICTIF', faite: '2026-10-05', faitePar: 'Hugo FICTIF' }] },
})

test('le franchisé voit la tâche qu’il porte avec son Coach', async ({ page }) => {
  const e = espace()
  e.visites[0].action_plan[2].porteur = 'Hugo FICTIF, Paul MULTI'
  await seConnecter(page, { acces: PAUL, espace: e })
  await ouvrirTaches(page)
  const aFaire = page.getByRole('list', { name: 'Tâches à faire' })
  await expect(aFaire.getByRole('listitem')).toHaveCount(2)
  await expect(aFaire).toContainText('Former au conseil')
})

test('le franchisé coche et ajoute ses actions, la base pose son nom', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { acces: PAUL, espace: espace(), ecritures })
  await ouvrirTaches(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Échanges')
  await deplierFiltres(page)
  await expect(page.getByRole('group', { name: 'Magasins affichés' }).getByRole('button')).toHaveText(['Tous', 'Annecy Test', 'Rennes Test'])
  const aFaire = page.getByRole('list', { name: 'Tâches à faire' })
  // Seule l'action dont il est le porteur ; celle du Coach n'y est pas
  await expect(aFaire.getByRole('listitem')).toHaveCount(1)
  await expect(page.getByText('Former au conseil')).toHaveCount(0)
  const faites = page.getByRole('list', { name: 'Tâches faites' })
  await expect(faites.getByRole('listitem').filter({ hasText: 'Refaire la vitrine' })).toContainText('faite le 5 oct. 2026 par Hugo FICTIF')
  // Pas de modification ni de suppression pour le franchisé
  await expect(page.getByRole('button', { name: /Modifier la tâche/ })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) for (const c of await page.getByRole('checkbox').all()) expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await page.screenshot({ path: `captures/${info.project.name}-franchise-actions.png`, fullPage: true })

  // Action du plan de visite (la ligne vide du plan est ignorée, comme dans la base)
  await aFaire.getByRole('checkbox', { name: 'Marquer faite : Lancer une dégustation' }).click()
  await expect(page.getByText('Tâche marquée faite.')).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'rpc/marquer_action_franchise').at(-1)!.corps).toEqual({ p_store: 'Annecy Test', p_faite: true, p_visite: 50, p_index: 0, p_texte: 'Lancer une dégustation' })
  await expect(faites.getByRole('listitem').filter({ hasText: 'Lancer une dégustation' })).toContainText('par Paul MULTI')

  // Remise à faire
  await faites.getByRole('checkbox', { name: 'Remettre en cours : Refaire la vitrine' }).click()
  await expect(page.getByText('Tâche remise à faire.')).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'rpc/marquer_action_franchise').at(-1)!.corps).toEqual({ p_store: 'Rennes Test', p_faite: false, p_libre: 'l9' })
  await expect(aFaire.getByText('Refaire la vitrine')).toBeVisible()

  // Ajout
  await page.getByRole('button', { name: 'Ajouter une tâche' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter une tâche' })
  await d.getByLabel('Magasin').click()
  await page.getByRole('option', { name: 'Annecy Test' }).click()
  await d.getByLabel('Tâche', { exact: true }).fill('Commander les verres à vin')
  await d.getByLabel('Échéance', { exact: true }).fill('2099-03-01')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Tâche ajoutée.')).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'rpc/ajouter_action_franchise').at(-1)!.corps).toEqual({ p_store: 'Annecy Test', p_action: 'Commander les verres à vin', p_porteur: 'Paul MULTI', p_echeance: '2099-03-01' })
  await expect(aFaire.getByRole('listitem').filter({ hasText: 'Commander les verres à vin' })).toContainText('par Paul MULTI')
  // Le franchisé n'écrit dans aucune table directement
  expect(ecritures.filter((e) => !e.table.startsWith('rpc/'))).toEqual([])
})

test('franchisé : un message humain si la base n’est pas encore prête', async ({ page }) => {
  await seConnecter(page, { acces: PAUL, espace: espace() })
  await page.route('**/rest/v1/rpc/marquer_action_franchise', (r) => r.fulfill({ status: 404, json: { code: 'PGRST202', message: 'Could not find the function public.marquer_action_franchise' } }))
  await page.goto('./#/taches')
  await page.getByRole('checkbox', { name: 'Marquer faite : Lancer une dégustation' }).click()
  await expect(page.getByText('Les tâches ne peuvent pas encore être modifiées depuis ton espace. Ton Coach peut le faire pour toi.')).toBeVisible()
})
