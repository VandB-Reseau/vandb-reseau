import { expect, test } from '@playwright/test'
import { choisirMois, seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'
import { coachsFictifs } from './donnees-fictives'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

test('la carte regroupe les magasins en zones de Coach et de Responsable Régional, masquables', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins?vue=carte')
  const zonesCoachs = page.getByRole('button', { name: 'Zones des Coachs' })
  const zonesRR = page.getByRole('button', { name: 'Zones des Responsables Régionaux' })
  await expect(zonesCoachs).toHaveAttribute('aria-pressed', 'true')
  await expect(zonesRR).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('path.zone-coach').first()).toBeAttached()
  await expect(page.locator('path.zone-rr')).toHaveCount(0)
  // Légende par Coach quand leurs zones sont affichées
  const legende = page.getByLabel('Légende de la carte')
  await expect(legende.getByText('Camille TESTARD')).toBeVisible()

  await zonesRR.click()
  await expect(zonesRR).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('path.zone-rr').first()).toBeAttached()
  await expect(legende.getByText('Pointillés : zones des Responsables Régionaux (RR)')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  for (const b of [zonesCoachs, zonesRR]) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  await page.screenshot({ path: `captures/${info.project.name}-carte-zones.png`, fullPage: !isMobile })

  // Sans zones de Coach : points et légende par Responsable Régional
  await zonesCoachs.click()
  await expect(page.locator('path.zone-coach')).toHaveCount(0)
  await expect(legende.getByText('Alex NORD')).toBeVisible()
  await expect(legende.getByText('Camille TESTARD')).toHaveCount(0)
  await zonesRR.click()
  await expect(page.locator('path.zone-rr')).toHaveCount(0)
})

test('le plan d’affectation propose un Coach pour un magasin sans Coach et enregistre après validation', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/equipe?vue=plan')
  await expect(page.getByRole('tab', { name: 'Plan d’affectation', selected: true })).toBeVisible()
  await choisirMois(page, 'À partir de', 'Novembre 2026')

  // Vichy Test passe en pré-ouverture sans Coach : seul le poste à pourvoir reste sous le maximum
  const ligne = page.getByRole('listitem', { name: 'Vichy Test' })
  await expect(ligne).toContainText('Sans Coach')
  const choix = ligne.getByLabel('Confier à')
  await expect(choix).toHaveValue('Poste NORD')
  await expect(page.getByText('Magasins sans Coach', { exact: true })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-plan-affectation.png`, fullPage: !isMobile })

  // Le plan se voit sur la carte, magasins concernés cerclés
  await page.getByRole('group', { name: 'Affichage du plan' }).getByRole('button', { name: 'Carte' }).click()
  await expect(page.getByText('Cerclés de noir : magasins qui changent de Coach dans le plan')).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-plan-carte.png`, fullPage: !isMobile })
  await page.getByRole('group', { name: 'Affichage du plan' }).getByRole('button', { name: 'Liste' }).click()

  // Choisir un autre Coach puis valider : rien n'est écrit avant la confirmation
  await choix.selectOption('Inès EXEMPLE')
  await page.getByRole('button', { name: /^Valider 1 changement$/ }).click()
  expect(ecritures).toEqual([])
  const dialogue = page.getByRole('dialog', { name: /Enregistrer le plan à partir de novembre 2026/ })
  await expect(dialogue).toContainText('1 magasin change de Coach')
  await dialogue.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Plan enregistré : 1 magasin/)).toBeVisible()
  const ecrite = ecritures.find((e) => e.table === 'reassigns' && e.methode === 'POST')!
  expect(ecrite.corps).toMatchObject({ store: 'Vichy Test', cs: 'Inès EXEMPLE', date: '2026-11-01' })
})

test('le plan propose un Responsable Régional pour un Coach qui arrive et décocher retire la proposition', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  // Zoé ARRIVEE prend son poste en mars 2099 sans Responsable Régional
  await page.goto('./#/equipe?vue=plan&date=2099-03-15')
  await expect(page.getByLabel('À partir de')).toHaveText('Mars 2099')
  const ligne = page.getByRole('listitem', { name: 'Zoé ARRIVEE' })
  await expect(ligne).toContainText('Sans Responsable Régional')
  await expect(ligne.getByLabel('Rattacher à').locator('option')).toHaveCount(2) // la Responsable Magasins Intégrés n’est pas proposée
  const boutonValider = page.getByRole('button', { name: /^Valider \d+ changements?$/ })
  const avant = Number((await boutonValider.textContent())!.match(/\d+/)![0])
  await ligne.getByRole('checkbox').uncheck()
  await expect(page.getByRole('button', { name: avant - 1 ? new RegExp(`^Valider ${avant - 1} changement`) : 'Coche au moins une proposition' })).toBeVisible()
  await ligne.getByRole('checkbox').check()
  await boutonValider.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Plan enregistré/)).toBeVisible()
  const config = ecritures.filter((e) => e.table === 'app_config').map((e) => JSON.parse((e.corps as { value: string }).value))
  expect(config.some((c) => c.dr_assigns?.some((a: { cs: string; date: string }) => a.cs === 'Zoé ARRIVEE' && a.date === '2099-03-01'))).toBe(true)
})

test('le plan soulage les Coachs en dépassement avec le Coach en poste le plus proche qui a de la place', async ({ page }, info) => {
  await seConnecter(page)
  // Un Coach de plus, basé dans l’Aveyron, sans magasin ni Responsable Régional
  await page.route('https://supabase.test/rest/v1/cs_overrides**', (r) => r.fulfill({ json: [...coachsFictifs, { cs_name: 'Léo RENFORT', lat: 44.5, lon: 2.0 }] }))
  await page.goto('./#/equipe?vue=plan')
  await page.reload()
  await choisirMois(page, 'À partir de', 'Novembre 2026')
  const rodez = page.getByRole('listitem', { name: 'Rodez Test' })
  await expect(rodez).toContainText('Rééquilibrage de charge · actuellement Camille TESTARD')
  await expect(rodez.getByLabel('Confier à')).toHaveValue('Léo RENFORT')
  await expect(page.getByRole('listitem', { name: 'Léo RENFORT' })).toContainText('Sans Responsable Régional')
  // Plus aucun Coach en dépassement une fois le plan appliqué
  await expect(page.getByText('Coachs en dépassement', { exact: true }).locator('..')).toContainText('→ 0')
  await page.screenshot({ path: `captures/${info.project.name}-plan-reequilibrage.png`, fullPage: true })
})
