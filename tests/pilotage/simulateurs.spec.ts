import { expect, test, type Page } from '@playwright/test'
import { COMPTE, simulerSupabase, textesTropPetits, type OptionsSimulation } from '../supabase-simule'
import { magasinFictif } from './donnees-fictives'
import { simulerPilotage, zonesTropPetites, type MagasinSimule, type OptionsSimulation as OptionsPilotage, type SimulationSimulee } from './supabase-simule'

// Simulateurs du franchisé (choix 125 à 135, Joseph 13/11/2026). Données fictives uniquement.
const NOM = 'Annecy Test'
const magasins: MagasinSimule[] = [{ magasin: NOM, statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }]
const gardee: SimulationSimulee = {
  id: 7, store_name: NOM, type: 'achat', nom: 'Précommande de Noël', donnees: { montant: 20_000, remise: 0.12, mois: 3, invendu: 0, taux: 0.06 },
  resume: 'Achat de 20 000 € à 12 % de remise : gain de 2 220 €.', auteur: 'autre', auteur_role: 'franchise', auteur_nom: 'Paul MULTI', cree_le: '2026-10-25T08:00:00Z',
}
const franchise: OptionsSimulation = { acces: { role: 'franchise', franchise: 'Paul MULTI', magasins: [NOM] } }

