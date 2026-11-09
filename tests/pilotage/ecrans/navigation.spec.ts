import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from '../donnees-fictives'
import { allerVers, ongletEspace, ouvrir, ouvrirSection, partiesAffichees, saisiesAffichees, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule, partieAffichee } from './outils'

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

// Refonte (Joseph, 09/11/2026, 3A) : dans la fiche de l'app réseau, l'onglet Chiffres (suivi, santé, saisies en puces)
// et l'onglet Budget (étapes en frise) ; deux niveaux au plus, les saisies en bascule
test('fiche : onglets Chiffres et Budget de l’app réseau, suivi et saisies en puces', async ({ page, isMobile }, info) => {
  const autre: MagasinSimule = { ...propose, magasin: MAGASINS[1] }
  await seConnecter(page, { magasins: [propose, autre] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page).toHaveURL(/[?&]partie=synthese$/)
  const pages = page.getByRole('navigation', { name: 'Pages du magasin' })
  await expect(pages.getByRole('tablist', { name: 'Espaces du magasin' })).toHaveCount(0)
  await expect(ongletEspace(page, 'Suivi')).toHaveAttribute('aria-selected', 'true')
  await expect(partiesAffichees(page)).toHaveText(['Vue d’ensemble', 'Mois par mois', 'Comptes et trésorerie', `Atterrissage ${annee}`, 'Stock', 'Analyse', /^Santé et leviers/, /^Saisies/])
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
  await ouvrir(page, 'Réel')
  await expect(page).toHaveURL(/[?&]partie=reel$/)
  await expect(saisiesAffichees(page)).toHaveText([/^Réel du mois/, /^Stock de fin de mois/, /^Comptes du quadrimestre/, /^Frais \d{4}/])
  await saisiesAffichees(page).filter({ hasText: /^Stock de fin de mois/ }).click()
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

