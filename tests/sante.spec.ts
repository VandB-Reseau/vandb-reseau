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
  // Les deux axes sont lisibles, téléphone compris : Franchisé (vertical) et Résultats (horizontal)
  for (const n of ['fort', 'moyen', 'faible']) {
    const axe = page.getByText(`Franchisé ${n}`, { exact: true })
    await expect(axe).toBeVisible()
    await axe.scrollIntoViewIfNeeded()
    await expect(axe).toBeInViewport({ ratio: 0.95 })
  }
  await expect(page.getByText('Résultats faibles', { exact: true })).toBeVisible()
  // Le libellé vertical ne déborde pas de sa ligne
  const ligne = await page.getByRole('row').first().getByRole('cell').first().boundingBox()
  const libelle = await page.getByText('Franchisé moyen', { exact: true }).boundingBox()
  expect(libelle!.height).toBeLessThanOrEqual(ligne!.height)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-sante-ninebox.png`, fullPage: !isMobile })
})

test('noter en un clic enregistre la case du magasin', async ({ page, isMobile }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/plus/sante?vue=evaluer')
  await page.getByRole('combobox', { name: 'Rechercher un magasin ou un Coach' }).fill('Rennes')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Saisir Rennes Test' }).click()
  await page.getByRole('button', { name: 'Fort : CA marché extérieur de Rennes Test' }).click()
  await page.getByRole('button', { name: /^Fort : Gestion.* de Rennes Test/ }).click()
  await expect(page.getByRole('dialog', { name: 'Rennes Test' }).getByText('Locomotive')).toBeVisible()
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
  await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Tableau' }).click()
  await expect(page.getByRole('button', { name: 'Oui : Terrasse de Nice Test' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Oui : Terrasse de Metz Test' })).toHaveAttribute('aria-pressed', 'true')
  // Une seule écriture : les deux magasins partent ensemble
  await expect.poll(() => ecritures.filter((e) => e.table === 'suivi_magasins').length).toBe(1)
  const corps = JSON.stringify(ecritures.find((e) => e.table === 'suivi_magasins')!.corps)
  expect(corps).toContain('Nice Test')
  expect(corps).toContain('Metz Test')
  await page.screenshot({ path: 'captures/pc-sante-groupe.png' })
})

test('une ligne par magasin, la saisie en panneau avec « Magasin suivant »', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/plus/sante?vue=evaluer')
  const lignes = page.getByRole('region', { name: 'Évaluation des magasins' }).getByRole('button', { name: /^Saisir / })
  await expect(lignes).toHaveCount(29)
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.screenshot({ path: `captures/${info.project.name}-sante-evaluer-lignes.png`, fullPage: !isMobile })
  await lignes.first().click()
  const panneau = page.getByRole('dialog')
  await expect(panneau.getByText(/1 sur 29/)).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-sante-panneau.png` })
  await panneau.getByRole('button', { name: 'Magasin suivant' }).click()
  await expect(panneau.getByText(/2 sur 29/)).toBeVisible()
  await panneau.getByRole('button', { name: 'Fermer' }).click()
  await page.getByRole('button', { name: /^À compléter · \d+$/ }).click()
  await expect(page.getByRole('button', { name: /^À compléter/ })).toHaveAttribute('aria-pressed', 'true')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-sante-fiche.png`, fullPage: !isMobile })
})

test('les thématiques se gèrent', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Gestion des thématiques réservée au PC')
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/plus/sante?vue=deploiements')
  await expect(page.getByRole('img', { name: /Concept 2.0 : 1 magasins/ })).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-sante-deploiements.png`, fullPage: !isMobile })
  // Plus de gestion des thématiques ici : elle est dans les Paramètres
  await expect(page.getByRole('button', { name: 'Gérer les thématiques' })).toHaveCount(0)
  await page.goto('./#/parametres/reglages?rubrique=thematiques')
  await page.getByRole('button', { name: 'Gérer les thématiques' }).click()
  const d = page.getByRole('dialog', { name: 'Thématiques de déploiement' })
  await d.getByRole('button', { name: 'Ajouter une thématique' }).click()
  await d.getByRole('textbox', { name: 'Thématique' }).last().fill('Click and collect')
  expect(await textesTropPetits(page)).toEqual([])
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  await expect.poll(() => ecritures.some((e) => JSON.stringify(e.corps).includes('Click and collect'))).toBe(true)
})