async function connecter(page: Page, reseau: OptionsSimulation, pilotage: OptionsPilotage) {
  await simulerSupabase(page, reseau)
  const ecritures = await simulerPilotage(page, { magasins, ...pilotage })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  return ecritures
}
const simulateurs = (page: Page) => page.getByRole('navigation', { name: 'Choisir un simulateur' })

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('franchisé : le menu ouvre les simulateurs de son magasin ; embauche chiffrée, gardée', async ({ page, isMobile }, info) => {
  const ecritures = await connecter(page, franchise, { role: 'franchise', simulations: [gardee] })
  if (isMobile) {
    await page.getByRole('button', { name: /Plus/ }).last().click()
    await page.getByRole('menuitem', { name: /Simulateurs/ }).or(page.getByRole('link', { name: /Simulateurs/ })).first().click()
  } else {
    await page.getByRole('navigation').getByRole('button', { name: 'Simulateurs' }).first().click()
  }
  await expect(page).toHaveURL(/magasins\/Annecy%20Test\?vue=simulateurs/)
  await expect(simulateurs(page).getByRole('button')).toHaveCount(19)
  // 183 : « Mon meilleur levier » s'ouvre d'office ; puis l'embauche d'un vendeur en janvier : coût, EBE, % de frais de personnel, trésorerie, CA nécessaire
  await expect(page.getByRole('heading', { name: 'Mon meilleur levier' })).toBeVisible()
  await simulateurs(page).getByRole('button', { name: /^Embaucher/ }).click()
  await expect(page.getByRole('heading', { name: 'Embaucher' })).toBeVisible()
  await page.getByLabel('Salaire brut mensuel').fill('2000')
  await expect(page.getByText('Coût en 2027')).toBeVisible()
  await expect(page.getByText('CA HT en plus pour le payer')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Embauche Vendeur 35 h en janvier : coûte')
  // Simulation gardée par le franchisé avant : son résultat, et « Rouvrir » reprend ses chiffres
  const liste = page.getByRole('region', { name: 'Simulations gardées' })
  await expect(liste).toContainText('Précommande de Noël')
  await expect(liste).toContainText('Acheter en volume · Paul MULTI')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-simulateurs-embauche.png`, fullPage: true })

  await page.getByLabel('Nom de la simulation').fill('Vendeur pour Noël')
  await page.getByRole('button', { name: 'Garder', exact: true }).click()
  await expect(page.getByText('Simulation gardée.')).toBeVisible()
  const ecrite = ecritures.find((e) => e.table === 'simulations' && e.methode === 'POST')?.corps as Record<string, unknown>
  expect(ecrite).toMatchObject({ store_name: NOM, type: 'embauche', nom: 'Vendeur pour Noël', donnees: { mouvement: 'embauche', brut: 2_000, heures: 35 } })
  expect(String(ecrite.resume)).toMatch(/^Embauche Vendeur 35 h en janvier : coûte/)
  // 192 : ses chiffres clés partent avec elle, pour la comparer plus tard
  expect((ecrite.donnees as { _indicateurs: { libelle: string }[] })._indicateurs.map((x) => x.libelle)).toContain('CA HT en plus pour le payer')
  await expect(liste).toContainText('Vendeur pour Noël')

  await liste.getByRole('listitem').filter({ hasText: 'Précommande de Noël' }).getByRole('button', { name: 'Rouvrir' }).click()
  await expect(page.getByRole('heading', { name: 'Acheter en volume' })).toBeVisible()
  // 20 000 € à 12 % : 2 400 € de remise, 17 600 € payés × 6 % ÷ 12 ÷ 2 × 3 mois = 132 € ; gain 2 268 €
  await expect(page.getByRole('status')).toContainText(/gain de 2\s268\s€/)
})

test('franchisé : une soirée se met dans le budget, la promo se lit en volume', async ({ page, isMobile }, info) => {
  const ecritures = await connecter(page, franchise, { role: 'franchise' })
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=chiffres&partie=simulateurs&sim=prix`)
  await page.getByRole('group', { name: 'Je regarde' }).getByRole('button', { name: 'Une remise' }).click()
  await page.getByLabel('Remise', { exact: true }).fill('10')
  await page.getByLabel('Taux de marge du produit').fill('30')
  await expect(page.getByRole('status')).toContainText('Avec 10 % de remise, il faut vendre 50 % de plus pour garder la même marge.')

  await simulateurs(page).getByRole('button', { name: /Soirée, dégustation/ }).click()
  await page.getByLabel('Nom de l’événement').fill('Soirée bières de Noël')
  await page.getByLabel('Prix par participant TTC').fill('25')
  await page.getByLabel('Participants attendus').fill('40')
  await page.getByLabel('Taux de marge', { exact: true }).fill('60')
  // Vague 10 : sans achats des participants ; coûts d'office 50 € de décoration et 150 € d'animation
  await page.getByLabel('Les participants achètent en cave').uncheck()
  await page.getByLabel('Extras de personnel').fill('150')
  // Bar à 18 % de TVA : 25 ÷ 1,18 = 21,19 € HT × 40 = 847,46 € ; marge 508,47 − 3 % 25,42 − 350 = 133,05 €
  await expect(page.getByRole('status')).toContainText(/gain de 133\s€/)
  // Compte de l'événement : marge 508 € − redevance et publicité 25 € − coûts 350 € = 133 €
  await expect(page.getByRole('region', { name: '3. Coûts de l’événement HT' }).locator('.sous-total')).toHaveText(/− 350\s€/)
  await expect(page.getByRole('table', { name: 'Compte de l’événement' }).getByRole('row')).toHaveText([/Marge sur les ventes.*\+ 508\s€/, /Redevance et publicité.*− 25\s€/, /Coûts de l’événement.*− 350\s€/, /Gain.*133\s€/])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-simulateurs-soiree.png`, fullPage: true })
  await page.getByRole('button', { name: 'Mettre dans mon budget 2027' }).click()
  await expect(page.getByText(/Ajouté au budget 2027\. Les extras et les heures de l’équipe se saisissent dans l’Équipe du budget\. Pense à l’envoyer au siège\./)).toBeVisible()
  const budget = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { ajustements: { tempsForts: unknown[] } }
  expect(budget.ajustements.tempsForts).toEqual([{ nom: 'Soirée bières de Noël', type: 'soiree', mois: 12, univers: 'bar', caAnPasse: 0, ca: 847, autresCharges: 200, moisAchats: 11 }])
})

test('Coach : les simulateurs dans les chiffres du magasin, sans toucher au budget', async ({ page }) => {
  const ecritures = await connecter(page, { appMetadata: { role: 'coach', coach: 'Hugo FICTIF' } }, { role: 'coach', simulations: [gardee] })
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=chiffres&partie=simulateurs&sim=investissement`)
  await expect(page.getByRole('tab', { name: 'Simulateurs' })).toHaveAttribute('aria-selected', 'true')
  // Exemple : travaux terrasse de 25 000 €, 20 000 € de CA au bar à 70 % : 14 000 − 600 − 8 000 = 5 400 € d'EBE par an
  await expect(page.getByRole('status')).toContainText(/Travaux terrasse de 25\s000\s€ : 5\s400\s€ d’EBE en plus par an, remboursé en 4,6 ans/)
  await expect(page.getByRole('button', { name: /Mettre dans mon budget/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Garder', exact: true })).toBeVisible()
  // La simulation du franchisé se lit, mais seul son auteur la retire
  const ligne = page.getByRole('region', { name: 'Simulations gardées' }).getByRole('listitem').filter({ hasText: 'Précommande de Noël' })
  await expect(ligne.getByRole('button', { name: 'Rouvrir' })).toBeVisible()
  await expect(ligne.getByRole('button', { name: /Retirer/ })).toHaveCount(0)
  expect(ecritures.filter((e) => e.table === 'budgets')).toEqual([])
})

test('Investir : travaux et équipements préréglés, jours de fermeture, plus de tireuse (Joseph, 16/11/2026)', async ({ page, isMobile }) => {
  await connecter(page, franchise, { role: 'franchise' })
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=chiffres&partie=simulateurs&sim=investissement`)
  const projet = page.getByRole('group', { name: 'Projet' })
  for (const n of ['Libre', 'Terrasse', 'Concept 2.0', 'Four, food', 'Corner alimentaire', 'Marché extérieur']) await expect(projet.getByRole('button', { name: n, exact: true })).toBeVisible()
  await expect(page.getByText(/Tireuse/)).toHaveCount(0)
  // Concept 2.0 : 80 000 €, 40 000 € de CA cave à 33 % : 13 200 − 1 200 − 1 000 = 11 000 € d'EBE ; 10 jours de fermeture
  await projet.getByRole('button', { name: 'Concept 2.0' }).click()
  await expect(page.getByLabel('Jours de fermeture')).toHaveValue('10')
  await page.getByLabel('CA HT d’un jour').fill('1000')
  await page.getByLabel('Marge du magasin').fill('40')
  // 10 × 1 000 × (40 % − 3 %) = 3 700 € de marge perdue : (80 000 + 3 700) ÷ 11 000 = 7,6 ans
  await expect(page.getByRole('status')).toContainText(/Passage au concept 2\.0 de 80\s000\s€ : 11\s000\s€ d’EBE en plus par an, remboursé en 7,6 ans/)
  await expect(page.getByText(/3\s700\s€ de marge perdue en 10 jours de fermeture/)).toBeVisible()
  // Four : 6 000 €, 12 000 € de CA à 65 % et 5 % de perte : 7 200 − 360 − 4 000 = 2 840 € ; sans fermeture
  await projet.getByRole('button', { name: 'Four, food' }).click()
  await expect(page.getByLabel('CA HT d’un jour')).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText(/Four, offre food de 6\s000\s€ : 2\s840\s€ d’EBE en plus par an, remboursé en 2,1 ans/)
  // Marché extérieur sans préconisation du siège : 40 000 €, 100 000 € de CA à 40 % : 40 000 − 3 000 − 27 000 = 10 000 €
  await projet.getByRole('button', { name: 'Marché extérieur' }).click()
  await expect(page.getByRole('status')).toContainText(/Marché extérieur de 40\s000\s€ : 10\s000\s€ d’EBE en plus par an, remboursé en 4 ans/)
  if (isMobile) for (const b of await projet.getByRole('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48)
})

test('avant la mise à jour 0031 de la base : les simulateurs marchent, sans « Garder »', async ({ page }) => {
  await connecter(page, franchise, { role: 'franchise', simulations: null })
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=chiffres&partie=simulateurs&sim=tresorerie`)
  await expect(page.getByRole('table', { name: 'Trésorerie de fin de mois' }).getByRole('row')).toHaveCount(13)
  await expect(page.getByRole('status')).toContainText('CA − 15 %')
  await expect(page.getByRole('button', { name: 'Garder', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Simulations gardées' })).toHaveCount(0)
})

test('Directeur : les repères des simulateurs dans les paramètres des budgets', async ({ page }) => {
  const ecritures = await connecter(page, {}, {})
  await page.goto('./#/parametres/reglages?rubrique=budget')
  await page.getByRole('tab', { name: 'Simulateurs' }).click()
  // Pas forcément un découvert (Joseph, 16/11/2026) : l'aide dit quel taux mettre
  await expect(page.getByText('Coût annuel de l’argent immobilisé (découvert ou placement), proposé dans « Acheter en volume »')).toBeVisible()
  await page.getByRole('button', { name: 'Aide : Argent immobilisé : quel taux ?' }).click()
  await expect(page.getByRole('dialog', { name: 'Argent immobilisé : quel taux ?' })).toContainText('ce que rapporterait cet argent placé')
  await page.keyboard.press('Escape')
  await page.getByLabel('Coût annuel de l’argent').fill('6')
  await page.getByLabel('CA du corner par mètre').fill('5000')
  await page.getByRole('region', { name: 'Simulateurs' }).getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Repères des simulateurs \d{4} enregistrés\./)).toBeVisible()
  const p = ecritures.filter((e) => e.table === 'parametres_reseau').at(-1)?.corps as { valeur: { simulateurs: unknown } }
  expect(p.valeur.simulateurs).toMatchObject({ tauxDecouvert: 0.06, aideApprenti: 0, corner: { caParMetre: 5_000, tauxMarge: 0, demarque: 0 } })
})

test('120 : clôture en un écran, stock repris du mois précédent en gris, rappel dans la cloche', async ({ page, isMobile }, info) => {
  // Au 27/10/2026 : septembre est le dernier mois clos ; août saisi, septembre pas encore
  const stocks = [{ store_name: NOM, annee: 2026, mois: 8, cave: 60_000, bar: 8_000, exterieur: null }]
  const ecritures = await connecter(page, franchise, { role: 'franchise', stocks })
  // Rappel du 2, relance du 7 : le stock de fin septembre manque
  await page.getByRole('button', { name: /^Notifications/ }).first().click()
  // Premier passage sur l'appareil : ce qui existe est déjà lu, on regarde toutes les notifications
  await page.getByRole('group', { name: 'Notifications affichées' }).getByRole('button', { name: 'Toutes' }).click()
  await expect(page.getByText('Relance : clôture de septembre')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.goto(`./#/magasins/${encodeURIComponent(NOM)}?vue=chiffres&partie=cloture`)
  const stock = page.getByRole('region', { name: 'Stock de fin septembre' })
  await expect(stock.getByLabel('Stock Cave')).toHaveValue(/60\s000/)
  await expect(stock.getByLabel('Stock Cave')).toHaveAttribute('data-prerempli', 'oui')
  await expect(stock.getByLabel('Stock Extérieur')).toHaveValue('')
  // Le Bar a bougé : corrigé, il n'est plus en gris ; la Cave reste reprise
  await stock.getByLabel('Stock Bar').fill('9500')
  await expect(stock.getByLabel('Stock Bar')).not.toHaveAttribute('data-prerempli', 'oui')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-cloture-rapide.png`, fullPage: true })
  await stock.getByRole('button', { name: 'Enregistrer le stock' }).click()
  await expect(stock).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Clôture du mois' }).getByRole('button', { name: 'Stock de fin de mois' })).toContainText('Voir')
  expect(ecritures.find((e) => e.table === 'stocks')?.corps).toMatchObject({ store_name: NOM, annee: 2026, mois: 9, cave: 60_000, bar: 9_500, exterieur: null })
})
