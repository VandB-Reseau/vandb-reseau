import { expect, test, type Page } from '@playwright/test'
import { COMPTE, simulerSupabase, textesTropPetits } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type PersonneSimulee } from './supabase-simule'

// Budget prévisionnel (Joseph, 10/11/2026) : les tableaux des thèmes (ventes, frais, investissements, équipe) tiennent
// dans la page sans défiler vers la droite ; chaque carte de « Construire » s'ouvre de la même façon, sur toute la largeur,
// l'Impact en bande en haut ; les budgets ont leur entrée « Budget prévisionnel » dans le menu. Données fictives uniquement.

const M = 'Annecy Test'
const ajustements = {
  evolutionFlux: { cave: 0.02 },
  investissements: [{ libelle: 'Tireuse 6 becs', type: 'equipement', montant: 9_300, mois: 9, duree: 5 }],
  emprunts: [{ libelle: 'Prêt bancaire travaux', montant: 40_000, taux: 0.04, duree: 7, premiereEcheance: 2 }],
  apport: { montant: 5_000, mois: 3 },
}
const magasins = [{ magasin: M, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements, maj_le: '2026-10-20T09:30:00Z' }] as unknown as MagasinSimule[]
const equipe: PersonneSimulee[] = [
  { id: 1, store_name: M, poste: 'Vendeur 1', categorie: 'employe', heures_hebdo: 35, brut_mensuel: 1823.03, primes: [], entree: null, sortie: null },
  { id: 2, store_name: M, poste: 'Gérant', categorie: 'gerant_tns', heures_hebdo: 45, brut_mensuel: 3000, primes: [], entree: null, sortie: null },
]

async function connecter(page: Page, parametres?: Record<string, unknown>) {
  await simulerSupabase(page, {})
  await simulerPilotage(page, { magasins, equipe, ...(parametres ? { parametres } : {}) })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
}
// Ce qui défile vers la droite dans la page (tableau plus large que sa carte, ou la page elle-même)
// Sur téléphone, seuls les grands tableaux défilent dans leur carte (choix du téléphone soigné) : la page, jamais
const debordements = (page: Page, telephone: boolean) => page.evaluate((telephone) => {
  const trop = telephone ? [] : [...document.querySelectorAll('main *')].filter((e) => e.scrollWidth > e.clientWidth + 2 && !['visible', 'hidden', 'clip'].includes(getComputedStyle(e).overflowX))
    .map((e) => (e.querySelector('table')?.getAttribute('aria-label') ?? e.getAttribute('aria-label') ?? e.tagName))
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) trop.push('page')
  return trop
}, telephone)

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

const THEMES = [
  { carte: /^Ventes Cave : /, titre: 'Ventes et marge 2027' },
  { carte: /^Frais : /, titre: 'Frais 2027' },
  { carte: /^Investissements & Financements : /, titre: 'Investissements & Financements 2027' },
  { carte: /^Équipe : /, titre: 'Équipe 2027' },
]

