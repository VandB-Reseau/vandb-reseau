import { expect, test, type Page } from '@playwright/test'
import { COMPTE, seConnecter, simulerSupabase, textesTropPetits } from './supabase-simule'
import { magasinFictif } from './pilotage/donnees-fictives'
import { simulerPilotage } from './pilotage/supabase-simule'

// Vue d'ensemble de la fiche magasin, maquette 264 (Joseph, 17/11/2026) : à gauche « À faire » et les objectifs, à
// droite « Comment va le magasin », le budget et le dernier échange ; les informations fixes dans le panneau
// « Infos du magasin ». Données fictives uniquement.

test('264 : À faire à gauche, comment va le magasin à droite, dernier échange', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  // À droite : la caisse qui décroche et la case faible de la nine box, avec leur lien, sous le CA de l'année et du mois
  const va = page.getByRole('region', { name: 'Comment va le magasin' })
  await expect(va.getByText(/^Décroche : CA de septembre 2026/)).toBeVisible()
  await expect(va.getByRole('link', { name: 'Nine box : Redressement urgent' })).toHaveAttribute('href', /vue=ninebox/)
  const indicateurs = va.getByRole('group', { name: 'Indicateurs du magasin' })
  await expect(indicateurs.getByText(/^CA 2026 à fin sept/)).toBeVisible()
  await expect(indicateurs.getByRole('img', { name: 'CA des douze derniers mois' })).toBeVisible()
  await expect(indicateurs.getByText('CA de septembre 2026')).toBeVisible()
  // Panier et marge : dans l'onglet Chiffres seulement
  await expect(va.getByText('Panier moyen HT')).toHaveCount(0)
  // Un seul échange, le plus récent
  const echange = page.getByRole('region', { name: 'Dernier échange' })
  await expect(echange.getByRole('link')).toHaveCount(2) // l'échange et « Toute l'activité »
  await expect(page.getByRole('heading', { name: 'Derniers échanges' })).toHaveCount(0)
  // Sans budget lisible, la tuile mène à l'onglet Budget
  await expect(page.getByRole('group', { name: 'Budget du magasin' }).getByRole('link', { name: /^Budget/ })).toHaveAttribute('href', /vue=budget/)
  // À gauche : la visite et les tâches dans une seule liste
  const aFaire = page.getByRole('region', { name: 'À faire' })
  await expect(aFaire.getByText(/^Visite : /)).toBeVisible()
  await expect(aFaire.getByRole('link', { name: /^Toutes les tâches|^Tâches$/ })).toHaveAttribute('href', /fil=taches/)
  // Plus d'équipe, de carte ni de blocs repliés sur la vue d'ensemble
  await expect(page.getByRole('heading', { name: 'Équipe', exact: true })).toHaveCount(0)
  await expect(page.locator('iframe[title="Carte Google de Lyon Test"]')).toHaveCount(0)
  if (!isMobile) {
    const gauche = await aFaire.boundingBox()
    const droite = await va.boundingBox()
    expect(droite!.x).toBeGreaterThan(gauche!.x + 200)
  }
  expect(await textesTropPetits(page)).toEqual([])
})

test('264 : le panneau « Infos du magasin » réunit équipe, adresse, carte, avis Google et blocs repliés', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  await page.getByRole('button', { name: 'Infos du magasin' }).click()
  const infos = page.getByRole('dialog', { name: 'Infos du magasin' })
  await expect(infos.getByRole('heading', { name: 'Équipe', exact: true })).toBeVisible()
  await expect(infos.getByRole('heading', { name: 'Magasin', exact: true })).toBeVisible()
  await expect(infos.getByRole('link', { name: 'Avis Google' })).toHaveAttribute('href', /google\.com\/search\?q=V%20and%20B%20Lyon%20Test%20avis/)
  await expect(infos.locator('iframe[title="Carte Google de Lyon Test"]')).toBeVisible()
  await expect(infos.getByRole('button', { name: /^Équipements/ })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  await infos.getByRole('button', { name: 'Fermer' }).click()
  await expect(infos).toHaveCount(0)
})

test('264 : mandat qui se termine et fiche incomplète dans « À faire »', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Brest%20Test')
  const aFaire = page.getByRole('region', { name: 'À faire' })
  await expect(aFaire.getByText(/^Mandat de .+ : fin le /)).toBeVisible()
  await aFaire.getByRole('button', { name: /^\d+ informations à compléter sur la fiche$/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

async function connecterAvecBudget(page: Page) {
  await simulerSupabase(page, {})
  await simulerPilotage(page, { magasins: [{ magasin: 'Lyon Test', statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }] })
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
}

test('264 : le budget de l’année, son statut et son CA face à l’atterrissage', async ({ page }) => {
  await connecterAvecBudget(page)
  await page.goto('./#/magasins/Lyon%20Test')
  const tuile = page.getByRole('group', { name: 'Budget du magasin' }).getByRole('link', { name: /^Budget 20\d\d : En discussion, CA .+ vs atterrissage 20\d\d/ })
  await expect(tuile).toBeVisible()
  await tuile.click()
  await expect(page).toHaveURL(/vue=budget/)
})
