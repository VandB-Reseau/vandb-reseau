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
  await expect(page.getByRole('cell', { name: 'Cœur de réseau : 1 magasin' })).toBeVisible()
  await page.getByRole('button', { name: 'Voir les 1 magasins : Locomotive' }).click()
  const panneau = page.getByRole('dialog', { name: 'Locomotive' })
  await expect(panneau.getByRole('link', { name: /Annecy Test/ })).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `captures/${info.project.name}-sante-ninebox-case.png` })
  await panneau.getByRole('button', { name: 'Fermer' }).click()
  await expect(panneau).toBeHidden()
  await expect(page.getByText('Non classés')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-sante-ninebox.png`, fullPage: !isMobile })
})

test('noter en un clic enregistre la case du magasin', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/plus/sante?vue=evaluer')
  await page.getByRole('combobox', { name: 'Rechercher un magasin ou un Coach' }).fill('Rennes')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Fort : CA marché extérieur de Rennes Test' }).click()
  await page.getByRole('button', { name: /^Fort : Niveau du franchisé.* de Rennes Test/ }).click()
  await expect(page.getByText('Locomotive').first()).toBeVisible()
  await expect.poll(() => ecritures.filter((e) => e.table === 'app_config' && JSON.stringify(e.corps).includes('locomotive')).length).toBe(1)
  await page.screenshot({ path: `captures/${info.project.name}-sante-evaluer.png`, fullPage: !isMobile })
})

test('saisie groupée : une valeur pour plusieurs magasins', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Tableau réservé au PC')
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/plus/sante?vue=deploiements')
  await page.getByRole('checkbox', { name: 'Sélectionner Nice Test' }).check()
  await page.getByRole('checkbox', { name: 'Sélectionner Metz Test' }).check()
  const barre = page.getByRole('region', { name: 'Saisie groupée' })
  await expect(barre).toContainText('2 magasins sélectionnés')
  await barre.getByLabel('Appliquer à').click()
  await page.getByRole('option', { name: 'Terrasse' }).click()
  await barre.getByRole('button', { name: 'Oui : Terrasse pour la sélection' }).click()
  await expect(page.getByRole('button', { name: 'Oui : Terrasse de Nice Test' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Oui : Terrasse de Metz Test' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => ecritures.filter((e) => e.table === 'app_config').length).toBe(1)
  const corps = JSON.stringify(ecritures[0].corps)
  expect(corps).toContain('Nice Test')
  expect(corps).toContain('Metz Test')
  await page.screenshot({ path: 'captures/pc-sante-groupe.png' })
})

test('magasin par magasin avec « Magasin suivant »', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/plus/sante?vue=evaluer')
  if (!isMobile) await page.getByRole('button', { name: 'Magasin par magasin' }).click()
  await expect(page.getByText(/Magasin 1 sur 29/)).toBeVisible()
  await page.getByRole('button', { name: 'Magasin suivant' }).click()
  await expect(page.getByText(/Magasin 2 sur 29/)).toBeVisible()
  await page.getByText('Seulement les magasins à compléter').click()
  await expect(page.getByText(/Magasin 1 sur 26/)).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-sante-fiche.png`, fullPage: !isMobile })
})

test('les thématiques se gèrent', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/plus/sante?vue=deploiements')
  await expect(page.getByRole('img', { name: /Concept 2.0 : 1 magasins/ })).toBeVisible()
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

test('import d’un fichier CSV façon Asana', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/plus/sante?vue=deploiements')
  await page.getByRole('button', { name: 'Importer Excel' }).click()
  const d = page.getByRole('dialog', { name: 'Importer depuis Excel' })
  const csv = 'Nom;Épicerie fine;Mixologie;5+1;Flux bar;Commentaire\nNice Test;Oui - avancé;Partiellement;Non;Fort;ok\nMagasin inconnu;Oui;;;;\nMetz Test;Non;Oui;Oui;2;\n'
  await d.getByLabel('Fichier à importer').setInputFiles({ name: 'asana.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(d).toContainText('8 valeurs prêtes à importer pour 2 magasins')
  await expect(d).toContainText('Colonnes ignorées : Commentaire')
  await expect(d).toContainText('Magasins non trouvés (1) : Magasin inconnu')
  await page.screenshot({ path: `captures/${info.project.name}-sante-import.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  await expect.poll(() => ecritures.filter((e) => e.table === 'app_config').length).toBe(2)
  const tout = JSON.stringify(ecritures.map((e) => e.corps))
  expect(tout).toContain('Oui')
  expect(tout).toContain('fluxBar')
})

test('la fiche magasin montre la santé et les déploiements', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  await expect(page.getByText('Redressement urgent')).toBeVisible()
  await expect(page.getByText('Rythme de visite conseillé : 8 visites × ½ j')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fait : Concept 2.0' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByText('Santé et déploiements').scrollIntoViewIfNeeded()
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
  await page.goto('./#/magasins/Rennes%20Test')
  await page.getByRole('button', { name: 'Moyen : CA marché extérieur' }).click()
  await page.getByRole('button', { name: 'Moyen : Flux bar' }).click()
  await expect.poll(() => ecritures.filter((e) => e.table === 'app_config').length).toBe(1)
  const corps = JSON.stringify(ecritures[0].corps)
  expect(corps).toContain('caExterieur')
  expect(corps).toContain('fluxBar')
  await page.goto('./#/plus/sante?vue=evaluer')
  await page.goto('./#/magasins/Rennes%20Test')
  await expect(page.getByRole('button', { name: 'Moyen : Flux bar' })).toHaveAttribute('aria-pressed', 'true')
})

test('la recherche propose les magasins rangés par Coach et accepte un nom de Coach', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/plus/sante?vue=deploiements')
  const champ = page.getByRole('combobox', { name: 'Rechercher un magasin ou un Coach' })
  await champ.click()
  await expect(page.getByRole('listbox')).toContainText('Hugo FICTIF')
  await page.screenshot({ path: `captures/${info.project.name}-sante-recherche.png` })
  await champ.fill('Noé')
  await expect(page.getByRole('option', { name: 'Lyon Test' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Annecy Test' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('link', { name: 'Annecy Test' })).toHaveCount(0)
})

test('le titre et la recherche restent en place d’un onglet à l’autre', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/plus/sante')
  const titre = page.getByRole('heading', { name: 'Santé du parc', level: 1 })
  const champ = page.getByRole('combobox', { name: 'Rechercher un magasin ou un Coach' })
  const ref = [await titre.boundingBox(), await champ.boundingBox()]
  for (const onglet of ['Évaluer', 'Déploiements', 'Nine box']) {
    await page.getByRole('tab', { name: onglet }).click()
    await expect.poll(async () => [await titre.boundingBox(), await champ.boundingBox()]).toEqual(ref)
  }
})
