import { expect, test } from '@playwright/test'
import { calculerBudget } from '../../../src/pilotage/moteur/budget'
import { joursHorsDimanche } from '../../../src/pilotage/moteur/objectifs'
import { parametresParDefaut } from '../../../src/pilotage/moteur/parametres'
import { magasinFictif, MAGASINS } from '../donnees-fictives'
import { ouvrir, partieAffichee, plusLoin, seConnecter, textesTropPetits, zonesTropPetites, type VenteSimulee } from './outils'

// Lot 30 : fiche en 6 onglets, synthèse en 3 blocs, objectifs du mois pour l'équipe. Données fictives : dépôt public.
const N = new Date().getFullYear()
const M = new Date().getMonth() + 1
const k = Math.max(1, M - 1)
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const reel: VenteSimulee[] = Array.from({ length: k }, (_, i) => ({ store_name: MAGASINS[0], mois: mois(N, i + 1), univers: 'cave', famille: 'Bière', ca_ht: 20_000, ca_ttc: 24_000, marge_ht: 8_000 }))
const unMagasin = [{ magasin: MAGASINS[0], statut: 'valide' as const, hypotheses: magasinFictif, maj_le: null }]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('fiche (lot 36) : le réel et les quadrimestres dans Données, l’atterrissage dans le Suivi, chacun à son adresse', async ({ page }) => {
  await seConnecter(page, { reel })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Réel')
  await expect(page).toHaveURL(/[?&]partie=reel$/)
  await expect(page.getByRole('heading', { name: 'Quadrimestres comptables' })).toHaveCount(0)
  await ouvrir(page, 'Quadrimestres')
  await expect(page).toHaveURL(/[?&]partie=quadrimestres$/)
  await expect(page.getByRole('heading', { name: 'Quadrimestres comptables' })).toBeVisible()
  // Le Suivi en puces (09/11/2026) : l'atterrissage a la sienne, à son adresse
  await page.goto(`./#/magasins/${encodeURIComponent(MAGASINS[0])}?vue=budget&partie=atterrissage`)
  await partieAffichee(page, /^Atterrissage \d{4}/)
})

test('synthèse en 3 blocs : les chiffres, quoi faire, et le détail dans l’analyse', async ({ page, isMobile }, info) => {
  await seConnecter(page, { reel })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page.getByRole('region', { name: /^Santé du magasin/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Leviers commerciaux' })).toHaveCount(0)
  // Le détail (graphique, leviers, face au réseau) a sa puce « Analyse » depuis le 09/11/2026
  await expect(page.getByRole('navigation', { name: 'Pages du magasin' }).getByRole('tab', { name: 'Analyse' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-synthese-3-blocs.png`, fullPage: true })
  await plusLoin(page)
  await expect(page.getByRole('region', { name: 'Leviers commerciaux' })).toBeVisible()
})

test('objectifs du mois : clients par jour et panier visés pour la Cave, à imprimer pour l’équipe', async ({ page, isMobile }, info) => {
  // Défi de l'équipe (choix 130) : la vente additionnelle gardée dans les simulateurs
  const defi = { id: 3, store_name: MAGASINS[0], type: 'vente_additionnelle', nom: 'Un apéritif de plus', donnees: { univers: 'cave', unSur: 10, prix: 12, marge: null },
    resume: '', auteur: 'autre', auteur_role: 'coach', auteur_nom: 'Camille TESTARD', cree_le: '2026-10-20T08:00:00Z' }
  await seConnecter(page, { role: 'franchise', magasins: unMagasin, reel, simulations: [defi] })
  await page.getByRole('button', { name: 'Objectifs du mois' }).click()
  const fiche = page.getByRole('dialog', { name: /^Objectifs de/ })
  // CA Cave du budget du mois × (1 + TVA) ÷ panier visé 24 € ÷ jours hors dimanches
  const b = calculerBudget(magasinFictif, parametresParDefaut)
  const jours = joursHorsDimanche(N, M)
  const clients = Math.round(b.mois[M - 1].univers!.cave.ca * (1 + parametresParDefaut.tvaPanier.cave) / 24 / jours)
  await expect(fiche.getByLabel('Jours d’ouverture')).toHaveValue(String(jours))
  const tableau = fiche.getByRole('table')
  await expect(tableau.getByRole('columnheader')).toHaveText(['', 'Cave'])
  await expect(tableau.getByRole('row', { name: /^Clients par jour/ })).toContainText(clients.toLocaleString('fr-FR'))
  await expect(tableau.getByRole('row', { name: /^Panier moyen TTC/ })).toContainText(/24,00\s€/)
  await expect(fiche.getByRole('list', { name: 'Un euro de plus par client' })).toContainText('Cave : +')
  const parJour = Math.round(b.mois[M - 1].univers!.cave.ca * (1 + parametresParDefaut.tvaPanier.cave) / 24 / jours / 10)
  await expect(fiche.getByRole('region', { name: 'Défi de l’équipe' })).toContainText(`Défi de l’équipe : Un apéritif de plus${parJour} par jour en Cave`)
  await expect(fiche.getByRole('region', { name: 'Défi de l’équipe' })).toContainText('pour 1 client sur 10')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-objectifs-mois.png` })
  // Un jour d'ouverture de moins : plus de clients par jour
  await fiche.getByLabel('Jours d’ouverture').fill(String(jours - 1))
  const plus = Math.round(b.mois[M - 1].univers!.cave.ca * (1 + parametresParDefaut.tvaPanier.cave) / 24 / (jours - 1))
  await expect(tableau.getByRole('row', { name: /^Clients par jour/ })).toContainText(plus.toLocaleString('fr-FR'))
  await fiche.getByRole('button', { name: 'Fermer' }).click()
  await expect(fiche).toHaveCount(0)
})
