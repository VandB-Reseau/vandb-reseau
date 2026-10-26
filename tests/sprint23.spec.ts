import { expect, test } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'

// Sprint 23 (Joseph, 23/10/2026) : retouches du quotidien. Saisie d'une visite sans champs déjà connus (S1),
// Ma semaine en trois chiffres (S2), rythme par Coach lisible en entier (S3), tâche cochée depuis l'accueil
// avec « Annuler » (S4), écrans vides de Messages et Tâches qui proposent l'action (S5)

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('S1 : depuis la fiche, magasin, date, type et visiteur tiennent sur une ligne', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test?vue=visites')
  await page.getByRole('button', { name: 'Saisir', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  const resume = d.getByRole('region', { name: 'Visite' })
  await expect(resume).toContainText('Lyon Test · aujourd’hui')
  await expect(resume).toContainText('Visite terrain · Noé MODELE')
  await expect(d.getByLabel('Magasins visités')).toHaveCount(0)
  await expect(d.getByRole('group', { name: 'Tâches en cours' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-saisie-visite-resume.png` })
  await resume.getByRole('button', { name: 'Modifier' }).click()
  await expect(d.getByLabel('Magasins visités')).toBeVisible()
  await expect(d.getByLabel('Visité par')).toBeVisible()
  await expect(d.getByRole('region', { name: 'Visite' })).toHaveCount(0)
})

test('S1 : saisie libre (bouton Créer), tous les champs restent ouverts', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/visites')
  await page.getByRole('button', { name: 'Créer' }).first().click()
  await page.getByRole('menuitem', { name: 'Visite' }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  await expect(d.getByLabel('Magasins visités')).toBeVisible()
  await expect(d.getByRole('region', { name: 'Visite' })).toHaveCount(0)
})

test('S2 : Ma semaine se résume en trois chiffres', async ({ page }, info) => {
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Inès EXEMPLE' } })
  await page.goto('./#/visites')
  const resume = page.getByRole('group', { name: 'Résumé de la semaine' })
  await expect(resume).toContainText('à voir')
  await expect(resume).toContainText(/prévues?/)
  await expect(page.getByText(/^jusqu’au /)).toBeVisible()
  expect(await resume.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-semaine-trois-chiffres.png` })
})

test('S3 : la ligne de chaque Coach dit visites sur référence, avec une jauge, sans texte coupé', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/visites?vue=rythme')
  const coachs = page.getByRole('region', { name: 'Visites par Coach' })
  const noe = coachs.getByRole('link', { name: /Noé MODELE/ })
  await expect(noe).toContainText(/\d+ visites? sur \d+ · [\d,]+ j par an/)
  await expect(noe.getByRole('meter', { name: 'Visites de Noé MODELE' })).toBeVisible()
  const coupe = await noe.getByText(/par an/).evaluate((e) => e.scrollWidth > e.clientWidth + 1)
  expect(coupe).toBe(false)
  expect(await textesTropPetits(page)).toEqual([])
  await coachs.screenshot({ path: `captures/${info.project.name}-rythme-par-coach.png` })
})

test('S4 : une tâche se coche depuis l’accueil et « Annuler » la remet en cours', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  const bouton = page.getByRole('region', { name: 'À traiter' }).getByRole('button', { name: 'Tâche faite : Refaire la vitrine' })
  await expect(bouton).toBeVisible()
  const box = (await bouton.boundingBox())!
  expect(Math.round(box.width)).toBeGreaterThanOrEqual(48)
  await page.screenshot({ path: `captures/${info.project.name}-accueil-cocher-tache.png` })
  await bouton.click()
  await expect(page.getByText('Tâche faite : Refaire la vitrine')).toBeVisible()
  // Tâche a1 de la visite de Brest : faite au premier toucher, remise en cours par « Annuler »
  const a1 = (e: Ecriture) => ((e.corps as { action_plan?: { id: string; faite?: string }[] }).action_plan ?? []).find((a) => a.id === 'a1')
  await expect.poll(() => ecritures.filter((e) => a1(e)?.faite).length).toBe(1)
  const avant = ecritures.length
  await page.getByRole('button', { name: 'Annuler' }).click()
  await expect.poll(() => ecritures.length).toBeGreaterThan(avant)
  expect(a1(ecritures.at(-1)!)).toBeDefined()
  expect(a1(ecritures.at(-1)!)!.faite).toBeUndefined()
})

test('S5 : Messages et Tâches vides proposent d’écrire ou de créer', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/echanges')
  await expect(page.getByText('Aucune conversation en cours')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-messages-vide.png` })
  await page.getByRole('button', { name: 'Nouveau message' }).click()
  await expect(page.getByRole('dialog', { name: 'Message à une personne' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.goto('./#/taches')
  await page.getByRole('group', { name: 'Liste de tâches' }).getByRole('button', { name: /^Mes tâches/ }).click()
  await expect(page.getByText('Aucune tâche en cours')).toBeVisible()
  await page.getByRole('button', { name: 'Nouvelle tâche' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.screenshot({ path: `captures/${info.project.name}-taches-vide.png` })
})
