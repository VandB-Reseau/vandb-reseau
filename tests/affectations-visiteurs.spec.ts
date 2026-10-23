import { expect, test } from '@playwright/test'
import { choisirMois, seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'
import { visitesFictives } from './donnees-fictives'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const configDe = (e: Ecriture[]) => JSON.parse((e.filter((x) => x.table === 'app_config' && (x.corps as { key?: string }).key !== 'fiches_personnes' && (x.corps as { value: string }).value.includes('dr_assigns')).at(-1)!.corps as { value: string }).value)

test('le rattachement d’un Coach à un Responsable Régional se fait au mois et remplace celui du même mois', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/equipe/coach/Poste%20NORD')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Modifier Poste NORD' })
  await d.getByLabel('Responsable Régional').click()
  await page.getByRole('option', { name: 'Sam SUD' }).click()
  await choisirMois(page, 'Rattaché à ce Responsable Régional à partir de', 'Janvier 2026')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const historique = (configDe(ecritures).dr_assigns as { cs: string; dr: string; date: string }[]).filter((a) => a.cs === 'Poste NORD')
  // Le rattachement à Alex NORD du 1er janvier 2026 est remplacé
  expect(historique).toEqual([expect.objectContaining({ dr: 'rr2', date: '2026-01-01' })])
})

test('une visite a plusieurs participants, le Coach du magasin d’abord', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/visites')
  await page.getByRole('button', { name: 'Saisir une visite pour Lyon Test' }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await d.getByRole('region', { name: 'Visite' }).getByRole('button', { name: 'Modifier' }).click()
  const participants = d.getByLabel('Visité par')
  await expect(d.getByRole('button', { name: 'Noé MODELE' })).toBeVisible()
  await participants.fill('Alex')
  await page.getByRole('option', { name: 'Alex NORD' }).click()
  await page.keyboard.press('Escape')
  await expect(d.getByRole('button', { name: 'Alex NORD' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-visite-participants.png`, fullPage: !isMobile })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Visite enregistrée.')).toBeVisible()
  const ligne = (ecritures.find((e) => e.table === 'visits' && e.methode === 'POST')!.corps as Record<string, unknown>[])[0]
  expect(ligne).toMatchObject({ store: 'Lyon Test', visitor: 'Noé MODELE, Alex NORD' })
})

test('l’historique montre et filtre chaque participant, le compte rendu prévoit leurs signatures', async ({ page, isMobile }) => {
  await seConnecter(page)
  const visites = visitesFictives.map((v) => (v.id === 1 ? { ...v, visitor: 'Noé MODELE, Alex NORD' } : v))
  await page.route('https://supabase.test/rest/v1/visits**', (r) => r.fulfill({ json: visites }))
  await page.goto('./#/visites?vue=historique')
  await page.reload()
  await expect(page.getByText('4 visites', { exact: true })).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: 'Filtres' }).click()
  await page.getByRole('button', { name: 'Filtre Visité par' }).click()
  await page.getByRole('menuitem', { name: 'Alex NORD' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText('1 visite', { exact: true })).toBeVisible()
  await expect(page.getByText(/Noé MODELE, Alex NORD/).first()).toBeVisible()
  await page.goto('./#/visites/compte-rendu/1')
  await expect(page.getByText('Signature · Noé MODELE')).toBeVisible()
  await expect(page.getByText('Signature · Alex NORD')).toBeVisible()
})

test('renommer un Responsable Régional le renomme dans les visites à plusieurs participants', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  const visites = [...visitesFictives, { id: 9, store: 'Nantes Test', visit_date: '2026-09-01', type: 'terrain', visitor: 'Inès EXEMPLE, Alex NORD', docs: [] }]
  await page.route('https://supabase.test/rest/v1/visits**', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: visites }) : r.fallback()))
  await page.goto('./#/equipe/rr/rr1')
  await page.reload()
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Modifier Alex NORD' })
  await d.getByLabel(/^Nom/).fill('NOUVEAU')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  expect(ecritures).toContainEqual(expect.objectContaining({ methode: 'PATCH', table: 'visits', filtre: '?id=eq.9', corps: { visitor: 'Inès EXEMPLE, Alex NOUVEAU' } }))
})
