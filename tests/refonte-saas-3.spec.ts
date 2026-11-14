import { expect, test, type Page } from '@playwright/test'
import { seConnecter, textesTropPetits, type Ecriture } from './supabase-simule'
import { zonesTropPetites } from './pilotage/supabase-simule'

// Refonte façon SaaS, vague 3 (Joseph, 09/11/2026, « tout lancer en même temps sauf le point 30 ») : périmètre choisi
// une fois (21A), vue d'ensemble du magasin (22A), activité en un fil (23A), page Visite en 4 étapes (24A), agenda à la
// semaine (25A), objectifs chiffrés (26A), rubrique Animation (27A), Équipe en 3 onglets (28A), rapport du mois (29A).

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

// Zones tactiles contrôlées sur les écrans neufs ; les listes reprises telles quelles ont leurs propres tests
async function lisible(page: Page, isMobile: boolean, zones = true) {
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile && zones) expect(await zonesTropPetites(page)).toEqual([])
}

test('21A : le périmètre choisi filtre les listes et se rappelle à côté du titre', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins')
  const liste = page.getByRole('region', { name: 'Liste des magasins' }).getByRole('link')
  await expect(liste.first()).toBeVisible()
  const avant = await liste.count()
  await page.getByRole('button', { name: /^Périmètre/ }).first().click()
  const menu = page.getByRole('menu', { name: 'Choisir le périmètre' })
  await expect(menu.getByRole('menuitem', { name: /Tout le réseau/ })).toBeVisible()
  await menu.getByRole('menuitem', { name: /Région Alex NORD/ }).click()
  await expect(page.getByRole('button', { name: 'Périmètre : Région Alex NORD' }).first()).toBeVisible()
  if (!isMobile) await expect(page.getByLabel('Revenir à tout le périmètre')).toBeVisible()
  await expect.poll(() => liste.count()).toBeLessThan(avant)
  // Gardé d'une page à l'autre, et après rechargement
  await page.goto('./#/visites')
  await expect(page.getByRole('button', { name: 'Périmètre : Région Alex NORD' }).first()).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Périmètre : Région Alex NORD' }).first()).toBeVisible()
  await lisible(page, isMobile, false)
})

test('22A et 23A : vue d’ensemble du magasin et activité en un seul fil', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  const indicateurs = page.getByRole('region', { name: 'Indicateurs du magasin' })
  await expect(indicateurs.getByText('CA de septembre 2026')).toBeVisible()
  await expect(indicateurs.getByText('Panier moyen HT')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Prochaines étapes' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dernier compte rendu' })).toBeVisible()
  await expect(page.getByText('Vitrine refaite, stock à revoir.').first()).toBeVisible()
  // Activité : plus de sous-onglets, « À venir » en tête et des filtres en puces
  await page.goto('./#/magasins/Lyon%20Test?vue=activite')
  await expect(page.getByRole('tablist', { name: 'Parties de l’activité' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'À venir' })).toBeVisible()
  await expect(page.getByText('Refaire la tête de gondole Beaujolais').first()).toBeVisible()
  const filtres = page.getByRole('group', { name: 'Filtrer l’activité' })
  await filtres.getByRole('button', { name: 'Visites' }).click()
  await expect(page).toHaveURL(/fil=visites/)
  // Les anciennes adresses mènent au même onglet
  await page.goto('./#/magasins/Lyon%20Test?vue=journal')
  await expect(page.getByRole('heading', { name: 'À venir' })).toBeVisible()
  await lisible(page, isMobile, false)
})

test('24A : la visite en trois étapes (vague 7), son étape dans l’historique', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test/visite?id=1')
  await expect(page.getByRole('heading', { level: 1, name: 'Visite de Lyon Test' })).toBeVisible()
  const frise = page.getByRole('navigation', { name: 'Étapes de la visite' })
  await expect(frise.getByRole('button')).toHaveCount(3)
  // Visite faite, compte rendu à signer : la frise ouvre l'étape en cours
  await expect(frise.getByRole('button', { name: /^3 Après : Signature attendue/ })).toHaveAttribute('aria-current', 'step')
  await expect(page.getByText('Refaire la tête de gondole Beaujolais').first()).toBeVisible()
  await frise.getByRole('button', { name: /^2 Visite/ }).click()
  await expect(page.getByText('Tête de gondole à reprendre.')).toBeVisible()
  await lisible(page, isMobile)
  // Préparer : la fiche avant visite dans le parcours
  await page.goto('./#/magasins/Lyon%20Test/preparer')
  await expect(page.getByText('Objet : fiche avant visite')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Planifier la visite' })).toBeVisible()
  // Historique : l'étape de chaque visite, la ligne ouvre la visite
  await page.goto('./#/visites?vue=historique')
  await expect(page.getByText('Actions 1 sur 3')).toBeVisible()
  await lisible(page, isMobile, false)
})

