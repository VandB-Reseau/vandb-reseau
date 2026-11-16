import { expect, test, type Page } from '@playwright/test'
import { COMPTE, simulerSupabase, textesTropPetits, type OptionsSimulation } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type SimulationSimulee } from './supabase-simule'

// Simulateurs plus fluides (choix 188 à 192 et 195, Joseph 15/11/2026) : familles et derniers utilisés, résultat
// toujours en vue, brouillon gardé, chiffres de la caisse et leur source, comparaison, boutons − et + sur téléphone.
// Données fictives : Annecy Test vend 80 000 € par mois, 70 % en cave à 40 € HT le panier (1 400 tickets par mois).
const NOM = 'Annecy Test'
const magasins: MagasinSimule[] = [{ magasin: NOM, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }]
const coach: OptionsSimulation = { appMetadata: { role: 'coach', coach: 'Hugo FICTIF' } }
const franchise: OptionsSimulation = { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: [NOM] } }
const gardee = (id: number, nom: string, resume: string, ebe: string): SimulationSimulee => ({
  id, store_name: NOM, type: 'vente_additionnelle', nom, resume, auteur: 'autre', auteur_role: 'franchise', auteur_nom: 'Paul MULTI', cree_le: `2026-10-2${id}T08:00:00Z`,
  donnees: { univers: 'cave', unSur: 10, prix: 12, marge: null, _indicateurs: [{ libelle: 'Articles en plus', valeur: '1 680' }, { libelle: 'EBE en plus', valeur: ebe }] },
})

