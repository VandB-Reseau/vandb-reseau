import { expect, test, type Page } from '@playwright/test'
import { COMPTE, seConnecter, simulerSupabase, textesTropPetits, type Ecriture, type OptionsSimulation } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Choix 183 à 185 (Joseph, 15/11/2026) : « Mon meilleur levier », une simulation qui devient une priorité mesurée en
// caisse, le journal des opérations commerciales et sa vue réseau. Données fictives uniquement.
const NOM = 'Annecy Test'
const budget = (magasin: string): MagasinSimule => ({ magasin, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' })
const franchise: OptionsSimulation = { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: [NOM] } }
const coach: OptionsSimulation = { appMetadata: { role: 'coach', coach: 'Hugo FICTIF' } }

async function connecter(page: Page, reseau: OptionsSimulation, role?: 'franchise' | 'coach') {
  await simulerSupabase(page, reseau)
  await simulerPilotage(page, { magasins: [budget(NOM)], parametres: { tauxRedevance: 0.02, tauxPublicite: 0.01, simulateurs: { coutHoraire: 20 } }, ...(role ? { role } : {}) })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
}
const derniere = (ecritures: Ecriture[], cle: string) => {
  const e = ecritures.filter((x) => x.table === 'app_config' && (x.corps as { key?: string }).key === cle).at(-1)
  return e ? JSON.parse((e.corps as { value: string }).value) : null
}

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('183-184 : le meilleur levier en tête, puis une priorité mesurée en caisse', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await connecter(page, { ...coach, ecritures }, 'coach')
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=simulateurs`)
  // Ouvert d'office sur « Mon meilleur levier », premier des simulateurs
  await expect(page.getByRole('heading', { name: 'Mon meilleur levier' })).toBeVisible()
  const liste = page.getByRole('list', { name: 'Leviers du plus au moins rentable' })
  await expect(liste.getByRole('listitem')).toHaveCount(4)
  await expect(page.locator('#carte-simulation').getByRole('status')).toContainText(/^Pour Annecy Test, le levier qui rapporte le plus est : .+, soit [\d\s]+\s€ d’EBE par an, devant .+\.$/)
  // Budget fictif : Cave seule visée en tickets, sans panier visé → marge, heures, tickets Cave, tickets Bar
  // Les gains sont rangés du plus fort au plus faible
  const gains = (await liste.getByText(/€ ?d’EBE par an$/).allInnerTexts()).map((t) => Number(t.split('€')[0].replace(/[^\d−-]/g, '').replace('−', '-')))
  expect(gains).toEqual([...gains].sort((a, b) => b - a))
  // Plus de tickets : la ligne change quand l'effort change
  await page.getByLabel('Tickets de plus par jour').fill('3')
  await expect(liste.getByRole('listitem', { name: /3 tickets de plus par jour en Cave$/ })).toBeVisible()
  // Pas de « Garder » ici : la ligne se garde en priorité
  await expect(page.getByRole('button', { name: 'Garder' })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  // 184 : la ligne « tickets en Cave » devient une priorité, avec ce que la caisse doit montrer (3 × 307 jours ÷ 12)
  await liste.getByRole('button', { name: 'En faire une priorité : 3 tickets de plus par jour en Cave' }).click()
  const d = page.getByRole('dialog', { name: `Nouvelle priorité pour ${NOM}` })
  await expect(d.getByLabel('Priorité', { exact: true })).toHaveValue('3 tickets de plus par jour en Cave')
  await expect(d.getByLabel('Mesure en caisse')).toContainText('Tickets de la Cave')
  await expect(d.getByLabel(/^Gain attendu par mois/)).toHaveValue('76,75')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  await expect(page.getByRole('alert')).toContainText('Priorité ajoutée au plan. Elle est dans les objectifs et priorités de la fiche du magasin.')
  const plan = derniere(ecritures, 'plans_magasins')?.[NOM] as { titre: string; mesure?: { indicateur: string; attendu: number; depuis: string } }[]
  expect(plan.at(-1)).toEqual(expect.objectContaining({ titre: '3 tickets de plus par jour en Cave', mesure: expect.objectContaining({ indicateur: 'fluxCave', attendu: 76.75, depuis: '2026-11' }) }))
})

test('183 : le franchisé compare ses leviers, sans poser de priorité', async ({ page }) => {
  await connecter(page, franchise, 'franchise')
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=simulateurs&sim=levier`)
  await expect(page.getByRole('list', { name: 'Leviers du plus au moins rentable' }).getByRole('listitem')).toHaveCount(4)
  await expect(page.getByRole('button', { name: /^En faire une priorité/ })).toHaveCount(0)
})

// Nantes recule de 7 % depuis juillet 2026 (100 000 € → 93 000 € par mois) : la priorité née en juillet attend + 2 000 €
const planNantes = { 'Nantes Test': [{ id: 'p1', titre: 'Relancer la Cave', objectif: '', statut: 'active', bilan: '', creeLe: '2026-07-01', par: 'Hugo FICTIF', closLe: '', revueLe: '',
  mesure: { indicateur: 'ca', attendu: 2000, depuis: '2026-08', source: 'Vente additionnelle' } }] }

test('184 : la priorité affiche l’attendu et le constaté, pour l’équipe comme pour le franchisé', async ({ page }) => {
  await seConnecter(page, { config: { plans_magasins: planNantes } })
  await page.goto('./#/magasins/Nantes%20Test')
  const mesure = page.getByRole('group', { name: 'Mesure en caisse de Relancer la Cave' })
  await expect(mesure).toContainText('Attendu : + 2 000 € par mois sur le CA HT du magasin, à partir d’août 2026')
  await expect(mesure).toContainText('Constaté : − 7 000 € par mois face à l’an passé (moyenne de 2 mois, jusqu’à septembre 2026) · 0 % de l’attendu')
  expect(await textesTropPetits(page)).toEqual([])
  await page.context().clearCookies()
  await page.evaluate(() => localStorage.clear())
  await seConnecter(page, { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Nantes Test'] }, espace: { plans: planNantes } })
  await page.goto('./#/magasins/Nantes%20Test')
  await expect(page.getByRole('group', { name: 'Mesure en caisse de Relancer la Cave' })).toContainText('Constaté : − 7 000 € par mois')
})

// Lyon décroche en septembre 2026 (− 30 %) après des mois stables : la dégustation de septembre n'a pas suffi
const operations = { 'Lyon Test': [{ id: 'o1', type: 'degustation', titre: 'Vins de Loire', jour: '2026-09-10', univers: 'tout', cout: 500, note: '', par: 'Hugo FICTIF', le: '2026-09-01' }] }

// Joseph (17/11/2026) : plus d'opérations commerciales, ni dans les chiffres du magasin ni dans la vue du réseau
test('185 retiré : plus de journal des opérations commerciales', async ({ page }) => {
  await seConnecter(page, { config: { operations_magasins: operations } })
  await page.goto('./#/magasins/Lyon%20Test?vue=chiffres')
  await expect(page.getByRole('tab', { name: 'Chiffres', selected: true })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/Opérations commerciales/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ajouter une opération commerciale' })).toHaveCount(0)
  await page.goto('./#/performance?vue=operations')
  await expect(page.getByRole('tablist', { name: 'Parties des chiffres' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Opérations/ })).toHaveCount(0)
})
