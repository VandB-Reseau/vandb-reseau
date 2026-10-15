import { expect, test, type Page } from '@playwright/test'
import { choisirMois, seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'
import { coachsFictifs, magasinsFictifs } from './donnees-fictives'

// Bouton d'affichage de la carte : direct sur PC, dans le menu « Affichage de la carte » sur téléphone
async function affichage(page: Page, isMobile: boolean, nom: string) {
  if (!isMobile) return { bouton: page.getByRole('button', { name: nom }), etat: 'aria-pressed' }
  if (await page.getByRole('menu').count() === 0) await page.getByRole('button', { name: 'Affichage de la carte' }).click()
  return { bouton: page.getByRole('menuitemcheckbox', { name: nom }), etat: 'aria-checked' }
}

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
  const legende = page.getByLabel('Légende de la carte')
  await expect(page.locator('path.zone-coach').first()).toBeAttached()
  await expect(page.locator('path.zone-rr')).toHaveCount(0)
  // Légende par Coach quand leurs zones sont affichées
  await expect(legende.getByText('Camille TESTARD')).toBeVisible()
  const carte = (await page.locator('.leaflet-container').boundingBox())!
  if (isMobile) {
    // Téléphone : un bouton d'affichage et le plein écran, sur la ligne de la recherche et des filtres
    const filtres = (await page.getByRole('button', { name: 'Filtres' }).boundingBox())!
    for (const nom of ['Affichage de la carte', 'Carte en plein écran']) {
      const boite = (await page.getByRole('button', { name: nom }).boundingBox())!
      expect(Math.abs(boite.y - filtres.y)).toBeLessThanOrEqual(4)
      expect(boite.height).toBeGreaterThanOrEqual(48)
      expect(boite.y + boite.height).toBeLessThanOrEqual(carte.y)
    }
    expect((await page.getByRole('textbox').first().boundingBox())!.width).toBeGreaterThanOrEqual(150)
    await page.screenshot({ path: `captures/telephone-carte-ligne-filtres.png` })
  }
  const coachs = await affichage(page, isMobile, 'Zones des Coachs')
  await expect(coachs.bouton).toHaveAttribute(coachs.etat, 'true')
  const rr = await affichage(page, isMobile, 'Zones des Responsables Régionaux')
  await expect(rr.bouton).toHaveAttribute(rr.etat, 'false')
  await rr.bouton.click()
  await expect(rr.bouton).toHaveAttribute(rr.etat, 'true')
  await expect(page.locator('path.zone-rr').first()).toBeAttached()
  await expect(legende.getByText('Pointillés : zones des Responsables Régionaux (RR)')).toBeAttached()
  expect(await textesTropPetits(page)).toEqual([])
  for (const b of [coachs.bouton, rr.bouton]) await expect.poll(async () => (await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  if (isMobile) await page.screenshot({ path: `captures/telephone-carte-menu-affichage.png` })
  if (!isMobile) {
    // Boutons icônes compacts au-dessus de la carte, sans libellé écrit, libellé au survol
    for (const b of [coachs.bouton, rr.bouton]) {
      const boite = (await b.boundingBox())!
      expect(boite.y + boite.height).toBeLessThanOrEqual(carte.y)
      expect(boite.width).toBeLessThanOrEqual(56)
      await expect(b).toHaveText('')
    }
    await rr.bouton.hover()
    await expect(page.getByRole('tooltip', { name: 'Zones des Responsables Régionaux' })).toBeVisible()
    expect(await textesTropPetits(page)).toEqual([])
    await page.screenshot({ path: `captures/pc-carte-boutons-survol.png` })
    await page.mouse.move(0, 0)
  } else {
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
  }
  await page.screenshot({ path: `captures/${info.project.name}-carte-zones.png`, fullPage: !isMobile })

  // Sans zones de Coach : points et légende par Responsable Régional
  const coachs2 = await affichage(page, isMobile, 'Zones des Coachs')
  await coachs2.bouton.click()
  await expect(page.locator('path.zone-coach')).toHaveCount(0)
  if (isMobile) await page.keyboard.press('Escape')
  await expect(legende.getByText('Alex NORD')).toBeVisible()
  await expect(legende.getByText('Camille TESTARD')).toHaveCount(0)
  const rr2 = await affichage(page, isMobile, 'Zones des Responsables Régionaux')
  await rr2.bouton.click()
  await expect(page.locator('path.zone-rr')).toHaveCount(0)
})

test('la carte place les Coachs et les Responsables Régionaux avec leur propre picto, masquables', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins?vue=carte')
  const { bouton, etat } = await affichage(page, isMobile, 'Coachs et Responsables Régionaux')
  await expect(bouton).toHaveAttribute(etat, 'true')
  await expect.poll(async () => (await bouton.boundingBox())!.height).toBeGreaterThanOrEqual(48)
  if (isMobile) await page.keyboard.press('Escape')
  // Coachs à leur domicile connu (poste à pourvoir et Coach pas encore arrivé exclus), RR à la ville de sa fiche
  await expect(page.locator('.picto-coach')).toHaveCount(4)
  await expect(page.locator('.picto-rr')).toHaveCount(1)
  await expect(page.locator('.picto-coach[title="Coach : Camille TESTARD"]')).toBeAttached()
  const rr = page.locator('.picto-rr[title="Responsable Régional : Alex NORD"]')
  await expect(rr).toBeAttached()
  const legende = page.getByLabel('Légende de la carte')
  await expect(legende.getByText('Coach', { exact: true })).toBeVisible()
  await expect(legende.getByText('Responsable Régional', { exact: true })).toBeVisible()
  // Sam SUD et Léa INTEGRES n'ont pas de ville sur leur fiche
  await expect(legende.getByText('2 Coachs ou RR sans ville renseignée, non affichés')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-carte-coachs-rr.png`, fullPage: !isMobile })

  await rr.dispatchEvent('click')
  const bulle = page.locator('.leaflet-popup')
  await expect(bulle).toContainText('Alex NORD')
  await expect(bulle).toContainText('Responsable Régional · Lille')
  await expect(bulle.getByRole('link', { name: 'Ouvrir la fiche' })).toHaveAttribute('href', '#/equipe/rr/rr1')
  await page.keyboard.press('Escape')

  const masquer = await affichage(page, isMobile, 'Coachs et Responsables Régionaux')
  await masquer.bouton.click()
  await expect(masquer.bouton).toHaveAttribute(masquer.etat, 'false')
  if (isMobile) await page.keyboard.press('Escape')
  await expect(page.locator('.picto-coach, .picto-rr')).toHaveCount(0)
  await expect(legende.getByText('Coach', { exact: true })).toHaveCount(0)
})

test('avec un filtre, la carte ne montre que les Coachs et RR des magasins affichés', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins?vue=carte')
  if (isMobile) await page.getByRole('button', { name: 'Filtres' }).click()
  await page.getByLabel('Filtre Coach').click()
  await page.getByRole('menuitem', { name: /Camille TESTARD/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.picto-coach')).toHaveCount(1)
  await expect(page.locator('.picto-coach[title="Coach : Camille TESTARD"]')).toBeAttached()
  await expect(page.locator('.picto-rr[title="Responsable Régional : Alex NORD"]')).toBeAttached()
})

test('changer la ville d’un Coach efface sa position précédente', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/equipe/coach/Camille%20TESTARD')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Modifier Camille TESTARD' })
  await d.getByLabel('Code postal').fill('59000')
  await d.getByLabel('Ville').fill('Lille')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Camille TESTARD est mis à jour/)).toBeVisible()
  expect(ecritures.filter((e) => e.table === 'cs_overrides').at(-1)).toMatchObject({ methode: 'PATCH', corps: { ville: 'Lille', lat: null, lon: null } })
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

test('le plan d’affectation s’affiche rapidement sur un réseau de 280 magasins', async ({ page }) => {
  // 280 magasins fictifs sans Coach : le plan doit les répartir entre les Coachs sans bloquer la page
  const grand = Array.from({ length: 280 }, (_v, i) => ({
    ...magasinsFictifs[i % magasinsFictifs.length], n: `Magasin ${i + 1}`, code: `G${i}`, open: '2020-01-15',
    lat: 43 + ((i * 37) % 60) / 10, lon: -1 + ((i * 53) % 80) / 10,
  }))
  await seConnecter(page, { config: { store_adds: grand } })
  await page.goto('./#/equipe?vue=plan')
  await choisirMois(page, 'À partir de', 'Novembre 2026')
  await expect(page.getByRole('heading', { name: /Magasins à confier à un Coach/ })).toBeVisible({ timeout: 8000 })
})
