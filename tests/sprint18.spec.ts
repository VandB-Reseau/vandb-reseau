import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('la fiche Coach s’ouvre sur son portefeuille comparé au réseau', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe/coach/In%C3%A8s%20EXEMPLE')
  await expect(page.getByRole('heading', { name: 'Inès EXEMPLE', level: 1 })).toBeVisible()
  await expect(page.getByRole('group', { name: 'En bref' })).toContainText('visites')
  await expect(page.getByRole('link', { name: 'Message' })).toBeVisible()
  const portefeuille = page.getByRole('region', { name: 'Portefeuille' })
  await expect(page.getByRole('heading', { name: 'Portefeuille comparé au réseau' })).toBeVisible()
  for (const l of ['Rythme de visite tenu', 'En Décroche', 'Évolution du CA', 'Note d’audit moyenne', 'Nine box à surveiller']) await expect(portefeuille).toContainText(l)
  await expect(portefeuille).toContainText('réseau')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-coach-portefeuille.png`, fullPage: !isMobile })
})

test('la fiche RR est un profil avec portefeuille, Coachs, magasins et fiche', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe/rr/rr1')
  await expect(page.getByRole('heading', { name: 'Alex NORD', level: 1 })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Rubriques de Alex NORD' }).getByRole('tab')).toHaveText(['Portefeuille', 'Coachs', 'Magasins', 'Fiche'])
  await expect(page.getByRole('region', { name: 'Portefeuille' })).toContainText('Rythme de visite tenu')
  await page.screenshot({ path: `captures/${info.project.name}-fiche-rr-portefeuille.png`, fullPage: !isMobile })
})

test('l’onglet Portefeuilles de l’équipe compare chaque Coach au réseau', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe?vue=portefeuilles')
  const coachs = page.getByRole('region', { name: 'Coachs' })
  await expect(coachs.getByRole('link', { name: /^Inès EXEMPLE/ })).toBeVisible()
  await expect(coachs.getByRole('link', { name: /^Inès EXEMPLE/ })).toContainText('rythme')
  await expect(page.getByRole('region', { name: 'Responsables Régionaux' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-equipe-portefeuilles.png`, fullPage: !isMobile })
  if (!isMobile) {
    await page.getByRole('button', { name: 'Tableau' }).click()
    await expect(page.getByRole('table', { name: 'Coachs' }).getByRole('row', { name: /^Réseau/ })).toBeVisible()
  }
})

test('un Coach arrive sur sa semaine et pose une visite due à l’agenda', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures, appMetadata: { role: 'coach', coach: 'Inès EXEMPLE' } })
  await page.goto('./#/visites')
  await expect(page.getByRole('tab', { name: isMobile ? 'Semaine' : 'Ma semaine', selected: true })).toBeVisible()
  const aPlanifier = page.getByRole('region', { name: 'Visites à planifier' })
  const nantes = aPlanifier.getByRole('link', { name: 'Nantes Test', exact: true })
  await expect(nantes).toContainText(/j de retard/)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-ma-semaine.png`, fullPage: !isMobile })
  await page.getByRole('button', { name: 'Poser à l’agenda la visite de Nantes Test' }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await expect(d.getByLabel('Date')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/)
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Visite enregistrée.')).toBeVisible()
  const ecrite = ecritures.find((e) => e.table === 'visits' && e.methode === 'POST')!
  expect((ecrite.corps as Record<string, unknown>[])[0]).toMatchObject({ store: 'Nantes Test', visitor: 'Inès EXEMPLE' })
})

test('le Directeur choisit le Coach dont il regarde la semaine', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/visites?vue=semaine')
  await page.getByRole('button', { name: 'Filtre Coach' }).click()
  await page.getByRole('menuitem', { name: 'Inès EXEMPLE' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: 'Visites à planifier' }).getByRole('link', { name: 'Nantes Test', exact: true })).toBeVisible()
})

test('l’agenda montre les visites', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/plus/agenda')
  await expect(page.getByRole('button', { name: 'Visites', pressed: true })).toBeVisible()
})
