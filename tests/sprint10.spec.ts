import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'
import { magasinsFictifs } from './donnees-fictives'

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs).toEqual([])
})

// Déplie toute la liste « À traiter » de l'accueil quand elle dépasse cinq lignes
const voirTout = async (page: Page) => {
  const bouton = page.getByRole('region', { name: 'À traiter' }).getByRole('button', { name: /^Voir les \d+$/ })
  await page.getByRole('region', { name: 'À traiter' }).waitFor()
  if (await bouton.count()) await bouton.click()
}

const derniere = (ecritures: Ecriture[], cle: string) => {
  const e = ecritures.filter((x) => x.table === 'app_config' && ((x.corps as { key?: string }).key === cle || x.filtre.includes(`key=eq.${cle}`))).at(-1)
  return e ? JSON.parse((e.corps as { value: string }).value) : undefined
}

test('la fiche magasin est rangée en onglets et regroupe les actions en cours', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Brest%20Test')
  const onglets = page.getByRole('tablist', { name: 'Rubriques de Brest Test' })
  await expect(onglets.getByRole('tab')).toHaveText(['Fil', 'Fiche', 'Actions', 'Messages', 'Visites', 'Chiffres', 'Santé', 'Campagnes', 'Journal'])
  // Le fil est la vue par défaut ; l'équipe est dans l'onglet Fiche
  await expect(page.getByRole('region', { name: 'Fil du magasin' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Équipe' })).toHaveCount(0)
  await onglets.getByRole('tab', { name: 'Fiche' }).click()
  await expect(page.getByRole('heading', { name: 'Équipe' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toHaveCount(0)
  // En-tête : deux actions en cours dont une en retard
  await expect(page.getByRole('group', { name: 'En bref' })).toContainText(/2 ?tâches en cours/)
  await expect(page.getByText('1 tâche en retard', { exact: true })).toBeVisible()
  await onglets.getByRole('tab', { name: 'Actions' }).click()
  const liste = page.getByRole('list', { name: 'Actions en cours de Brest Test' })
  await expect(liste.getByRole('listitem')).toHaveCount(2)
  await expect(liste.getByRole('listitem').first()).toContainText('Refaire la vitrine')
  await expect(liste.getByRole('listitem').first()).toContainText('En retard')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-actions.png`, fullPage: !isMobile })
  await page.getByRole('checkbox', { name: 'Marquer faite : Refaire la vitrine' }).click()
  await expect(page.getByText('Action marquée faite.')).toBeVisible()
  const maj = ecritures.filter((e) => e.table === 'visits' && e.methode === 'PATCH').at(-1)!
  expect(maj.filtre).toBe('?id=eq.4')
  const plan = (maj.corps as { action_plan: { id: string; faite?: string }[] }).action_plan
  expect(plan.find((a) => a.id === 'a1')?.faite).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(plan.find((a) => a.id === 'a3')?.faite).toBe('2026-09-24')
  // Les actions faites restent consultables
  await page.getByRole('button', { name: 'Actions faites (1)' }).click()
  await expect(page.getByRole('list', { name: 'Actions en cours de Brest Test : faites' })).toContainText('Changer l’enseigne')
})

test('une nouvelle visite reprend les actions en cours et les coche faites', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Brest%20Test?vue=visites')
  await page.getByRole('button', { name: 'Saisir', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Saisir une visite' })
  const enCours = d.getByRole('group', { name: 'Actions en cours' })
  await expect(enCours).toContainText('Refaire la vitrine')
  await expect(enCours).toContainText('Former l’équipe à la vente additionnelle')
  await expect(enCours).not.toContainText('Changer l’enseigne')
  await enCours.getByRole('checkbox').first().click()
  await d.getByRole('button', { name: 'Ajouter une action' }).click()
  await d.getByLabel('Action', { exact: true }).fill('Mettre en avant les coffrets')
  await d.getByLabel('Échéance', { exact: true }).fill('2026-12-15')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Visite enregistrée.')).toBeVisible()
  const nouvelle = ecritures.find((e) => e.table === 'visits' && e.methode === 'POST')!
  expect(JSON.stringify(nouvelle.corps)).toContain('"echeance":"2026-12-15"')
  const maj = ecritures.find((e) => e.table === 'visits' && e.methode === 'PATCH')!
  expect((maj.corps as { action_plan: { id: string; faite?: string }[] }).action_plan.find((a) => a.id === 'a1')?.faite).toBe(new Date().toISOString().slice(0, 10))
})

test('un magasin franchisé a plusieurs associés avec leurs mandats', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  const associes = { 'Brest Test': [
    { id: 'x1', nom: 'Franchisé 11', entree: '', sortie: '', mandats: [{ debut: '2017-01-01', fin: '2021-12-31' }, { debut: '2022-01-01', fin: '2027-03-31' }] },
    { id: 'x2', nom: 'Ancien ASSOCIE', entree: '', sortie: '2024-06-30', mandats: [{ debut: '2017-01-01', fin: '2021-12-31' }] },
  ] }
  await seConnecter(page, { ecritures, config: { associes } })
  await page.goto('./#/magasins/Brest%20Test?vue=fiche')
  await expect(page.getByRole('heading', { name: 'Franchisés associés' })).toBeVisible()
  await expect(page.getByText('Mandat du 1 janv. 2022 au 31 mars 2027 · 2 mandats')).toBeVisible()
  await expect(page.getByText('Fin dans moins d’un an')).toBeVisible()
  await expect(page.getByText('Anciens associés')).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter un associé' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter un associé' })
  await d.getByLabel('Nom').fill('Claire DUO')
  await d.getByLabel('Début du mandat').fill('2026-10-01')
  await d.getByLabel('Fin du mandat').fill('2031-09-30')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Claire DUO est ajouté aux associés.')).toBeVisible()
  const v = derniere(ecritures, 'associes')
  expect(v['Brest Test'].map((a: { nom: string }) => a.nom)).toEqual(['Franchisé 11', 'Ancien ASSOCIE', 'Claire DUO'])
  expect(v['Brest Test'][2].mandats).toEqual([{ debut: '2026-10-01', fin: '2031-09-30' }])
  await page.getByRole('heading', { name: 'Franchisés associés' }).scrollIntoViewIfNeeded()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-associes.png`, fullPage: !isMobile })
  // Reconduction du mandat : un nouveau mandat s'ajoute à l'historique
  await page.getByRole('button', { name: 'Modifier l’associé Franchisé 11' }).click()
  const m = page.getByRole('dialog', { name: 'Modifier Franchisé 11' })
  await m.getByRole('button', { name: 'Ajouter une reconduction' }).click()
  await expect(m.getByLabel('Début du mandat').last()).toHaveValue('2027-04-01')
  await m.getByLabel('Fin du mandat').last().fill('2032-03-31')
  await m.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Franchisé 11 est mis à jour.')).toBeVisible()
  expect(derniere(ecritures, 'associes')['Brest Test'][0].mandats).toHaveLength(3)
})

test('un magasin intégré associe V and B à des particuliers', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Lyon%20Test?vue=fiche')
  await expect(page.getByRole('heading', { name: 'Associés', exact: true })).toBeVisible()
  await expect(page.getByText('V and B', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter un associé' }).click()
  const d = page.getByRole('dialog', { name: 'Ajouter un associé' })
  await d.getByLabel('Nom').fill('Martin PARTICULIER')
  await d.getByLabel('Associé depuis le').fill('2020-05-01')
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Martin PARTICULIER est ajouté aux associés.')).toBeVisible()
  expect(derniere(ecritures, 'associes')['Lyon Test']).toEqual([expect.objectContaining({ nom: 'Martin PARTICULIER', entree: '2020-05-01' })])
  // Le responsable du magasin intégré n'est pas touché
  expect(ecritures.filter((e) => e.table === 'store_overrides')).toEqual([])
})

test('les mandats à renouveler remontent à l’accueil et sur la fiche du franchisé', async ({ page }) => {
  const associes = { 'Brest Test': [{ id: 'x1', nom: 'Franchisé 11', entree: '', sortie: '', mandats: [{ debut: '2016-01-01', fin: '2026-06-30' }] }] }
  await seConnecter(page, { config: { associes } })
  const bloc = page.getByRole('region', { name: 'À traiter' })
  await voirTout(page)
  const mandat = bloc.getByRole('link', { name: /^Franchisé 11 · Brest Test/ })
  await expect(mandat).toContainText('Fin du mandat le')
  await expect(mandat).toContainText('Mandat échu')
  await page.goto('./#/equipe/franchise/Franchis%C3%A9%2011')
  await expect(page.getByRole('heading', { name: 'Mandats' })).toBeVisible()
  await expect(page.getByText('Mandat du 1 janv. 2016 au 30 juin 2026')).toBeVisible()
})

test('la fiche Coach est rangée en onglets, sans historique des affectations', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/equipe/coach/No%C3%A9%20MODELE')
  await expect(page.getByRole('tablist', { name: 'Rubriques de Noé MODELE' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Historique' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(page.getByRole('list', { name: 'Actions en cours des magasins de Noé MODELE' })).toContainText('Brest Test')
  await page.getByRole('tab', { name: 'Visites' }).click()
  await expect(page.getByRole('heading', { name: 'Dernières visites' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Brest Test' }).first()).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-coach-visites.png`, fullPage: !isMobile })
  await page.getByRole('tab', { name: 'Campagnes' }).click()
  await expect(page.getByText('Aucune campagne en cours ou passée sur ces magasins.')).toBeVisible()
  await page.getByRole('tab', { name: 'Fiche' }).click()
  await expect(page.getByRole('heading', { name: 'Rattachement' })).toBeVisible()
})

test('l’accueil du Directeur montre tout le réseau, avec son titre et sans choix de vue', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Accueil' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Vue' })).toHaveCount(0)
  const aTraiter = page.getByRole('region', { name: 'À traiter' })
  await voirTout(page)
  await expect(aTraiter.getByText(/^(Poste de Coach à pourvoir|Charge \d+ sur \d+)$/).first()).toBeVisible()
  await expect(aTraiter).toContainText('Refaire la vitrine')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-accueil.png`, fullPage: !isMobile })
})

test('un compte Coach ne voit que ses magasins à l’accueil', async ({ page }) => {
  await seConnecter(page, { appMetadata: { role: 'coach', coach: 'Noé MODELE' } })
  await expect(page.getByRole('heading', { level: 1, name: 'Accueil' })).toBeAttached()
  await expect(page.getByRole('combobox', { name: 'Vue' })).toHaveCount(0)
  const aTraiter = page.getByRole('region', { name: 'À traiter' })
  await voirTout(page)
  await expect(aTraiter.getByRole('link', { name: /^Lyon Test/ }).first()).toBeVisible()
  await expect(aTraiter).not.toContainText('Fin du mandat')
  await expect(aTraiter).not.toContainText('Nantes Test')
})

test('la colonne Magasin reste fixe dans les tableaux', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Tableaux affichés sur PC')
  await seConnecter(page)
  await page.goto('./#/visites')
  await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Tableau' }).click()
  await expect(page.getByRole('table', { name: 'Rythme de visite par magasin' }).locator('tbody tr').first().locator('td').first()).toHaveCSS('position', 'sticky')
  await page.goto('./#/plus/sante?vue=deploiements')
  await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Tableau' }).click()
  const ligne = page.getByRole('table', { name: 'Déploiements par magasin' }).locator('tbody tr').first()
  await expect(ligne.locator('td').nth(1)).toHaveCSS('position', 'sticky')
  await expect(ligne.locator('td').nth(1)).toHaveCSS('left', '52px')
})

test('un magasin importé avec sa seule adresse est replacé sur sa commune', async ({ page }) => {
  const ecritures: Ecriture[] = []
  const olonne = { n: 'Olonne Test', dept: '85', open: '2019-03-15', addr: 'Rue Des Œillets, 85340 Les Sables D Olonne', franchise: false, lat: 46.67, lon: -1.43, geo: 'dept' }
  await seConnecter(page, { ecritures, config: { store_adds: [...magasinsFictifs, olonne] } })
  await expect.poll(() => ecritures.find((e) => e.table === 'store_overrides' && JSON.stringify(e.corps).includes('Olonne Test'))).toBeTruthy()
  const e = ecritures.find((x) => x.table === 'store_overrides' && JSON.stringify(x.corps).includes('Olonne Test'))!
  expect(e.corps).toMatchObject({ store_name: 'Olonne Test', lat: 47.65 })
})
