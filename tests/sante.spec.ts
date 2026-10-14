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

test('la nine box classe les magasins évalués', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/plus/sante')
  await expect(page.getByRole('cell', { name: 'Redressement urgent : 1 magasin' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Locomotive : 1 magasin' })).toContainText('Annecy Test')
  await expect(page.getByRole('cell', { name: 'Cœur de réseau : 1 magasin' })).toContainText('Nantes Test')
  await expect(page.getByText(/pas encore classés/)).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-sante-ninebox.png`, fullPage: !isMobile })
})

test('noter un critère enregistre la case du magasin', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/plus/sante?vue=evaluer')
  await page.getByLabel('Rechercher un magasin').fill('Rennes')
  await page.getByRole('combobox', { name: 'CA marché extérieur de Rennes Test' }).click()
  await page.getByRole('option', { name: 'Fort' }).click()
  await page.getByRole('combobox', { name: /Niveau du franchisé.* de Rennes Test/ }).click()
  await page.getByRole('option', { name: 'Fort' }).click()
  await expect(page.getByText('Locomotive').first()).toBeVisible()
  await expect.poll(() => ecritures.filter((e) => e.table === 'app_config' && JSON.stringify(e.corps).includes('locomotive')).length).toBeGreaterThan(0)
  await page.screenshot({ path: `captures/${info.project.name}-sante-evaluer.png` })
})

test('les déploiements se suivent par magasin et les thématiques se gèrent', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/plus/sante?vue=deploiements')
  await expect(page.getByRole('img', { name: /Concept 2.0 : 1 magasins/ })).toBeVisible()
  await page.getByLabel('Rechercher un magasin').fill('Nice')
  await page.getByRole('combobox', { name: /Offre 5\+1/ }).click()
  await page.getByRole('option', { name: 'Oui' }).click()
  await expect.poll(() => ecritures.some((e) => JSON.stringify(e.corps).includes('offre5plus1'))).toBe(true)
  await page.screenshot({ path: `captures/${info.project.name}-sante-deploiements.png`, fullPage: !isMobile })
  await page.getByRole('button', { name: 'Gérer les thématiques' }).first().click()
  const d = page.getByRole('dialog', { name: 'Thématiques de déploiement' })
  await d.getByRole('button', { name: 'Ajouter une thématique' }).click()
  await d.getByRole('textbox', { name: 'Thématique' }).last().fill('Click and collect')
  expect(await textesTropPetits(page)).toEqual([])
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  await expect.poll(() => ecritures.some((e) => JSON.stringify(e.corps).includes('Click and collect'))).toBe(true)
})

test('la fiche magasin montre la santé et les déploiements', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByText('Redressement urgent')).toBeVisible()
  await expect(page.getByText('Rythme de visite conseillé : 8 visites × ½ j')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Concept 2.0' })).toHaveText('Fait')
  await page.getByRole('region', { name: 'Santé et déploiements' }).or(page.getByText('Santé et déploiements')).first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: `captures/${info.project.name}-fiche-sante.png` })
})

test('l’accueil donne les priorités du jour', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/')
  const sp = page.getByRole('region', { name: 'Magasins qui sous-performent' })
  await expect(sp.getByRole('link', { name: 'Lyon Test' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Agenda de la semaine' })).toContainText('Séminaire des Coachs')
  await expect(page.getByRole('region', { name: 'Coachs surchargés et postes vacants' })).toContainText('Poste NORD')
  await expect(page.getByRole('region', { name: 'Ouvertures à préparer' })).toContainText('Vichy Test')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-accueil.png`, fullPage: !isMobile })
})

test('l’évolution compte les ouvertures par année fiscale', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/plus/evolution')
  await expect(page.getByText('Les fermetures ne sont pas encore enregistrées')).toBeVisible()
  await expect(page.getByRole('row', { name: /FY27 \(en cours\)/ })).toContainText('30')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-evolution.png`, fullPage: !isMobile })
})

test('plusieurs notes rapides partent en une seule écriture et restent après un changement de page', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/plus/sante?vue=evaluer')
  await page.getByLabel('Rechercher un magasin').fill('Rennes')
  for (const nom of ['CA marché extérieur', 'Flux bar']) {
    await page.getByRole('combobox', { name: new RegExp(`^${nom}`) }).click()
    await page.getByRole('option', { name: 'Moyen' }).click()
  }
  await expect.poll(() => ecritures.filter((e) => e.table === 'app_config').length).toBe(1)
  const corps = JSON.stringify(ecritures[0].corps)
  expect(corps).toContain('caExterieur')
  expect(corps).toContain('fluxBar')
  await page.goto('./#/magasins/Rennes%20Test')
  await expect(page.getByRole('combobox', { name: 'Flux bar' })).toHaveText('Moyen')
})
