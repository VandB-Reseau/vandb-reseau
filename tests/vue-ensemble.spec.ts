import { expect, test, type Page } from '@playwright/test'
import { COMPTE, seConnecter, simulerSupabase, textesTropPetits } from './supabase-simule'
import { magasinFictif } from './pilotage/donnees-fictives'
import { simulerPilotage } from './pilotage/supabase-simule'

// Vue d'ensemble de la fiche magasin plus parlante (choix 254 à 260 bis, Joseph 16/11/2026) : colonnes équilibrées,
// CA de l'année face à l'an passé, points d'attention, budget de l'année, derniers échanges, avis Google.
// Données fictives uniquement.

test('255 à 257, 259 et 260 bis : points d’attention, CA de l’année, derniers échanges, blocs repliés à droite', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Lyon%20Test')
  // 257 : la caisse qui décroche et la case faible de la nine box, avec leur lien
  const attention = page.getByRole('region', { name: 'Points d’attention' })
  await expect(attention.getByText(/^Décroche : CA de septembre 2026/)).toBeVisible()
  await expect(attention.getByText('Nine box : Redressement urgent')).toBeVisible()
  await expect(attention.getByRole('link', { name: 'Voir la santé' }).first()).toHaveAttribute('href', /vue=ninebox/)
  // 256 : CA de l'année à fin septembre, comparé aux mêmes mois de l'an passé, avec la courbe sur douze mois
  const indicateurs = page.getByRole('region', { name: 'Indicateurs du magasin' })
  await expect(indicateurs.getByText(/^CA 2026 à fin sept/)).toBeVisible()
  await expect(indicateurs.getByRole('img', { name: 'CA des douze derniers mois' })).toBeVisible()
  await expect(indicateurs.getByText('CA de septembre 2026')).toBeVisible()
  // 259 : les trois derniers échanges, la note et le compte rendu compris
  const echanges = page.getByRole('region', { name: 'Derniers échanges' }).or(page.locator('.MuiCard-root', { has: page.getByRole('heading', { name: 'Derniers échanges' }) })).first()
  await expect(page.getByRole('heading', { name: 'Derniers échanges' })).toBeVisible()
  await expect(echanges.getByText('Appel du franchisé : travaux de vitrine prévus.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dernier compte rendu' })).toHaveCount(0)
  // 258 : sans budget lisible, la tuile mène à l'onglet Budget
  await expect(page.getByRole('region', { name: 'À faire maintenant' }).getByRole('link', { name: /^Budget/ })).toHaveAttribute('href', /vue=budget/)
  // 260 bis : les avis Google à côté de l'itinéraire
  await expect(page.getByRole('link', { name: 'Avis Google' })).toHaveAttribute('href', /google\.com\/search\?q=V%20and%20B%20Lyon%20Test%20avis/)
  // 255 : sur PC, Exploitation et les blocs repliés sont dans la colonne de droite, sous les échanges
  if (!isMobile) {
    const titre = await page.getByRole('heading', { name: 'Derniers échanges' }).boundingBox()
    const equipements = await page.getByRole('button', { name: /^Équipements/ }).boundingBox()
    const magasin = await page.getByRole('heading', { name: 'Magasin', exact: true }).boundingBox()
    expect(equipements!.x).toBeGreaterThan(magasin!.x + 200)
    expect(equipements!.y).toBeGreaterThan(titre!.y)
  }
  expect(await textesTropPetits(page)).toEqual([])
})

test('257 : mandat qui se termine et fiche incomplète dans les points d’attention', async ({ page }) => {
  await seConnecter(page)
  await page.goto('./#/magasins/Brest%20Test')
  const attention = page.getByRole('region', { name: 'Points d’attention' })
  await expect(attention.getByText(/^Mandat de .+ : fin le /)).toBeVisible()
  await expect(attention.getByText(/^\d+ informations à compléter sur la fiche$/)).toBeVisible()
  await attention.getByRole('button', { name: 'Compléter' }).click()
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

test('258 : le budget de l’année, son statut et son CA face à l’atterrissage', async ({ page }) => {
  await connecterAvecBudget(page)
  await page.goto('./#/magasins/Lyon%20Test')
  const tuile = page.getByRole('region', { name: 'À faire maintenant' }).getByRole('link', { name: /^Budget 20\d\d : En discussion, CA .+ vs atterrissage 20\d\d/ })
  await expect(tuile).toBeVisible()
  await tuile.click()
  await expect(page).toHaveURL(/vue=budget/)
})
