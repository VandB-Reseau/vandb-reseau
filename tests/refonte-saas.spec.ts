import { expect, test, type Page } from '@playwright/test'
import { COMPTE, simulerSupabase, textesTropPetits } from './supabase-simule'
import { magasinFictif } from './pilotage/donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type TicketsSimules, type VenteSimulee } from './pilotage/supabase-simule'

// Refonte façon SaaS (Joseph, 09/11/2026 : 1A 2A 3A 4A 5A 6A 7A 8C 9A) : menu clair en quatre rubriques sans barre noire,
// fiche à cinq onglets et deux niveaux au plus, tableau des magasins avec aperçu sur PC (lignes sur téléphone), période des
// chiffres en tête de l'accueil, actualités visibles dès l'arrivée, style sobre hors des écrans qui communiquent,
// recherche Ctrl K qui crée, fenêtres de saisie en panneau à droite. Données fictives uniquement.

const M = 'Annecy Test'
const magasins: MagasinSimule[] = [{ magasin: M, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }]
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const reel: VenteSimulee[] = []
const tickets: TicketsSimules[] = []
for (const a of [2025, 2026]) for (let m = 1; m <= (a === 2026 ? 9 : 12); m++) {
  reel.push({ store_name: M, mois: mois(a, m), univers: 'cave', famille: 'Vin', ca_ht: 30_000 + m * 1_000, ca_ttc: 36_000 + m * 1_200, marge_ht: 11_000 + m * 300 })
  tickets.push({ store_name: M, mois: mois(a, m), univers: 'cave', tickets: 1_500 + m * 10 })
}