test('25A : l’agenda à la semaine, magasins à planifier, Visites sans Semaine', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/plus/agenda?vue=semaine')
  await expect(page.getByRole('heading', { level: 2, name: /26 oct\. – 1 nov\. 2026/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Semaine', pressed: true })).toBeVisible()
  if (!isMobile) {
    await expect(page.getByRole('grid', { name: 'Calendrier de la semaine' }).getByRole('gridcell')).toHaveCount(7)
    const panneau = page.getByRole('complementary', { name: 'Ma semaine' })
    const ligne = panneau.getByRole('region', { name: 'Visites à planifier' }).getByRole('link', { name: 'Nice Test', exact: true })
    await expect(ligne).toBeVisible()
    // Glisser sur vendredi : la planification s'ouvre à cette date
    const a = (await ligne.boundingBox())!, b = (await page.getByRole('gridcell', { name: /vendredi 30 octobre/ }).boundingBox())!
    await page.mouse.move(a.x + 40, a.y + 20); await page.mouse.down()
    await page.mouse.move(b.x + 30, b.y + 80, { steps: 8 }); await page.mouse.up()
    await expect(page.getByRole('dialog', { name: 'Visite de Nice Test' })).toBeVisible()
    await expect(page.getByLabel('Date')).toHaveValue('2026-10-30')
    await page.getByRole('button', { name: 'Annuler' }).click()
  } else {
    await expect(page.getByRole('heading', { name: 'À planifier' })).toBeVisible()
    expect(await textesTropPetits(page)).toEqual([])
  }
  await page.getByRole('button', { name: 'Semaine suivante' }).click()
  await expect(page.getByRole('heading', { level: 2, name: /2 nov\. – 8 nov\. 2026/ })).toBeVisible()
  await page.getByRole('button', { name: 'Mois' }).click()
  await expect(page.getByRole('heading', { level: 2, name: /novembre 2026/i })).toBeVisible()
  await lisible(page, isMobile)
  // Visites ne garde que Rythme et Historique ; l'ancienne adresse de la semaine mène à l'agenda
  await page.goto('./#/visites')
  await expect(page.getByRole('tab', { name: /Semaine/ })).toHaveCount(0)
  await page.goto('./#/visites?vue=semaine')
  await expect(page).toHaveURL(/plus\/agenda\?vue=semaine/)
})

test('26A : fixer un objectif chiffré, suivi dans la fiche et la préparation', async ({ page, isMobile }) => {
  const ecritures: Ecriture[] = []
  await seConnecter(page, { persister: true, ecritures })
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Fixer un objectif' }).click()
  await expect(page.getByText('Départ, septembre 2026 : 40,00 €')).toBeVisible()
  await page.getByLabel('Valeur visée').fill('45')
  await page.getByLabel('Échéance').fill('2027-01')
  await page.getByRole('dialog').getByRole('checkbox', { name: 'Refaire la tête de gondole Beaujolais' }).check()
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Objectif fixé.')).toBeVisible()
  // Joseph (14/11/2026) : objectifs de l'année et plan d'action en un seul bloc ; la période en tête de l'objectif
  const bloc = page.locator('.MuiCard-root', { has: page.getByRole('heading', { name: 'Objectifs 2027 et plan d’action' }) })
  await expect(bloc.getByRole('heading', { name: 'Panier moyen HT Cave : 40,00 € → 45,00 €' })).toBeVisible()
  await expect(bloc.getByText('D’ici janvier 2027')).toBeVisible()
  await expect(page.getByText('En attente des chiffres')).toBeVisible()
  const e = ecritures.find((x) => x.methode === 'SUIVI' && (x.corps as { key: string }).key === 'objectifs_magasins')
  const valeur = JSON.parse((e!.corps as { value: string }).value) as Record<string, { indicateur: string; cible: number; depart: number; taches: string[] }[]>
  expect(valeur['Lyon Test'][0]).toMatchObject({ indicateur: 'pmCave', cible: 45, depart: 40, taches: ['1:0'] })
  await page.goto('./#/magasins/Lyon%20Test/preparer')
  await expect(page.getByRole('table', { name: 'Objectifs du magasin' })).toBeVisible()
  await lisible(page, isMobile)
})

test('27A et 28A : rubrique Animation, Campagnes à part, Équipe en trois onglets', async ({ page, isMobile }) => {
  await seConnecter(page)
  if (!isMobile) {
    const menu = page.getByRole('navigation').first()
    await expect(menu.getByText('Animation', { exact: true })).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Campagnes' })).toBeVisible()
  }
  await page.goto('./#/campagnes')
  await expect(page.getByRole('heading', { level: 1, name: 'Campagnes' })).toBeVisible()
  // Santé du parc ne garde que Nine box et Évaluer ; ses anciennes adresses de campagnes suivent
  await page.goto('./#/plus/sante?vue=challenges')
  await expect(page).toHaveURL(/#\/campagnes\?vue=challenges/)
  await page.goto('./#/animation')
  await expect(page).toHaveURL(/#\/campagnes\?vue=suivi/)
  await page.goto('./#/equipe')
  for (const nom of ['Organisation', 'Personnes', 'Revue du mois']) await expect(page.getByRole('tab', { name: nom })).toBeVisible()
  await page.getByRole('tab', { name: 'Personnes' }).click()
  await expect(page.getByRole('tablist', { name: 'Vues des personnes' })).toBeVisible()
  await lisible(page, isMobile)
  await page.goto('./#/equipe/coach/No%C3%A9%20MODELE?vue=visites')
  await expect(page.getByRole('tab', { name: 'Activité', selected: true })).toBeVisible()
  await lisible(page, isMobile, false)
})

test('29A : rapport du mois sur le périmètre, annoncé dans la cloche', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/performance?vue=rapports')
  await expect(page.getByRole('heading', { level: 2, name: 'Rapport de septembre 2026' })).toBeVisible()
  await expect(page.getByText('CA à magasins comparables')).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Magasins qui décrochent · 1/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Lyon Test' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Télécharger en PDF' })).toBeVisible()
  await lisible(page, isMobile)
})
