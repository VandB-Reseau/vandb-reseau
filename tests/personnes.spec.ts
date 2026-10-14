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

const cle = (ecritures: Ecriture[], k: string) => JSON.parse((ecritures.filter((e) => e.table === 'app_config' && (e.filtre.includes(`key=eq.${k}`) || (e.corps as { key?: string }).key === k)).at(-1)!.corps as { value: string }).value)
const surcharges = (ecritures: Ecriture[]) => ecritures.filter((e) => e.table === 'store_overrides').map((e) => ({ filtre: decodeURIComponent(e.filtre.replace(/\+/g, ' ')), ...(e.corps as Record<string, unknown>) }))

test('l’organigramme ne modifie plus rien : chaque personne s’ouvre sur sa fiche', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  for (const forme of ['pyramide', 'liste']) {
    await page.goto(`./#/equipe?forme=${forme}`)
    await expect(page.getByRole('heading', { name: 'Organigramme' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Modifier/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Ajouter/ })).toHaveCount(0)
  }
  await page.getByRole('link', { name: 'Alex NORD', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Alex NORD', level: 1 })).toBeVisible()
  await expect(page.getByText('Responsable Régional · 3 Coachs')).toBeVisible()
  await expect(page.getByText(/12 avril 1980 · \d+ ans/)).toBeVisible()
  await expect(page.getByText('59 · Nord')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Camille TESTARD' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-rr.png`, fullPage: !isMobile })

  await page.goto('./#/equipe/directeur')
  await expect(page.getByRole('heading', { name: 'Dominique DIRECTION', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fiche personnelle' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sam SUD' })).toBeVisible()

  await page.goto('./#/equipe/coach/Camille%20TESTARD')
  await expect(page.getByRole('heading', { name: 'Fiche personnelle' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Alex NORD', exact: true })).toBeVisible()
})

test('fiche d’un Responsable Régional : champs personnels et département rempli seul', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/equipe/rr/rr2')
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Modifier Sam SUD' })
  await expect(d.getByLabel('Prénom')).toHaveValue('Sam')
  await expect(d.getByLabel(/^Nom/)).toHaveValue('SUD')
  await d.getByLabel('Date de naissance').fill('1985-03-02')
  await d.getByLabel('Date d’arrivée').fill('2021-01-04')
  await d.getByLabel('Code postal').fill('2010')
  await expect(d.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await d.getByLabel('Code postal').fill('20100')
  await expect(d.getByLabel('Département')).toHaveValue('2A')
  await d.getByLabel('Ville').fill('Sartène')
  // Hors de France, pas de code postal
  await d.getByLabel('Pays').fill('Belgique')
  await expect(d.getByLabel('Code postal')).toHaveCount(0)
  await d.getByLabel('Pays').fill('France')
  await d.getByLabel('Code postal').fill('33000')
  await expect(d.getByLabel('Département')).toHaveValue('33')
  await page.screenshot({ path: `captures/${info.project.name}-modifier-personne.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Sam SUD est mis à jour.')).toBeVisible()
  expect(cle(ecritures, 'fiches_personnes')['rr:rr2']).toEqual({
    prenom: 'Sam', nom: 'SUD', naissance: '1985-03-02', arrivee: '2021-01-04', codePostal: '33000', departement: '33', ville: 'Sartène', pays: 'France', email: '', telephone: '',
  })
  // Dates recopiées pour l'ancienne app (anniversaires)
  expect(cle(ecritures, 'drs_data').drs.find((r: { id: string }) => r.id === 'rr2')).toMatchObject({ birth: '1985-03-02', entry: '2021-01-04' })
})

test('l’onglet Collaborateurs liste Directeur, RR et Coachs et ouvre leur fiche', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe')
  await page.getByRole('tab', { name: 'Collaborateurs' }).click()
  await expect(page.getByRole('button', { name: /Responsables Régionaux \(3\)/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Coachs \(6\)/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dominique DIRECTION' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Paul MULTI' })).toHaveCount(0) // les franchisés ont leur onglet
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-equipe-collaborateurs.png`, fullPage: !isMobile })
  await page.getByRole('button', { name: /Coachs \(6\)/ }).click()
  await expect(page.getByRole('link', { name: 'Alex NORD' })).toHaveCount(0)
  await page.getByLabel('Rechercher une personne').fill('inès')
  await page.getByRole('link', { name: 'Inès EXEMPLE' }).click()
  await expect(page.getByRole('heading', { name: 'Inès EXEMPLE', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Modifier Inès EXEMPLE' })
  for (const l of ['Prénom', 'Date de naissance', 'Date d’arrivée', 'Pays', 'Code postal', 'Département', 'Ville', 'Email', 'Téléphone']) await expect(d.getByLabel(l, { exact: true })).toBeVisible()
})

test('l’onglet Franchisés liste les franchisés sans le poste en recrutement', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe?vue=franchises')
  await expect(page.getByRole('tab', { name: 'Franchisés', selected: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Paul MULTI' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Alex NORD' })).toHaveCount(0)
  await expect(page.getByText('En cours de recrutement')).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-equipe-franchises.png`, fullPage: !isMobile })
})

test('franchisés : fiche, renommage repris sur tous ses magasins', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/equipe?vue=franchises')
  await page.getByRole('link', { name: /^Paul MULTI/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Paul MULTI', level: 1 })).toBeVisible()
  await expect(page.getByText('Franchisé · 2 magasins')).toBeVisible()
  await expect(page.getByText('Annecy Test').first()).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-fiche-franchise.png`, fullPage: !isMobile })

  await page.getByRole('button', { name: 'Modifier', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Modifier Paul MULTI' })
  await d.getByLabel(/^Nom/).fill('MULTIPLE')
  await d.getByLabel('Email').fill('paul@exemple.test')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page).toHaveURL(/franchise\/Paul%20MULTIPLE/)
  const s = surcharges(ecritures)
  for (const m of ['Annecy Test', 'Rennes Test']) expect(s).toContainEqual(expect.objectContaining({ store_name: m, resp: 'Paul MULTIPLE', email_resp: 'paul@exemple.test' }))
  expect(cle(ecritures, 'fiches_personnes')['franchise:Paul MULTIPLE']).toMatchObject({ prenom: 'Paul', nom: 'MULTIPLE', email: 'paul@exemple.test' })
})

test('ajouter un franchisé et lui confier un magasin', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/equipe?vue=franchises')
  await page.getByRole('button', { name: 'Ajouter un franchisé' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter un franchisé' })
  await d.getByLabel('Prénom').fill('Jeanne')
  await d.getByLabel(/^Nom/).fill('NOUVELLE')
  await d.getByLabel('Ses magasins').fill('Nantes')
  await page.getByRole('option', { name: 'Nantes Test' }).click()
  await expect(d.getByText('Remplace Franchisé 2 sur Nantes Test.')).toBeVisible()
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page).toHaveURL(/franchise\/Jeanne%20NOUVELLE/)
  expect(surcharges(ecritures)).toContainEqual(expect.objectContaining({ store_name: 'Nantes Test', resp: 'Jeanne NOUVELLE' }))
})

test('fiche magasin : Franchisé à la place du responsable, sans adjoint ni plateforme', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Annecy%20Test')
  await expect(page.getByRole('paragraph').filter({ hasText: /^Franchisé$/ })).toBeVisible()
  await expect(page.getByText('Adjoint')).toHaveCount(0)
  await expect(page.getByText('Plateforme logistique')).toHaveCount(0)
  await expect(page.getByText('Responsable magasin')).toHaveCount(0)
  await page.getByRole('link', { name: 'Paul MULTI', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Paul MULTI', level: 1 })).toBeVisible()

  if (isMobile) await page.getByRole('button', { name: 'Rechercher' }).click()
  await page.getByLabel('Recherche globale').fill('alex')
  await page.getByRole('option', { name: /^Alex NORD/ }).click()
  await expect(page.getByRole('heading', { name: 'Alex NORD', level: 1 })).toBeVisible()
})
