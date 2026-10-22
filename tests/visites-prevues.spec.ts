import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture, deplierATraiter } from './supabase-simule'
import { visitesFictives } from './donnees-fictives'

// L1 (Joseph, 21/10/2026) : une visite planifiée ne compte qu'une fois faite (compte rendu ou « Faite ») ;
// L2 : le compte rendu commencé est gardé sur l'appareil

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

const jour = (decalage = 0) => { const d = new Date(); d.setDate(d.getDate() + decalage); return d.toLocaleDateString('sv-SE') }

async function avecVisites(page: Page, ajout: Record<string, unknown>[]) {
  const visites = [...visitesFictives, ...ajout]
  await page.route('https://supabase.test/rest/v1/visits**', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: visites }) : r.fallback()))
}

test('visite planifiée passée sans compte rendu : pas comptée, à confirmer dans À traiter', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await avecVisites(page, [{ id: 50, store: 'Nantes Test', visit_date: jour(-3), type: 'terrain', visitor: 'Inès EXEMPLE', docs: [], prevue: true }])
  await page.goto('./#/')
  await page.reload()
  await deplierATraiter(page)
  const bloc = page.getByRole('region', { name: 'À traiter' })
  // Nantes Test reste « pas vu » : la visite prévue ne compte pas
  await expect(bloc.getByRole('button', { name: 'Visite de Nantes Test faite' })).toBeVisible()
  expect((await bloc.getByRole('button', { name: 'Reporter la visite de Nantes Test' }).boundingBox())!.height).toBeGreaterThanOrEqual(48)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-visite-a-confirmer.png` })
  await bloc.getByRole('button', { name: 'Visite de Nantes Test faite' }).click()
  await expect(page.getByText('Visite de Nantes Test comptée faite.')).toBeVisible()
  const ecrite = ecritures.find((e) => e.table === 'visits' && e.methode === 'PATCH')!
  expect(ecrite.corps).toEqual({ prevue: false })
  expect(ecrite.filtre).toContain('id=eq.50')
})

test('reporter une visite planifiée passée : nouvelle date, toujours prévue', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await page.addInitScript(() => { window.open = () => null })
  await seConnecter(page, { ecritures })
  await avecVisites(page, [{ id: 50, store: 'Nantes Test', visit_date: jour(-3), type: 'terrain', visitor: 'Inès EXEMPLE', docs: [], prevue: true }])
  await page.goto('./#/')
  await page.reload()
  await deplierATraiter(page)
  await page.getByRole('button', { name: 'Reporter la visite de Nantes Test' }).click()
  const d = page.getByRole('dialog', { name: 'Visite de Nantes Test' })
  await d.getByLabel('Date').fill(jour(2))
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/^Visite planifiée le /)).toBeVisible()
  const ecrite = ecritures.find((e) => e.table === 'visits' && e.methode === 'PATCH')!
  expect(ecrite.corps).toMatchObject({ visit_date: jour(2), prevue: true })
})

test('le jour de la visite, Ma semaine propose le compte rendu, qui la compte faite', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, appMetadata: { role: 'coach', coach: 'Inès EXEMPLE' } })
  await avecVisites(page, [{ id: 51, store: 'Nantes Test', visit_date: jour(), type: 'terrain', visitor: 'Inès EXEMPLE', docs: [], prevue: true }])
  await page.goto('./#/visites?vue=semaine')
  await page.reload()
  await page.getByRole('button', { name: 'Faire le compte rendu de Nantes Test' }).click()
  const d = page.getByRole('dialog', { name: 'Compte rendu · Nantes Test' })
  await expect(d).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  const ecrite = ecritures.find((e) => e.table === 'visits' && e.methode === 'PATCH')!
  expect(ecrite.corps).toMatchObject({ prevue: false })
  expect(ecrite.filtre).toContain('id=eq.51')
})

test('une visite planifiée depuis Ma semaine est enregistrée comme prévue', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await page.addInitScript(() => { window.open = () => null })
  await seConnecter(page, { ecritures, appMetadata: { role: 'coach', coach: 'Inès EXEMPLE' } })
  await page.goto('./#/visites?vue=semaine')
  await page.getByRole('button', { name: 'Planifier la visite de Nantes Test' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/^Visite planifiée le /)).toBeVisible()
  expect((ecritures.find((e) => e.table === 'visits' && e.methode === 'POST')!.corps as Record<string, unknown>[])[0]).toMatchObject({ store: 'Nantes Test', prevue: true })
})

test('le compte rendu commencé est gardé sur l’appareil et repris à la réouverture', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/visites')
  await page.getByRole('button', { name: 'Saisir une visite pour Lyon Test' }).click()
  let d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await d.getByRole('textbox', { name: /^1\. / }).fill('Vitrine à refaire avant Noël')
  // L'app est fermée sans enregistrer
  await page.reload()
  await page.getByRole('button', { name: 'Saisir une visite pour Lyon Test' }).click()
  d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await expect(d.getByText(/^Brouillon repris du /)).toBeVisible()
  await expect(d.getByRole('textbox', { name: /^1\. / })).toHaveValue('Vitrine à refaire avant Noël')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Visite enregistrée.')).toBeVisible()
  expect((ecritures.find((e) => e.table === 'visits' && e.methode === 'POST')!.corps as Record<string, unknown>[])[0]).toMatchObject({ sections: expect.arrayContaining(['Vitrine à refaire avant Noël']), prevue: false })
  // Enregistré : plus de brouillon
  await page.getByRole('button', { name: 'Saisir une visite pour Lyon Test' }).click()
  d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await expect(d.getByText(/^Brouillon repris du /)).toHaveCount(0)
  await expect(d.getByRole('textbox', { name: /^1\. / })).toHaveValue('')
})

test('base pas encore passée en 0017 : la visite s’enregistre sans la colonne', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  let essais = 0
  await page.route('https://supabase.test/rest/v1/visits**', (r) => {
    if (r.request().method() !== 'POST') return r.fallback()
    essais++
    if ('prevue' in (r.request().postDataJSON() as Record<string, unknown>[])[0]) return r.fulfill({ status: 400, json: { code: 'PGRST204', message: "Could not find the 'prevue' column of 'visits' in the schema cache" } })
    return r.fulfill({ status: 201, json: [{ id: 77 }] })
  })
  await page.goto('./#/visites')
  await page.getByRole('button', { name: 'Saisir une visite pour Lyon Test' }).click()
  await page.getByRole('dialog', { name: 'Saisir une visite' }).getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Visite enregistrée.')).toBeVisible()
  expect(essais).toBe(2)
})