test('chaque carte s’ouvre sur toute la largeur, l’Impact en haut, sans défiler vers la droite', async ({ page, isMobile }, info) => {
  if (!isMobile) await page.setViewportSize({ width: 1280, height: 860 })
  await connecter(page)
  for (const t of THEMES) {
    await page.goto(`./#/magasins/${encodeURIComponent(M)}?vue=budget&partie=budget`)
    const cartes = page.getByRole('region', { name: 'Hypothèses 2027 en cartes' })
    await cartes.getByRole('link', { name: t.carte }).first().click()
    // Même ouverture pour tous les thèmes, Équipe comprise : titre, retour aux cartes, cartes masquées
    await expect(page.getByRole('heading', { name: t.titre, exact: true }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Toutes les hypothèses' })).toBeVisible()
    await expect(cartes).toHaveCount(0)
    await expect(page.getByRole('region', { name: /^Détail : / })).toHaveCount(0)
    const impact = page.getByRole('complementary', { name: 'Impact des changements' })
    await expect(impact).toBeVisible()
    if (!isMobile) {
      // L'Impact est une bande au-dessus du détail, de toute la largeur : rien à sa droite ni à sa gauche
      const [b, contenu] = await Promise.all([impact.boundingBox(), page.locator('main').boundingBox()])
      expect(b!.width).toBeGreaterThan(contenu!.width * 0.75)
      await expect(impact.locator('[data-impact]')).toHaveCount(6)
    }
    expect(await debordements(page, !!isMobile), `${t.titre} : rien ne défile vers la droite`).toEqual([])
    expect(await textesTropPetits(page)).toEqual([])
    if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
    await page.screenshot({ path: `captures/${info.project.name}-pleine-largeur-${t.titre.split(' ')[0].toLowerCase()}.png`, fullPage: true })
  }
})

test('PC : le bouton « reprendre » ne recouvre plus la valeur de l’an prochain', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Colonnes du tableau des hypothèses sur PC')
  await page.setViewportSize({ width: 1280, height: 860 })
  await connecter(page)
  await page.goto(`./#/magasins/${encodeURIComponent(M)}?vue=budget&partie=ventes`)
  const reprendre = page.getByRole('button', { name: /^Reprendre la valeur du niveau au-dessus : .*tickets/i }).first()
  await expect(reprendre).toBeVisible()
  const ligne = page.getByRole('row').filter({ has: reprendre })
  const [bouton, valeur] = await Promise.all([reprendre.boundingBox(), ligne.getByRole('cell').nth(2).boundingBox()])
  expect(bouton!.x + bouton!.width).toBeLessThanOrEqual(valeur!.x + 1)
})

test('le budget prévisionnel a son entrée dans le menu, à côté de Chiffres', async ({ page, isMobile }) => {
  await connecter(page)
  if (!isMobile) {
    const nav = page.getByRole('navigation', { name: 'Navigation principale' })
    await expect(nav.getByRole('button')).toHaveText(['Accueil', 'Tâches', 'Messages', 'Agenda', 'Magasins', 'Visites', 'Chiffres', 'Budget prévisionnel', 'Simulateurs', 'Actualités', 'Campagnes', 'Demandes'].map((t) => new RegExp(`^${t}`)))
    await nav.getByRole('button', { name: /^Budget prévisionnel/ }).click()
    await expect(page).toHaveURL(/#\/budgets$/)
    await expect(page.getByRole('heading', { level: 1, name: /^(Budget prévisionnel|Mon budget)$/ })).toBeVisible()
    await expect(nav.getByRole('button', { name: /^Budget prévisionnel/ })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('button', { name: /^Chiffres/ })).not.toHaveAttribute('aria-current', 'page')
    // Chiffres n'a plus d'onglet des budgets ; l'ancienne adresse mène au Budget prévisionnel
    await page.goto('./#/performance')
    await expect(page.getByRole('heading', { level: 1, name: 'Chiffres' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Budgets de l’année' })).toHaveCount(0)
    await page.goto('./#/performance?vue=budgets')
    await expect(page).toHaveURL(/#\/budgets$/)
  } else {
    await page.getByRole('button', { name: 'Mon compte' }).click()
    await page.getByRole('menuitem', { name: /Budget prévisionnel/ }).click()
    await expect(page).toHaveURL(/#\/budgets$/)
    await expect(page.getByRole('heading', { level: 1, name: /^(Budget prévisionnel|Mon budget)$/ })).toBeVisible()
  }
})

test('budget communication : préconisation du siège réglable en % du CA ou en montant, et retour à la préconisation', async ({ page, isMobile }) => {
  await connecter(page, { tauxRedevance: 0.02, tauxPublicite: 0.01, tauxCommunication: 0.025 })
  await page.goto(`./#/magasins/${encodeURIComponent(M)}?vue=budget&partie=fraisBudget`)
  const tableau = page.getByRole('table', { name: 'Frais 2027 par thème' })
  const ligne = tableau.getByRole('row').filter({ hasText: 'Budget communication annuel' })
  await expect(ligne).toContainText('préconisation du siège')
  await expect(ligne.getByRole('button', { name: '% du CA' })).toHaveAttribute('aria-pressed', 'true')
  await expect(ligne.getByRole('textbox', { name: 'Part du CA 2027 : Budget communication annuel' })).toHaveValue('2,5')
  // 1,5 % du CA : choix du magasin
  await ligne.getByRole('textbox', { name: 'Part du CA 2027 : Budget communication annuel' }).fill('1,5')
  await expect(ligne).toContainText('1,5 % du CA')
  await expect(ligne).not.toContainText('préconisation du siège')
  // En montant : 4 000 €
  await ligne.getByRole('button', { name: 'Montant' }).click()
  await ligne.getByRole('textbox', { name: 'Montant 2027 : Budget communication annuel' }).fill('4000')
  await expect(ligne.getByRole('cell').last()).toHaveText(/4\s?000\s€/)
  // Retour à la préconisation du siège
  await ligne.getByRole('button', { name: 'Reprendre la préconisation du siège : Budget communication annuel' }).click()
  await expect(ligne).toContainText('préconisation du siège')
  await expect(ligne.getByRole('cell').last()).toHaveText('2,5 % du CA')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})