test('import d’un fichier CSV façon Asana', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'Import réservé au PC')
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/parametres/donnees')
  // L'export Asana passe par la carte « Déploiements » (ou « Nine box ») : il est reconnu à ses colonnes
  await page.getByRole('button', { name: 'Importer Déploiements', exact: true }).click()
  const d = page.getByRole('dialog', { name: 'Importer depuis Excel' })
  const csv = 'Nom;Épicerie fine;Mixologie;5+1;Flux bar;Commentaire\nNice Test;Oui - avancé;Partiellement;Non;Fort;ok\nMagasin inconnu;Oui;;;;\nMetz Test;Non;Oui;Oui;2;\n'
  await page.getByRole('dialog', { name: 'Importer : Déploiements' }).getByLabel('Fichier Déploiements à importer').setInputFiles({ name: 'asana.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(d).toContainText('8 valeurs prêtes à importer pour 2 magasins')
  await expect(d).toContainText('Colonnes ignorées : Commentaire')
  await expect(d).toContainText('Magasins non trouvés (1) : Magasin inconnu')
  await page.screenshot({ path: `captures/${info.project.name}-sante-import.png` })
  await d.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(d).toBeHidden()
  await expect.poll(() => ecritures.filter((e) => e.table === 'suivi_magasins').length).toBe(2)
  const tout = JSON.stringify(ecritures.map((e) => e.corps))
  expect(tout).toContain('Oui')
  expect(tout).toContain('fluxBar')
})

