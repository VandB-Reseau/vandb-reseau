import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from '../donnees-fictives'
import { allerVers, ongletEspace, ouvrir, ouvrirSection, partieAffichee, partiesAffichees, saisiesAffichees, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './outils'

// Lot 36 (Joseph, 02/11/2026) : trois espaces séparés, Données (ce qui entre), Budget (de l'atterrissage de l'année en
// cours aux hypothèses de l'an prochain), Suivi (réel face au budget). Chaque partie a son adresse. Données fictives.
const propose: MagasinSimule = { magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('Chiffres et Budget : le magasin ouvert reste le même, chaque espace a ses pages', async ({ page, isMobile }, info) => {
  await seConnecter(page, { magasins: [propose] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page).toHaveURL(/[?&]partie=synthese$/)

  await ouvrir(page, 'Point de départ')
  await expect(page).toHaveURL(new RegExp(`/magasins/${encodeURIComponent(MAGASINS[0])}\\?vue=budget&partie=depart$`))
  await expect(partiesAffichees(page)).toHaveCount(3)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-espace-budget.png`, fullPage: true })

  await ouvrir(page, 'Réel')
  await expect(page.getByRole('heading', { level: 1, name: MAGASINS[0] })).toBeVisible()
  await expect(saisiesAffichees(page)).toHaveText([/^Réel du mois/, /^Stock de fin de mois/, /^Comptes du quadrimestre/, /^Frais/])
  await page.screenshot({ path: `captures/${info.project.name}-espace-donnees.png`, fullPage: true })

  await page.getByRole('tablist', { name: 'Parties des chiffres' }).getByRole('tab', { name: 'Vue d’ensemble' }).click()
  // Refonte (09/11/2026) : sous l'onglet Chiffres de la fiche, une seule rangée de puces (suivi, santé, saisies)
  await expect(page.getByRole('navigation', { name: 'Pages du magasin' }).getByRole('tablist')).toHaveCount(1)
  await expect(page).toHaveURL(/[?&]partie=synthese$/)
})

test('une adresse rouverte affiche la même partie ; un ancien lien est redirigé', async ({ page }) => {
  await seConnecter(page, { magasins: [propose] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Équipe')
  await expect(page).toHaveURL(/[?&]partie=equipe$/)
  await page.reload()
  await partieAffichee(page, /^1 · Construire/)
  await expect(page.getByRole('heading', { level: 2, name: /^Équipe \d{4}/ })).toBeVisible()
  // Adresse de l'onglet Budget sans partie : la première étape du budget ; celle de l'onglet Chiffres : la synthèse
  await page.goto(`./#/magasins/${encodeURIComponent(MAGASINS[0])}?vue=budget`)
  await expect(page).toHaveURL(/[?&]partie=budget$/)
  await page.goto(`./#/magasins/${encodeURIComponent(MAGASINS[0])}?vue=chiffres`)
  await expect(page).toHaveURL(/[?&]partie=synthese$/)
})

test('d’une étape du budget à l’autre, les ajustements en cours restent sans question ; quitter le budget demande confirmation', async ({ page, isMobile }) => {
  await seConnecter(page, { role: 'franchise', magasins: [propose] })
  await ouvrir(page, 'Hypothèses')
  await page.getByLabel('Évolution du nombre de tickets : Cave').fill('5')
  const barre = page.getByRole('complementary', { name: 'Impact des changements' })
  await expect(barre).toContainText('1 changement')
  await ouvrir(page, 'Résultat et trésorerie')
  await expect(page).toHaveURL(/[?&]partie=visualiser$/)
  const garde = page.getByRole('dialog', { name: 'Modifications non enregistrées' })
  await expect(garde).toHaveCount(0)
  // À l'étape Visualiser, pas de panneau Impact : la barre d'enregistrement garde le changement
  await expect(page.getByRole('region', { name: 'Changements non enregistrés' })).toContainText('1 changement')
  // Vers l'espace Suivi : la garde demande confirmation, puis les ajustements non enregistrés sont abandonnés
  await ongletEspace(page, 'Suivi').click()
  await expect(garde).toBeVisible()
  await garde.getByRole('button', { name: 'Quitter sans enregistrer' }).click()
  await expect(page).toHaveURL(/[?&]partie=synthese$/)
  await ouvrir(page, 'Hypothèses')
  await expect(page.getByLabel('Évolution du nombre de tickets : Cave')).toHaveValue('')
})

test('téléphone : les trois espaces en onglets de la fiche', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'téléphone seulement')
  await seConnecter(page, { magasins: [propose] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page.getByRole('navigation', { name: 'Pages du magasin' }).getByRole('tablist', { name: 'Espaces du magasin' }).getByRole('tab')).toHaveText([/^Suivi \d{4}/, /^Budget \d{4}/, /^Saisies/])
  await expect(page.getByRole('navigation', { name: 'Espaces du pilotage' })).toHaveCount(0)
  expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-espaces.png` })
  await ouvrirSection(page, /^Trésorerie$/)
  await expect(page).toHaveURL(/[?&]partie=comptes$/)
  await allerVers(page, 'Suivi ')
  await expect(page.getByRole('heading', { level: 1, name: /^Suivi \d{4}$/ })).toBeVisible()
})
