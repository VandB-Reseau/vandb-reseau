import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits } from './supabase-simule'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('l’équipe liste les Coachs avec leur charge et les techniciens à part', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe')
  await expect(page.getByText('4 Coachs · 3 Responsables Régionaux')).toBeVisible()
  for (const c of ['Camille TESTARD', 'Hugo FICTIF', 'Inès EXEMPLE', 'Noé MODELE']) await expect(page.getByText(c, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Tom TECHNICIEN')).toBeVisible()
  await expect(page.getByText(/\d+ \/ 8/).first()).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-equipe.png`, fullPage: !isMobile })
})

test('l’onglet Responsables Régionaux montre l’organisation', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe?vue=rr')
  await expect(page.getByRole('heading', { name: 'Alex NORD' })).toBeVisible()
  await expect(page.getByText('Responsable Magasins Intégrés')).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-equipe-rr.png`, fullPage: !isMobile })
})

test('l’onglet Responsables magasin filtre les postes non renseignés', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/equipe?vue=magasins')
  await page.getByLabel(/Seulement les magasins sans responsable/).check()
  await expect(page.getByText(/À pourvoir ou non renseigné|Responsable à pourvoir/).first()).toBeVisible()
  await expect(page.getByText('Responsable 1', { exact: false })).toHaveCount(0)
})

test('la fiche Coach montre charge, magasins et historique', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe')
  await page.getByRole('link', { name: /Noé MODELE/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Noé MODELE', level: 1 })).toBeVisible()
  await expect(page.getByText('Les six prochains mois')).toBeVisible()
  await expect(page.getByText('Prend en charge Lyon Test (après Camille TESTARD)')).toBeVisible()
  await expect(page.getByText('Rattaché à Sam SUD')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-coach.png`, fullPage: true })
})

test('la fiche magasin mène à la fiche du Coach', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Nantes%20Test')
  await page.getByRole('link', { name: 'Inès EXEMPLE' }).click()
  await expect(page.getByRole('heading', { name: 'Inès EXEMPLE', level: 1 })).toBeVisible()
})

test('le plan de charge se projette mois par mois', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/plus/charge')
  await expect(page.getByRole('heading', { name: 'Plan de charge' })).toBeVisible()
  await expect(page.getByText('Coachs en dépassement')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Charge des Coachs · Aujourd’hui/ })).toBeVisible()
  if (!isMobile) await expect(page.getByRole('table', { name: 'Projection de charge' }).getByRole('row')).toHaveCount(5)
  await page.getByRole('tab').nth(3).click()
  await expect(page.getByRole('heading', { name: /Charge des Coachs · (?!Aujourd)/ })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-plan-charge.png`, fullPage: !isMobile })
})
