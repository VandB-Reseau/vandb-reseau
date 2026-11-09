import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from '../donnees-fictives'
import { allerVers, ongletEspace, ouvrir, ouvrirSection, partiesAffichees, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule, partieAffichee } from './outils'

// Option A de la maquette de navigation (Joseph, 03/11/2026) : la fiche du magasin a trois onglets, « Suivi <année> »
// (une seule page, atterrissage, trésorerie et stock en sections repliées), « Budget <année suivante> » (les étapes en
// frise) et « Saisies » ; un fil d'Ariane remplace le retour et « Changer de magasin » ; le menu liste ce qui porte sur
// tout le réseau, les réglages sous « Paramètres ». Données fictives.
const propose: MagasinSimule = { magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }
const annee = new Date().getFullYear()

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('fiche : trois onglets Suivi, Budget, Saisies ; dans la fiche de l’app réseau', async ({ page, isMobile }, info) => {
  const autre: MagasinSimule = { ...propose, magasin: MAGASINS[1] }
  await seConnecter(page, { magasins: [propose, autre] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page).toHaveURL(/[?&]partie=synthese$/)
  const pages = page.getByRole('navigation', { name: 'Pages du magasin' })
  await expect(pages.getByRole('tablist', { name: 'Espaces du magasin' }).getByRole('tab')).toHaveText([new RegExp(`^Suivi ${annee}`), new RegExp(`^Budget ${annee + 1}`), /^Saisies/])
  // Le Suivi en puces (09/11/2026)
  await expect(partiesAffichees(page)).toHaveText(['Vue d’ensemble', 'Mois par mois', 'Comptes et trésorerie', `Atterrissage ${annee}`, 'Stock', 'Analyse'])
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-navigation-suivi.png`, fullPage: true })

  // Budget : les étapes en frise, chacune avec son état
  await ouvrir(page, 'Construire')
  const frise = pages.getByRole('tablist', { name: `Étapes du budget ${annee + 1}` })
  await expect(frise.getByRole('tab')).toHaveText([/^1 · Construire/, /^2 · Visualiser/, /^3 · Envoyer et valider/])
  await expect(frise.getByRole('tab', { name: /^1 · Construire/ })).toHaveAttribute('aria-current', 'step')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-navigation-budget.png` })

  // Saisies : le réel du mois, le stock, les comptes du quadrimestre, les frais
  await ongletEspace(page, 'Saisies').click()
  await expect(page).toHaveURL(/[?&]partie=reel$/)
  await expect(partiesAffichees(page)).toHaveText([/^Réel du mois/, /^Stock de fin de mois/, /^Comptes du quadrimestre/, /^Frais \d{4}/])
  await partiesAffichees(page).filter({ hasText: /^Stock de fin de mois/ }).click()
  await expect(page).toHaveURL(/[?&]partie=saisieStock$/)
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-navigation-saisies.png` })
})

test('les anciennes adresses de l’atterrissage et de la trésorerie ouvrent leur puce du Suivi', async ({ page }) => {
  await seConnecter(page, { magasins: [propose] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.goto(`./#/magasins/${encodeURIComponent(MAGASINS[0])}?vue=budget&partie=tresorerie`)
  await expect(page).toHaveURL(/[?&]partie=comptes$/)
  await expect(page.getByRole('heading', { name: 'Trésorerie', exact: true })).toBeVisible()
  await page.goto(`./#/magasins/${encodeURIComponent(MAGASINS[0])}?vue=budget&partie=atterrissage`)
  await partieAffichee(page, new RegExp(`^Atterrissage ${annee}`))
})