async function connecter(page: Page) {
  await simulerSupabase(page, {})
  await simulerPilotage(page, { magasins, reel, tickets })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
}
const fiche = (suite = '') => `./#/magasins/${encodeURIComponent(M)}${suite}`

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('PC : menu clair en quatre rubriques, sans barre noire ; téléphone : barre du haut claire et barre du bas inchangée', async ({ page, isMobile }, info) => {
  await connecter(page)
  if (isMobile) {
    const fond = await page.getByRole('banner').evaluate((e) => getComputedStyle(e).backgroundColor)
    expect(fond).not.toBe('rgb(0, 0, 0)')
    await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button')).toHaveText(['Accueil', 'Visites', /Messages$/, /Tâches$/, /^Santé/])
    expect(await zonesTropPetites(page)).toEqual([])
  } else {
    await expect(page.getByRole('banner')).toHaveCount(0)
    const menu = page.getByRole('navigation', { name: 'Navigation principale' })
    for (const r of ['Mon travail', 'Réseau', 'Finances', 'Réglages']) await expect(menu.getByText(r, { exact: true })).toBeVisible()
    await expect(menu.getByRole('button')).toHaveText(['Accueil', /^Tâches/, /^Messages/, 'Agenda', 'Magasins', 'Visites', 'Santé du parc', 'Budgets', 'Équipe', 'Paramètres'])
    // Animation réseau et Évolution du parc ne sont plus dans le menu : onglet de Messages, vue de Magasins
    await expect(menu.getByRole('button', { name: 'Animation réseau' })).toHaveCount(0)
    await page.goto('./#/animation')
    await expect(page.getByRole('tablist', { name: 'Messages et animation' }).getByRole('tab', { name: 'Animation réseau' })).toHaveAttribute('aria-selected', 'true')
    await expect(menu.getByRole('button', { name: /^Messages/ })).toHaveAttribute('aria-current', 'page')
  }
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-refonte-coquille.png` })
})

test('PC : Ctrl K place le curseur dans la recherche, qui propose de créer et ouvre la saisie en panneau à droite', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'raccourci clavier et panneau latéral : PC')
  await connecter(page)
  await page.keyboard.press('Control+k')
  const champ = page.getByRole('combobox', { name: 'Recherche globale' })
  await expect(champ).toBeFocused()
  await champ.fill('Annecy')
  const action = page.getByRole('option', { name: `Saisir une visite à ${M}` })
  await expect(action).toBeVisible()
  await action.click()
  const fenetre = page.getByRole('dialog', { name: 'Saisir une visite' })
  await expect(fenetre).toBeVisible()
  // Panneau collé au bord droit, sur toute la hauteur
  const b = (await fenetre.boundingBox())!
  const largeur = page.viewportSize()!.width
  expect(Math.abs(b.x + b.width - largeur)).toBeLessThanOrEqual(2)
  expect(b.height).toBeGreaterThan(page.viewportSize()!.height - 4)
  await page.screenshot({ path: `captures/${info.project.name}-refonte-panneau.png` })
})

test('la fiche du magasin tient en cinq onglets et deux niveaux ; le suivi, la santé et les saisies sont dans Chiffres', async ({ page, isMobile }, info) => {
  await connecter(page)
  await page.goto(fiche())
  const onglets = page.getByRole('tablist', { name: `Rubriques de ${M}` })
  if (!isMobile) await expect(onglets.getByRole('tab')).toHaveText(['Vue d’ensemble', 'Activité', 'Chiffres', 'Budget', 'Ressources'])
  // Activité : tâches et campagnes, visites, journal
  await page.goto(fiche('?vue=visites'))
  await expect(page.getByRole('tablist', { name: 'Parties de l’activité' }).getByRole('tab')).toHaveText(['Tâches et campagnes', 'Visites', 'Journal'])
  await expect(page.getByRole('tablist', { name: 'Parties de l’activité' }).getByRole('tab', { name: 'Visites' })).toHaveAttribute('aria-selected', 'true')
  // Chiffres : une seule sous-navigation
  await page.goto(fiche('?vue=chiffres'))
  const parties = page.getByRole('tablist', { name: 'Parties des chiffres' })
  await expect(parties.getByRole('tab', { name: 'Vue d’ensemble' })).toHaveAttribute('aria-selected', 'true')
  await expect(parties.getByRole('tab', { name: 'Santé et leviers' })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Espaces du magasin' })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-refonte-chiffres.png` })
  // Ancien lien vers la santé : Chiffres, puce Santé et leviers
  await page.goto(fiche('?vue=sante'))
  await expect(page.getByRole('tablist', { name: 'Parties des chiffres' }).getByRole('tab', { name: 'Santé et leviers' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Santé', exact: true })).toBeVisible()
  // Saisies : une bascule entre les quatre saisies, pas un troisième rang d'onglets
  await page.getByRole('tablist', { name: 'Parties des chiffres' }).getByRole('tab', { name: /^Saisies/ }).click()
  await expect(page.getByRole('group', { name: 'Saisies du magasin' }).getByRole('button')).toHaveText(['Réel du mois', 'Stock de fin de mois', 'Comptes du quadrimestre', /^Frais/])
  // Ancien lien vers une partie du suivi depuis Budget : l'onglet Chiffres
  await page.goto(fiche('?vue=budget&partie=mois'))
  await expect(page).toHaveURL(/vue=chiffres/)
  // Budget : seulement les étapes du budget
  await page.goto(fiche('?vue=budget'))
  await expect(page.getByRole('tablist', { name: /Étapes du budget/ })).toBeVisible()
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('PC : les magasins en tableau, une ligne ouvre l’aperçu ; téléphone : les lignes restent', async ({ page, isMobile }, info) => {
  await connecter(page)
  await page.goto('./#/magasins')
  if (isMobile) {
    await expect(page.getByRole('table', { name: 'Tableau des magasins' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Annecy Test/ }).first()).toBeVisible()
    expect(await zonesTropPetites(page)).toEqual([])
    await page.screenshot({ path: `captures/${info.project.name}-refonte-magasins.png` })
    return
  }
  const tableau = page.getByRole('table', { name: 'Tableau des magasins' })
  await expect(tableau).toBeVisible()
  await expect(tableau.getByRole('columnheader')).toContainText(['Magasin', 'Coach', 'Responsable Régional', 'CA du mois', 'vs N-1', 'Nine box', 'Dernière visite', 'Tâches'])
  // Plus de lignes qu'avant à l'écran : au moins 14 magasins visibles sans défiler
  const visibles = await tableau.locator('tbody tr').evaluateAll((l) => l.filter((r) => r.getBoundingClientRect().bottom <= window.innerHeight).length)
  expect(visibles).toBeGreaterThanOrEqual(14)
  await expect(page.getByRole('group', { name: 'Vues enregistrées' }).getByRole('button', { name: /^Tous/ })).toHaveAttribute('aria-pressed', 'true')
  await tableau.getByRole('row').filter({ hasText: M }).getByRole('cell').nth(5).click()
  const apercu = page.getByRole('complementary', { name: `Aperçu de ${M}` })
  await expect(apercu).toBeVisible()
  await expect(apercu.getByRole('button', { name: 'Ouvrir la fiche' })).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-refonte-magasins.png` })
  await page.getByRole('group', { name: 'Vues enregistrées' }).getByRole('button', { name: /^Visite en retard/ }).click()
  await expect(page).toHaveURL(/alerte=visite/)
  await apercu.getByRole('button', { name: 'Ouvrir la fiche' }).click()
  await expect(page).toHaveURL(new RegExp(`/magasins/${encodeURIComponent(M)}`))
})

test('accueil : période en tête, actualités visibles dès l’arrivée sur PC ; style de la charte gardé sur l’accueil seulement', async ({ page, isMobile }, info) => {
  await connecter(page)
  const ca = page.getByRole('link', { name: /^CA de / })
  await expect(ca).toContainText('k€')
  await expect(ca).toContainText('vs N-1')
  await page.getByRole('group', { name: 'Période des chiffres' }).getByRole('button', { name: 'Cumul' }).click()
  await expect(page.getByRole('link', { name: /^CA cumulé à fin / })).toBeVisible()
  if (!isMobile) {
    const actualites = page.getByRole('complementary', { name: 'Actualités du réseau' })
    const b = (await actualites.boundingBox())!
    expect(b.y).toBeLessThan(page.viewportSize()!.height / 2)
  }
  // Accueil : titre en capitales (écran « marque ») ; Magasins : casse normale
  const casse = () => page.getByRole('heading', { level: 1 }).first().evaluate((e) => getComputedStyle(e).textTransform)
  expect(await casse()).toBe('uppercase')
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-refonte-accueil.png` })
  await page.goto('./#/magasins')
  await expect(page.getByRole('heading', { level: 1, name: 'Magasins' })).toBeVisible()
  expect(await casse()).toBe('none')
  // Fiche : titre de section sobre, sans cartouche noir
  await page.goto(fiche())
  const fond = await page.getByRole('heading', { name: 'Équipe', exact: true }).evaluate((e) => getComputedStyle(e).backgroundColor)
  expect(fond).toBe('rgba(0, 0, 0, 0)')
})