async function connecter(page: Page, reseau: OptionsSimulation, role: 'coach' | 'franchise', simulations: SimulationSimulee[] = []) {
  await simulerSupabase(page, reseau)
  await simulerPilotage(page, { magasins, role, simulations })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
}
const choix = (page: Page) => page.getByRole('navigation', { name: 'Choisir un simulateur' })

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('188-191 et 195 : familles, derniers utilisés, caisse, résultat en vue, brouillon gardé', async ({ page, isMobile }) => {
  await connecter(page, coach, 'coach')
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=simulateurs`)
  // 188 : 14 simulateurs en 4 familles, aucun « dernier utilisé » au départ
  for (const f of ['Vendre plus', 'Événements et extérieur', 'Équipe', 'Investir et trésorerie']) await expect(choix(page).getByRole('region', { name: f })).toBeVisible()
  await expect(choix(page).getByRole('button')).toHaveCount(14)
  await expect(page.getByRole('navigation', { name: 'Derniers simulateurs utilisés' })).toHaveCount(0)
  await choix(page).getByRole('button', { name: 'Vente additionnelle' }).click()
  await expect(page.getByRole('heading', { name: 'Vente additionnelle' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Derniers simulateurs utilisés' }).getByRole('button')).toHaveText(['Vente additionnelle'])

  // 191 : tickets de la caisse (octobre 2025 à septembre 2026) : 1 400 × 12 = 16 800 tickets ; 1 client sur 10 → 1 680 articles
  await expect(page.getByRole('button', { name: 'Caisse, 12 derniers mois' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('De octobre 2025 à septembre 2026')).toBeVisible()
  const statut = page.locator('#carte-simulation').getByRole('status')
  await expect(statut).toContainText(/1\s680 articles par an/)
  await expect(page.locator('.source-chiffre', { hasText: 'budget' })).toBeVisible()
  // 189 : le résultat colle (en haut de la carte sur PC, en bas de l'écran sur téléphone)
  expect(await statut.evaluate((e) => getComputedStyle(e).position)).toBe('sticky')
  // Le budget comme base : la phrase change
  await page.getByRole('button', { name: /^Budget 20/ }).click()
  await expect(statut).not.toContainText(/1\s680 articles par an/)
  await page.getByRole('button', { name: 'Caisse, 12 derniers mois' }).click()

  // 195 : sur téléphone, « + » sans clavier ; 190 : le brouillon survit au rechargement
  const unSur = page.getByRole('textbox', { name: 'Un client sur' })
  if (isMobile) {
    await page.getByRole('button', { name: 'Augmenter' }).first().click()
    await expect(unSur).toHaveValue('11')
  } else {
    await expect(page.getByRole('button', { name: 'Augmenter' }).first()).toBeHidden()
    await unSur.fill('11')
  }
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Vente additionnelle' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Un client sur' })).toHaveValue('11')
  await expect(page.getByRole('navigation', { name: 'Derniers simulateurs utilisés' }).getByRole('button')).toHaveText(['Vente additionnelle'])
  await page.getByRole('button', { name: 'Revenir à l’exemple' }).click()
  await expect(page.getByRole('textbox', { name: 'Un client sur' })).toHaveValue('10')
  await expect(page.getByRole('button', { name: 'Revenir à l’exemple' })).toHaveCount(0)
})

// Exemple prérempli et « Effacer » (Joseph, 15/11/2026) : chaque simulateur s'ouvre sur un exemple chiffré, un appui vide
// les saisies sans jamais afficher de calcul impossible, un autre remet l'exemple
test('Chaque simulateur : un exemple, Effacer, Revenir à l’exemple', async ({ page }) => {
  await connecter(page, coach, 'coach')
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=simulateurs`)
  const carte = page.locator('#carte-simulation')
  const titres = ['Mon meilleur levier', 'Embaucher', 'Promo, prix, remises', 'Coup dur de trésorerie', 'Vente additionnelle', 'Reste à faire du mois', 'Soirée, dégustation',
    'Acheter en volume', 'Investir', 'Contrat extérieur', 'Parc de tireuses', 'Ma carte pression', 'Prix et marge', 'Dimanche ou jour férié']
  await expect(choix(page).getByRole('button')).toHaveCount(titres.length)
  for (const titre of titres) {
    await choix(page).getByRole('button', { name: titre, exact: true }).click()
    await expect(page.getByRole('heading', { name: titre, exact: true })).toBeVisible()
    // Le reste à faire suit le budget du mois en cours : le budget 2027 du magasin fictif n'a pas encore commencé
    if (titre === 'Reste à faire du mois') { await expect(carte.getByText('Disponible en 2027')).toBeVisible(); await expect(carte.getByRole('button', { name: 'Effacer' })).toHaveCount(0); continue }
    await expect(carte.getByText('Exemple', { exact: true }), titre).toBeVisible()
    await expect(carte.getByRole('status'), titre).toBeVisible()
    await carte.getByRole('button', { name: 'Effacer' }).click()
    await expect(carte.getByText('Exemple', { exact: true })).toHaveCount(0)
    await expect(carte.getByRole('button', { name: 'Revenir à l’exemple' })).toBeVisible()
    expect(await carte.innerText(), titre).not.toMatch(/NaN|Infinity|undefined|∞/)
  }
  // Le vide survit au rechargement (brouillon), l'exemple revient d'un appui
  await page.reload()
  await choix(page).getByRole('button', { name: 'Promo, prix, remises', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Remise' })).toHaveValue('0')
  await carte.getByRole('button', { name: 'Revenir à l’exemple' }).click()
  await expect(page.getByRole('textbox', { name: 'Remise' })).toHaveValue('10')
  await expect(carte.getByText('Exemple', { exact: true })).toBeVisible()
})

test('192 : deux simulations gardées comparées côte à côte', async ({ page, isMobile }) => {
  await connecter(page, franchise, 'franchise', [gardee(1, 'Bouteille à 12 €', 'Un article à 12 € vendu à 1 client sur 10.', '3 100 €'), gardee(2, 'Coffret à 25 €', 'Un article à 25 € vendu à 1 client sur 20.', '4 200 €')])
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=simulateurs&sim=vente_additionnelle`)
  const liste = page.getByRole('region', { name: 'Simulations gardées' })
  await expect(page.getByRole('region', { name: 'Comparaison des simulations' })).toHaveCount(0)
  await liste.getByRole('checkbox', { name: 'Comparer Bouteille à 12 €' }).check()
  await liste.getByRole('checkbox', { name: 'Comparer Coffret à 25 €' }).check()
  const t = page.getByRole('table', { name: 'Simulations comparées' })
  await expect(t.getByRole('columnheader')).toHaveText(['', 'Bouteille à 12 €', 'Coffret à 25 €'])
  await expect(t.getByRole('row', { name: /EBE en plus/ })).toContainText('3 100 €4 200 €')
  await expect(t.getByRole('row', { name: /^Résultat/ })).toContainText('1 client sur 20')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  // La simulation gardée enregistre ses chiffres clés pour être comparée plus tard
  await liste.getByRole('checkbox', { name: 'Comparer Coffret à 25 €' }).uncheck()
  await expect(page.getByRole('region', { name: 'Comparaison des simulations' })).toHaveCount(0)
})