test('la fiche magasin montre la santé et les déploiements dans deux blocs', async ({ page }, info) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test?vue=sante')
  await expect(page.getByRole('heading', { name: 'Santé', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Déploiements', exact: true })).toBeVisible()
  await expect(page.getByText('Redressement urgent', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Rythme de visite : 8 visites × ½ j')).toBeVisible()
  await page.getByRole('heading', { name: 'Déploiements', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `captures/${info.project.name}-fiche-sante.png` })
})

test('depuis la fiche magasin, Modifier ouvre la saisie de la santé puis des déploiements du magasin', async ({ page }, info) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/magasins/Rennes%20Test?vue=sante')
  await page.getByRole('button', { name: 'Modifier la santé' }).click()
  await expect(page).toHaveURL(/plus\/sante\?vue=evaluer&magasin=Rennes/)
  let d = page.getByRole('dialog', { name: 'Rennes Test' })
  await d.getByRole('button', { name: 'Non concerné : Panier moyen bar de Rennes Test' }).click()
  await d.getByRole('button', { name: 'Fort : CA marché extérieur de Rennes Test' }).click()
  await d.getByRole('button', { name: /^Fort : Gestion/ }).click()
  await expect(d.getByText('Locomotive')).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-fiche-modifier-sante.png` })
  await page.goBack()
  await page.getByRole('button', { name: 'Modifier les déploiements' }).click()
  await expect(page).toHaveURL(/plus\/sante\?vue=deploiements&magasin=Rennes/)
  d = page.getByRole('dialog', { name: 'Rennes Test' })
  await d.getByRole('button', { name: 'Oui : Terrasse de Rennes Test' }).click()
  await expect.poll(() => JSON.stringify(ecritures.filter((e) => e.table === 'app_config').map((e) => e.corps))).toContain('terrasse')
  const config = JSON.stringify(ecritures.filter((e) => e.table === 'app_config').map((e) => e.corps))
  expect(config).toContain('locomotive')
  expect(config).toContain('\\"panierBar\\":0')
})
test('l’accueil donne les priorités du jour', async ({ page, isMobile }, info) => {
  // Heure figée sur l'instant présent : le séminaire fictif (demain) reste dans les sept prochains jours
  await page.clock.setFixedTime(new Date())
  await seConnecter(page)
  await page.goto('./#/')
  const aTraiter = page.getByRole('region', { name: 'À traiter' })
  await aTraiter.getByRole('button', { name: /^Voir les \d+$/ }).click()
  await expect(aTraiter.getByRole('link', { name: /^Lyon Test/ }).first()).toContainText('Décroche')
  await expect(aTraiter.getByRole('link', { name: /^Poste NORD/ })).toContainText('Poste de Coach à pourvoir')
  await expect(aTraiter.getByRole('link', { name: /^Vichy Test/ })).toContainText('Ouverture')
  // Téléphone : la semaine est un onglet du bloc « Mon point »
  if (isMobile) await page.getByRole('tab', { name: 'Semaine' }).click()
  await expect(page.getByRole('region', { name: 'Cette semaine' })).toContainText('Séminaire des Coachs')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-accueil.png`, fullPage: !isMobile })
})

test('l’évolution compte les ouvertures par année', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.goto('./#/parametres/evolution')
  await expect(page.getByText('Les fermetures ne sont pas encore enregistrées')).toHaveCount(0)
  const annees = page.getByRole('region', { name: 'Évolution par année' })
  await expect(annees.locator('> div').filter({ hasText: '2026 (en cours)' })).toContainText('dont 2 prévues · 29 au total')
  if (!isMobile) {
    await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Tableau' }).click()
    await expect(page.getByRole('row', { name: /2026 \(en cours\)/ })).toContainText('(dont 2 prévues)29')
  }
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-evolution.png`, fullPage: !isMobile })
})

test('plusieurs notes rapides partent en une seule écriture et restent après un changement de page', async ({ page }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { ecritures })
  await page.goto('./#/plus/sante?vue=evaluer')
  await page.getByRole('combobox', { name: 'Rechercher un magasin ou un Coach' }).fill('Rennes')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Saisir Rennes Test' }).click()
  await page.getByRole('button', { name: 'Moyen : CA marché extérieur de Rennes Test' }).click()
  await page.getByRole('button', { name: 'Moyen : Flux bar de Rennes Test' }).click()
  await expect.poll(() => ecritures.filter((e) => e.table === 'suivi_magasins').length).toBe(1)
  const corps = JSON.stringify(ecritures.find((e) => e.table === 'suivi_magasins')!.corps)
  expect(corps).toContain('caExterieur')
  expect(corps).toContain('fluxBar')
  await page.goto('./#/magasins/Rennes%20Test')
  await page.goto('./#/plus/sante?vue=evaluer')
  await page.getByRole('combobox', { name: 'Rechercher un magasin ou un Coach' }).fill('Rennes')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Saisir Rennes Test' }).click()
  await expect(page.getByRole('button', { name: 'Moyen : Flux bar de Rennes Test' })).toHaveAttribute('aria-pressed', 'true')
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

test('plus d’import ni de réglage dans la Santé du parc, et plus de doublon Carte', async ({ page }) => {
  await seConnecter(page)
  for (const vue of ['evaluer', 'deploiements', 'chiffres']) {
    await page.goto(`./#/plus/sante?vue=${vue}`)
    await expect(page.getByRole('heading', { name: 'Santé du parc' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Importer|Gérer les thématiques|Effacer toutes les notes/ })).toHaveCount(0)
  }
  await page.goto('./#/plus/carte')
  await expect(page).toHaveURL(/#\/magasins\?vue=carte/)
  await page.goto('./#/plus')
  await expect(page.getByRole('link', { name: /^Carte/ })).toHaveCount(0)
})

test('sur téléphone, la nine box apparaît sans faire défiler et les filtres se déplient', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'Spécifique au téléphone')
  await seConnecter(page)
  await page.goto('./#/plus/sante')
  await expect(page.getByText('en attendant le lien avec la BI')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Filtre Coach' })).toHaveCount(0)
  const caseHaut = await page.getByRole('cell', { name: /^Diagnostic marché/ }).boundingBox()
  expect(caseHaut!.y).toBeLessThan(page.viewportSize()!.height)
  await page.screenshot({ path: `captures/${info.project.name}-sante-ninebox.png` })
  await page.getByRole('button', { name: 'Filtres' }).click()
  await expect(page.getByRole('button', { name: 'Filtre Coach' })).toBeVisible()
})
