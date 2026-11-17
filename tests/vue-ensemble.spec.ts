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
  // Lien vers toutes les tâches seulement quand la liste est coupée (plus de 3 tâches)
  await expect(aFaire.getByRole('link', { name: /^Toutes les tâches/ })).toHaveCount(0)
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

// Joseph (17/11/2026) : « À faire » identique dans la Vue d'ensemble et dans l'Activité (même carte, même titre, mêmes
// lignes) ; tous les blocs de la fiche ont le titre au même endroit
test('À faire : même bloc et mêmes lignes dans la Vue d’ensemble et dans l’Activité', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  const lire = async () => {
    const bloc = page.getByRole('region', { name: 'À faire' })
    await expect(bloc.getByText(/^Visite : /)).toBeVisible()
    const titre = await bloc.getByRole('heading', { name: 'À faire' }).boundingBox()
    const carte = await bloc.boundingBox()
    return {
      visite: await bloc.getByText(/^Visite : /).innerText(),
      taches: await bloc.getByRole('list', { name: /^Tâches en cours de/ }).getByRole('listitem').count().catch(() => 0),
      vide: await bloc.getByText('Aucune tâche en cours.').count(),
      retrait: Math.round(titre!.x - carte!.x),
      hauteurTitre: Math.round(titre!.height),
    }
  }
  const apercu = await lire()
  // Tous les blocs de la Vue d'ensemble : le titre au même retrait
  for (const nom of ['Comment va le magasin', 'Dernier échange']) {
    const bloc = page.getByRole('region', { name: nom })
    const t = await bloc.getByRole('heading', { name: nom }).boundingBox()
    expect(Math.round(t!.x - (await bloc.boundingBox())!.x)).toBe(apercu.retrait)
  }
  await page.getByRole('tab', { name: 'Activité' }).click()
  await expect(page.getByRole('region', { name: 'Historique' })).toBeVisible()
  const activite = await lire()
  expect(activite.visite).toBe(apercu.visite)
  expect(activite.vide).toBe(apercu.vide)
  expect(activite.retrait).toBe(apercu.retrait)
  expect(activite.hauteurTitre).toBe(apercu.hauteurTitre)
  if (apercu.taches <= 3) expect(activite.taches).toBe(apercu.taches)
  const historique = page.getByRole('region', { name: 'Historique' })
  const t = await historique.getByRole('heading', { name: 'Historique' }).boundingBox()
  expect(Math.round(t!.x - (await historique.boundingBox())!.x)).toBe(apercu.retrait)
  expect(await textesTropPetits(page)).toEqual([])
})
