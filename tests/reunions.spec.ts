import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, type ReunionsSimulees } from './supabase-simule'

// Sprint 22, A2 : réunions et formations avec magasins invités, réponse du franchisé, pointage des présents
test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const jour = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const jourLong = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
// Les deux réunions restent dans l'année en cours (comptées sur la fiche magasin)
const passee = jour(-2) < `${jour(0).slice(0, 4)}-01-01` ? jour(0) : jour(-2)
const aVenir = jour(3) > `${jour(0).slice(0, 4)}-12-31` ? jour(0) : jour(3)
const reunions = (): ReunionsSimulees => ({
  evenements: [
    { id: 5, title: 'Formation vente', start_date: passee, end_date: passee, color: '#2e7d32', invites: ['Lyon Test', 'Annecy Test'] },
    { id: 6, title: 'Réunion régionale', start_date: aVenir, end_date: aVenir, color: '#1b6fce', notes: 'Salle du siège', invites: ['Lyon Test', 'Annecy Test'] },
  ],
  presences: [{ event: 5, magasin: 'Lyon Test', reponse: 'present', present: true }, { event: 6, magasin: 'Lyon Test', reponse: 'absent', present: null }],
})

test('le Directeur invite les magasins d’une région à une réunion', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.getByRole('menuitem', { name: 'Événement' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter un événement' })
  await d.getByLabel('Titre').fill('Réunion régionale')
  const invites = d.getByRole('group', { name: 'Magasins invités' })
  await expect(invites.getByRole('button')).toHaveText(['Aucun', 'Tout le réseau', 'Région Alex NORD', 'Région Sam SUD', 'Choisir'])
  await invites.getByRole('button', { name: 'Région Alex NORD' }).click()
  await expect(d.getByText(/^\d+ magasins? invités?$/)).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-reunion-invites.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const corps = ecritures.filter((e) => e.table === 'events' && e.methode === 'POST').at(-1)!.corps as { title: string; invites: string[] }
  expect(corps.title).toBe('Réunion régionale')
  expect(corps.invites.length).toBeGreaterThan(0)
  expect(corps.invites.length).toBeLessThan(30)
})

test('un événement sans invités s’enregistre comme avant', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.getByRole('menuitem', { name: 'Événement' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter un événement' })
  await d.getByLabel('Titre').fill('Séminaire')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  expect(ecritures.filter((e) => e.table === 'events' && e.methode === 'POST').at(-1)!.corps).not.toHaveProperty('invites')
})

test('le Coach ne pose pas d’invités', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' } })
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.getByRole('menuitem', { name: 'Événement' }).click()
  await expect(page.getByRole('dialog', { name: 'Ajouter un événement' }).getByLabel('Titre')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Magasins invités' })).toHaveCount(0)
})

test('après la réunion, l’équipe pointe les présents', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Grille du mois sur PC')
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, reunions: reunions() })
  await page.goto(`./#/plus/agenda?mois=${passee.slice(0, 7)}`)
  await page.getByRole('gridcell', { name: jourLong(passee), exact: true }).getByRole('button', { name: 'Formation vente' }).click()
  const d = page.getByRole('dialog', { name: 'Modifier Formation vente' })
  const presences = d.getByRole('region', { name: 'Présences' })
  await expect(presences).toContainText('1 réponse sur 2 · 1 présent')
  await expect(presences.getByRole('button', { name: 'Présent : Lyon Test' })).toHaveAttribute('aria-pressed', 'true')
  await presences.getByRole('button', { name: 'Absent : Annecy Test' }).click()
  await expect(presences.getByRole('button', { name: 'Absent : Annecy Test' })).toHaveAttribute('aria-pressed', 'true')
  expect(ecritures.filter((e) => e.table === 'rpc/pointer_presence').map((e) => e.corps)).toEqual([{ p_id: 5, p_magasin: 'Annecy Test', p_present: false }])
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-reunion-presences.png` })
})

test('la fiche magasin compte les présences de l’année', async ({ page, isMobile }, info) => {
  await seConnecter(page, { reunions: reunions() })
  await page.goto('./#/magasins/Lyon%20Test?vue=visites')
  const section = page.getByRole('heading', { name: /^Réunions et formations · \d{4}$/ }).locator('xpath=ancestor::div[contains(@class,"MuiCard-root")]')
  await expect(section).toContainText('Présent à 1 sur 1')
  await expect(section).toContainText('Formation vente')
  await expect(section).toContainText('Réunion régionale')
  await expect(section).toContainText('Répond absent')
  expect(await textesTropPetits(page)).toEqual([])
  await section.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `captures/${info.project.name}-fiche-reunions.png`, fullPage: !isMobile })
})

test('le franchisé répond depuis son accueil', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, reunions: reunions(), acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: ['Annecy Test'] } })
  const section = page.getByRole('region', { name: 'Réunions et formations' })
  await expect(section).toContainText('Réunion régionale')
  await expect(section).toContainText('Salle du siège')
  await expect(section).not.toContainText('Formation vente')
  const present = section.getByRole('button', { name: 'Présent' })
  expect((await present.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await present.click()
  await expect(present).toHaveAttribute('aria-pressed', 'true')
  expect(ecritures.filter((e) => e.table === 'rpc/repondre_reunion').map((e) => e.corps)).toEqual([{ p_id: 6, p_reponse: 'present' }])
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-franchise-reunions.png`, fullPage: !isMobile })
})

test('la présence aux réunions s’ajoute aux repères d’engagement du franchisé', async ({ page }) => {
  const r = reunions()
  r.presences.push({ event: 5, magasin: 'Annecy Test', reponse: null, present: false })
  await seConnecter(page, { reunions: r })
  await page.goto('./#/equipe/franchise/Paul%20MULTI')
  await expect(page.getByText('Présent aux réunions')).toBeVisible()
  await expect(page.getByText('0 sur 1 · en retrait')).toBeVisible()
})
